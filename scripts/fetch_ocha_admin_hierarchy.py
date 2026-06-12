#!/usr/bin/env python3
"""Build a reusable Nepal admin hierarchy from OCHA COD and palika master data."""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import tempfile
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PALIKA_MASTER = ROOT / "public" / "data" / "palika_master.csv"
HIERARCHY_JSON = ROOT / "public" / "data" / "nepal_admin_hierarchy.json"
UNMAPPED_REPORT = ROOT / "scripts" / "ocha_unmapped_admin3.csv"

OCHA_XLSX_URL = (
    "https://data.humdata.org/dataset/07db728a-4f0f-4e98-8eb0-8fa9df61f01c/"
    "resource/cb6d3418-f115-4f7b-9abc-ac393fcf0b28/download/npl_admin_boundaries.xlsx"
)

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

LOCAL_LEVEL_SUFFIXES = (
    "sub metropolitan city",
    "sub-metropolitan city",
    "metropolitan city",
    "rural municipality",
    "municipality",
    "gaunpalika",
    "gaupalika",
    "gaun palika",
)

DISTRICT_ALIASES = {
    "chitawan": "chitwan",
    "dhanusha": "dhanusa",
    "kapilbastu": "kapilvastu",
    "makawanpur": "makwanpur",
    "nawalparasi west": "parasi",
    "nawalparasi east": "nawalpur",
    "pancthar": "panchthar",
    "rukum east": "eastern rukum",
    "rukum west": "western rukum",
    "tanahu": "tanahun",
    "terathum": "terhathum",
}

PROVINCE_ALIASES = {
    "sudur paschim": "sudurpashchim",
}

PALIKA_ALIASES = {
    "bagachour": "bagchaur",
    "bheri malika": "bheri",
    "bhoome": "bhume",
    "chumanubri": "tsum nubri",
    "fakfokathum": "phakphokthum",
    "falelung": "phalelung",
    "janakpurdham": "janakpur",
    "laxminiya": "lakshminya",
    "ngisyang": "manang ngisyang",
    "ruruchhetra": "ruru kshetra",
}

DISTRICT_PALIKA_ALIASES = {
    ("darchula", "byas"): "byans",
    ("tanahun", "byas"): "vyas",
}


def column_index(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    index = 0
    for letter in letters:
        index = index * 26 + (ord(letter) - ord("A") + 1)
    return index - 1


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_palika_name(value: str) -> str:
    text = normalize_text(value)
    for suffix in LOCAL_LEVEL_SUFFIXES:
        suffix_norm = normalize_text(suffix)
        if text.endswith(f" {suffix_norm}"):
            text = text[: -len(suffix_norm)].strip()
            break
    return PALIKA_ALIASES.get(text, text)


def compact_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", normalize_text(value))


def province_key(value: str) -> str:
    normalized = normalize_text(value)
    return PROVINCE_ALIASES.get(normalized, normalized)


def district_key(value: str) -> str:
    normalized = normalize_text(value)
    return DISTRICT_ALIASES.get(normalized, normalized)


def palika_key(value: str, district: str) -> str:
    normalized = normalize_palika_name(value)
    return DISTRICT_PALIKA_ALIASES.get((district_key(district), normalized), normalized)


class XlsxReader:
    def __init__(self, path: Path) -> None:
        self.archive = zipfile.ZipFile(path)
        self.shared_strings = self._read_shared_strings()
        self.sheet_paths = self._read_sheet_paths()

    def _read_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self.archive.namelist():
            return []
        root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        strings = []
        for item in root.findall("main:si", NS):
            strings.append("".join(node.text or "" for node in item.iter(f"{{{NS['main']}}}t")))
        return strings

    def _read_sheet_paths(self) -> dict[str, str]:
        workbook = ET.fromstring(self.archive.read("xl/workbook.xml"))
        rels = ET.fromstring(self.archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels
            if "Id" in rel.attrib and "Target" in rel.attrib
        }
        paths = {}
        for sheet in workbook.find("main:sheets", NS).findall("main:sheet", NS):
            rel_id = sheet.attrib[f"{{{NS['rel']}}}id"]
            target = rel_targets[rel_id]
            paths[sheet.attrib["name"]] = f"xl/{target}" if not target.startswith("xl/") else target
        return paths

    def _cell_value(self, cell: ET.Element) -> str:
        value = cell.find("main:v", NS)
        if value is None:
            inline = cell.find("main:is", NS)
            if inline is None:
                return ""
            return "".join(node.text or "" for node in inline.iter(f"{{{NS['main']}}}t"))

        raw = value.text or ""
        if cell.attrib.get("t") == "s" and raw:
            return self.shared_strings[int(raw)]
        return raw

    def rows(self, sheet_name: str) -> list[dict[str, str]]:
        root = ET.fromstring(self.archive.read(self.sheet_paths[sheet_name]))
        sheet_rows = root.find("main:sheetData", NS).findall("main:row", NS)
        header: list[str] = []
        rows: list[dict[str, str]] = []

        for row_index, row in enumerate(sheet_rows):
            cells: dict[int, str] = {}
            for cell in row.findall("main:c", NS):
                cells[column_index(cell.attrib["r"])] = self._cell_value(cell)

            if row_index == 0:
                header = [cells.get(index, "") for index in range(max(cells.keys()) + 1)]
                continue

            if not any(value.strip() for value in cells.values()):
                continue

            rows.append({name: cells.get(index, "").strip() for index, name in enumerate(header) if name})

        return rows


def download_ocha_xlsx(url: str) -> Path:
    target = Path(tempfile.gettempdir()) / "npl_admin_boundaries.xlsx"
    request = urllib.request.Request(url, headers={"User-Agent": "DRISHTI OCHA COD hierarchy builder"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    except Exception:
        subprocess.run(["curl", "-L", "--fail", "--silent", "--show-error", "-o", str(target), url], check=True)
    return target


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_lookup(rows: list[dict[str, str]], key_fields: tuple[str, ...]) -> dict[tuple[str, ...], dict[str, str]]:
    lookup: dict[tuple[str, ...], dict[str, str]] = {}
    for row in rows:
        key = tuple(row[field] for field in key_fields)
        lookup[key] = row
    return lookup


def index_palikas(rows: list[dict[str, str]]) -> dict[tuple[str, str, str], list[dict[str, str]]]:
    indexed: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = (
            province_key(row["province_en"]),
            district_key(row["district_en"]),
            palika_key(row["palika_name_en"], row["district_en"]),
        )
        indexed[key].append(row)
    return indexed


def fuzzy_score(left: str, right: str) -> float:
    left_compact = compact_text(left)
    right_compact = compact_text(right)
    return max(
        SequenceMatcher(None, left, right).ratio(),
        SequenceMatcher(None, left_compact, right_compact).ratio(),
    )


def fuzzy_match_palika(
    target_name: str,
    candidates: list[dict[str, str]],
) -> tuple[dict[str, str] | None, float]:
    scored = sorted(
        (
            (fuzzy_score(target_name, normalize_palika_name(candidate["palika_name_en"])), candidate)
            for candidate in candidates
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    if not scored:
        return None, 0

    best_score, best_candidate = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0
    if best_score >= 0.84 and best_score - second_score >= 0.04:
        return best_candidate, best_score
    return None, best_score


def is_reserved_ocha_admin3(row: dict[str, str]) -> bool:
    suffix = row.get("adm3_pcode", "")[-3:]
    return suffix.isdigit() and int(suffix) >= 595


def unmapped_record(row: dict[str, str], key: tuple[str, str, str], reason: str) -> dict[str, str]:
    return {
        "adm3_pcode": row["adm3_pcode"],
        "adm3_name": row["adm3_name"],
        "adm2_pcode": row["adm2_pcode"],
        "adm2_name": row["adm2_name"],
        "adm1_pcode": row["adm1_pcode"],
        "adm1_name": row["adm1_name"],
        "normalized_province": key[0],
        "normalized_district": key[1],
        "normalized_palika": key[2],
        "reason": reason,
    }


def matched_ocha_row(row: dict[str, str], method: str, score: str) -> dict[str, str]:
    matched = dict(row)
    matched["_match_method"] = method
    matched["_match_score"] = score
    return matched


def record_match(
    matched_by_palika_id: dict[str, dict[str, str]],
    unmapped: list[dict[str, str]],
    palika: dict[str, str],
    row: dict[str, str],
    key: tuple[str, str, str],
    method: str,
    score: str,
) -> None:
    candidate = matched_ocha_row(row, method, score)
    existing = matched_by_palika_id.get(palika["palika_id"])
    if not existing:
        matched_by_palika_id[palika["palika_id"]] = candidate
        return

    if is_reserved_ocha_admin3(existing) and not is_reserved_ocha_admin3(candidate):
        matched_by_palika_id[palika["palika_id"]] = candidate
        unmapped.append(
            unmapped_record(
                existing,
                key,
                f"duplicate OCHA Admin3 for {palika['palika_id']}; replaced by local-government P-code {candidate['adm3_pcode']}",
            )
        )
        return

    unmapped.append(
        unmapped_record(
            candidate,
            key,
            f"duplicate OCHA Admin3 for {palika['palika_id']}; local-government P-code {existing['adm3_pcode']} retained",
        )
    )


def match_ocha_admin3(
    admin3_rows: list[dict[str, str]],
    palika_rows: list[dict[str, str]],
) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
    palikas_by_key = index_palikas(palika_rows)
    palikas_by_district_key: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    palikas_by_district: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in palika_rows:
        normalized_district = district_key(row["district_en"])
        normalized_palika = palika_key(row["palika_name_en"], row["district_en"])
        palikas_by_district_key[(normalized_district, normalized_palika)].append(row)
        palikas_by_district[(province_key(row["province_en"]), normalized_district)].append(row)

    matched_by_palika_id: dict[str, dict[str, str]] = {}
    unmapped: list[dict[str, str]] = []

    for row in admin3_rows:
        key = (
            province_key(row["adm1_name"]),
            district_key(row["adm2_name"]),
            palika_key(row["adm3_name"], row["adm2_name"]),
        )
        matches = palikas_by_key.get(key, [])
        if len(matches) == 1:
            record_match(matched_by_palika_id, unmapped, matches[0], row, key, "exact normalized name", "1.000")
            continue

        district_matches = palikas_by_district_key.get((key[1], key[2]), [])
        if len(district_matches) == 1:
            record_match(
                matched_by_palika_id,
                unmapped,
                district_matches[0],
                row,
                key,
                "exact normalized district and name",
                "1.000",
            )
            continue

        fuzzy_match, score = fuzzy_match_palika(key[2], palikas_by_district.get((key[0], key[1]), []))
        if fuzzy_match:
            record_match(
                matched_by_palika_id,
                unmapped,
                fuzzy_match,
                row,
                key,
                "fuzzy normalized name",
                f"{score:.3f}",
            )
            continue

        unmapped.append(
            unmapped_record(
                row,
                key,
                (
                    "no palika_master match"
                    if not matches
                    else f"{len(matches)} ambiguous exact palika_master matches; best fuzzy score {score:.3f}"
                ),
            )
        )

    return matched_by_palika_id, unmapped


def write_unmapped_report(rows: list[dict[str, str]], path: Path) -> None:
    fieldnames = [
        "adm3_pcode",
        "adm3_name",
        "adm2_pcode",
        "adm2_name",
        "adm1_pcode",
        "adm1_name",
        "normalized_province",
        "normalized_district",
        "normalized_palika",
        "reason",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def palika_record(row: dict[str, str], ocha_row: dict[str, str] | None) -> dict[str, str | None]:
    return {
        "palika_id": row["palika_id"],
        "name_en": row["palika_name_en"],
        "name_ne": row["palika_name_ne"],
        "full_name_en": row["palika_full_name_en"],
        "full_name_ne": row["palika_full_name_ne"],
        "type_en": row["palika_type_en"],
        "type_ne": row["palika_type_ne"],
        "label": row["palika_label"],
        "ocha_adm3_pcode": ocha_row["adm3_pcode"] if ocha_row else None,
        "ocha_adm3_name": ocha_row["adm3_name"] if ocha_row else None,
        "ocha_match_method": ocha_row.get("_match_method") if ocha_row else None,
        "ocha_match_score": ocha_row.get("_match_score") if ocha_row else None,
    }


def build_hierarchy(
    admin1_rows: list[dict[str, str]],
    admin2_rows: list[dict[str, str]],
    palika_rows: list[dict[str, str]],
    matched_admin3: dict[str, dict[str, str]],
    admin3_count: int,
    unmapped_count: int,
) -> dict[str, object]:
    palikas_by_district: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in palika_rows:
        matched_row = matched_admin3.get(row["palika_id"])
        if matched_row:
            key = (province_key(matched_row["adm1_name"]), district_key(matched_row["adm2_name"]))
        else:
            key = (province_key(row["province_en"]), district_key(row["district_en"]))
        palikas_by_district[key].append(row)

    districts_by_province: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in admin2_rows:
        districts_by_province[province_key(row["adm1_name"])].append(row)

    province_ne = {}
    district_ne = {}
    for row in palika_rows:
        province_ne.setdefault(province_key(row["province_en"]), row["province_ne"])
        district_ne.setdefault((province_key(row["province_en"]), district_key(row["district_en"])), row["district_ne"])

    provinces = []
    for province in sorted(admin1_rows, key=lambda item: item["adm1_pcode"]):
        province_lookup_key = province_key(province["adm1_name"])
        districts = []
        for district in sorted(districts_by_province[province_lookup_key], key=lambda item: item["adm2_pcode"]):
            district_lookup_key = (province_lookup_key, district_key(district["adm2_name"]))
            palikas = sorted(
                palikas_by_district.get(district_lookup_key, []),
                key=lambda item: normalize_palika_name(item["palika_name_en"]),
            )
            districts.append(
                {
                    "name_en": district["adm2_name"],
                    "name_ne": district_ne.get(district_lookup_key, ""),
                    "ocha_adm2_pcode": district["adm2_pcode"],
                    "palika_count": len(palikas),
                    "palikas": [palika_record(row, matched_admin3.get(row["palika_id"])) for row in palikas],
                }
            )
        provinces.append(
            {
                "name_en": province["adm1_name"],
                "name_ne": province_ne.get(province_lookup_key, ""),
                "ocha_adm1_pcode": province["adm1_pcode"],
                "district_count": len(districts),
                "palika_count": sum(district["palika_count"] for district in districts),
                "districts": districts,
            }
        )

    matched_palika_count = sum(
        1
        for province in provinces
        for district in province["districts"]
        for palika in district["palikas"]
        if palika["ocha_adm3_pcode"]
    )

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "source": {
                "name": "OCHA COD-AB Nepal - npl_admin_boundaries.xlsx",
                "url": OCHA_XLSX_URL,
                "dataset": "https://data.humdata.org/dataset/cod-ab-npl",
            },
            "reconciliation": {
                "province_source": "OCHA COD Admin 1",
                "district_source": "OCHA COD Admin 2",
                "palika_source": "public/data/palika_master.csv",
                "palika_match_rule": "province + district + normalized English palika name",
            },
            "counts": {
                "ocha_admin1": len(admin1_rows),
                "ocha_admin2": len(admin2_rows),
                "ocha_admin3": admin3_count,
                "palika_master": len(palika_rows),
                "matched_palikas_to_ocha_admin3": matched_palika_count,
                "unmatched_palikas_to_ocha_admin3": len(palika_rows) - matched_palika_count,
                "unmapped_ocha_admin3": unmapped_count,
            },
        },
        "provinces": provinces,
    }


def validate_counts(hierarchy: dict[str, object]) -> None:
    counts = hierarchy["metadata"]["counts"]
    expected = {
        "ocha_admin1": 7,
        "ocha_admin2": 77,
        "palika_master": 753,
    }
    failures = [f"{key}={counts[key]} expected {value}" for key, value in expected.items() if counts[key] != value]
    if failures:
        raise SystemExit("Hierarchy validation failed: " + "; ".join(failures))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, help="Use a local OCHA COD XLSX instead of downloading it.")
    parser.add_argument("--url", default=OCHA_XLSX_URL, help="OCHA COD XLSX URL.")
    parser.add_argument("--output", type=Path, default=HIERARCHY_JSON, help="Output JSON path.")
    parser.add_argument("--unmapped-report", type=Path, default=UNMAPPED_REPORT, help="Unmapped Admin 3 CSV path.")
    args = parser.parse_args()

    xlsx_path = args.xlsx if args.xlsx else download_ocha_xlsx(args.url)
    reader = XlsxReader(xlsx_path)
    admin1_rows = reader.rows("npl_admin1")
    admin2_rows = reader.rows("npl_admin2")
    admin3_rows = reader.rows("npl_admin3")
    palika_rows = read_csv(PALIKA_MASTER)

    matched_admin3, unmapped_admin3 = match_ocha_admin3(admin3_rows, palika_rows)
    hierarchy = build_hierarchy(
        admin1_rows=admin1_rows,
        admin2_rows=admin2_rows,
        palika_rows=palika_rows,
        matched_admin3=matched_admin3,
        admin3_count=len(admin3_rows),
        unmapped_count=len(unmapped_admin3),
    )
    validate_counts(hierarchy)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(hierarchy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_unmapped_report(unmapped_admin3, args.unmapped_report)

    counts = hierarchy["metadata"]["counts"]
    print(f"Wrote {args.output}")
    print(f"Wrote {args.unmapped_report}")
    print(
        "Counts: "
        f"Admin1={counts['ocha_admin1']}, "
        f"Admin2={counts['ocha_admin2']}, "
        f"Admin3={counts['ocha_admin3']}, "
        f"Palika master={counts['palika_master']}, "
        f"matched palikas={counts['matched_palikas_to_ocha_admin3']}, "
        f"unmapped OCHA Admin3={counts['unmapped_ocha_admin3']}"
    )


if __name__ == "__main__":
    main()
