#!/usr/bin/env python3
"""Fetch and normalize Nepal local government master data for DRISHTI.

The source tables are open Wikipedia tables that cite MoFAGA/local-level data:
- Wards and electoral divisions of Nepal: all 753 local bodies with district
  and province mapping.
- List of cities in Nepal: 293 urban municipalities with Nepali names.
- List of gaunpalikas of Nepal: 460 rural municipalities with Nepali names.
"""

from __future__ import annotations

import csv
import io
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "palika_master.csv"

WARDS_URL = "https://en.wikipedia.org/wiki/Wards_and_electoral_divisions_of_Nepal"
CITIES_URL = "https://en.wikipedia.org/wiki/List_of_cities_in_Nepal"
GAUNPALIKA_URL = "https://en.wikipedia.org/wiki/List_of_gaunpalikas_of_Nepal"

USER_AGENT = "DRISHTI disaster dashboard data build (local open-source fetch)"

PROVINCE_NE = {
    "Koshi": "कोशी",
    "Madhesh": "मधेश",
    "Bagmati": "बागमती",
    "Gandaki": "गण्डकी",
    "Lumbini": "लुम्बिनी",
    "Karnali": "कर्णाली",
    "Sudurpashchim": "सुदूरपश्चिम",
}

DISTRICT_ALIASES = {
    "chitawan": "chitwan",
    "dhanusha": "dhanusa",
    "kapilbastu": "kapilvastu",
    "makawanpur": "makwanpur",
    "nawalparasi west": "parasi",
    "pancthar": "panchthar",
    "rukum east": "eastern rukum",
    "rukum west": "western rukum",
    "tanahu": "tanahun",
    "terathum": "terhathum",
}

DISTRICT_NE = {
    "achham": "अछाम",
    "arghakhanchi": "अर्घाखाँची",
    "baglung": "बागलुङ",
    "baitadi": "बैतडी",
    "bajhang": "बझाङ",
    "bajura": "बाजुरा",
    "banke": "बाँके",
    "bara": "बारा",
    "bardiya": "बर्दिया",
    "bhaktapur": "भक्तपुर",
    "bhojpur": "भोजपुर",
    "chitwan": "चितवन",
    "dadeldhura": "डडेल्धुरा",
    "dailekh": "दैलेख",
    "dang": "दाङ",
    "darchula": "दार्चुला",
    "dhading": "धादिङ",
    "dhankuta": "धनकुटा",
    "dhanusa": "धनुषा",
    "dolakha": "दोलखा",
    "dolpa": "डोल्पा",
    "doti": "डोटी",
    "eastern rukum": "पूर्वी रुकुम",
    "gorkha": "गोरखा",
    "gulmi": "गुल्मी",
    "humla": "हुम्ला",
    "ilam": "इलाम",
    "jajarkot": "जाजरकोट",
    "jhapa": "झापा",
    "jumla": "जुम्ला",
    "kailali": "कैलाली",
    "kalikot": "कालिकोट",
    "kanchanpur": "कञ्चनपुर",
    "kapilvastu": "कपिलवस्तु",
    "kaski": "कास्की",
    "kathmandu": "काठमाडौँ",
    "kavrepalanchok": "काभ्रेपलाञ्चोक",
    "khotang": "खोटाङ",
    "lalitpur": "ललितपुर",
    "lamjung": "लमजुङ",
    "mahottari": "महोत्तरी",
    "makwanpur": "मकवानपुर",
    "manang": "मनाङ",
    "morang": "मोरङ",
    "mugu": "मुगु",
    "mustang": "मुस्ताङ",
    "myagdi": "म्याग्दी",
    "nawalpur": "नवलपुर",
    "nuwakot": "नुवाकोट",
    "okhaldhunga": "ओखलढुङ्गा",
    "palpa": "पाल्पा",
    "panchthar": "पाँचथर",
    "parasi": "पश्चिम नवलपरासी",
    "parbat": "पर्वत",
    "parsa": "पर्सा",
    "pyuthan": "प्यूठान",
    "ramechhap": "रामेछाप",
    "rasuwa": "रसुवा",
    "rautahat": "रौतहट",
    "rolpa": "रोल्पा",
    "rupandehi": "रुपन्देही",
    "salyan": "सल्यान",
    "sankhuwasabha": "संखुवासभा",
    "saptari": "सप्तरी",
    "sarlahi": "सर्लाही",
    "sindhuli": "सिन्धुली",
    "sindhupalchok": "सिन्धुपाल्चोक",
    "siraha": "सिरहा",
    "solukhumbu": "सोलुखुम्बु",
    "sunsari": "सुनसरी",
    "surkhet": "सुर्खेत",
    "syangja": "स्याङ्जा",
    "tanahun": "तनहुँ",
    "taplejung": "ताप्लेजुङ",
    "terhathum": "तेह्रथुम",
    "udayapur": "उदयपुर",
    "western rukum": "पश्चिम रुकुम",
}

TYPE_NE = {
    "Metropolitan City": "महानगरपालिका",
    "Sub-Metropolitan City": "उपमहानगरपालिका",
    "Municipality": "नगरपालिका",
    "Gaunpalika": "गाउँपालिका",
}


def fetch_tables(url: str) -> list[pd.DataFrame]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        html = response.read()
    return pd.read_html(io.BytesIO(html))


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    text = str(value)
    text = re.sub(r"\[[^\]]+\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def to_int(value: object) -> int:
    text = re.sub(r"[^0-9]", "", clean(value))
    return int(text) if text else 0


def slug(value: str) -> str:
    text = value.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def location_key(value: str) -> str:
    text = clean(value).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return DISTRICT_ALIASES.get(text, text)


def district_ne_lookup() -> dict[tuple[str, str], str]:
    wards = fetch_tables(WARDS_URL)[1]
    lookup: dict[tuple[str, str], str] = {}
    for _, row in wards.iterrows():
        province = clean(row["Province"])
        district = clean(row["Districts"])
        district_ne = clean(row["जिल्ला"])
        lookup[(province, district)] = district_ne
        lookup[(province, location_key(district))] = district_ne
    return lookup


def city_rows() -> list[dict[str, object]]:
    tables = fetch_tables(CITIES_URL)
    typed_tables = [
        ("Metropolitan City", tables[1]),
        ("Sub-Metropolitan City", tables[2]),
        ("Municipality", tables[3]),
    ]
    rows: list[dict[str, object]] = []
    for palika_type, table in typed_tables:
        for _, row in table.iterrows():
            rows.append(
                {
                    "palika_name_en": clean(row["Name"]),
                    "palika_name_ne": clean(row["Nepali"]),
                    "palika_type_en": palika_type,
                    "palika_type_ne": TYPE_NE[palika_type],
                    "district_en": clean(row["District"]),
                    "province_en": clean(row["Province"]),
                    "wards": to_int(row["# of wards"]),
                    "population_2021": clean(row["Population (2021)"]),
                    "area_km2": clean(row.get("Area (km2)", row.get("Area", ""))),
                    "website": clean(row.get("Website", "")),
                    "source_url": CITIES_URL,
                }
            )
    return rows


def rural_rows() -> list[dict[str, object]]:
    table = fetch_tables(GAUNPALIKA_URL)[3]
    rows: list[dict[str, object]] = []
    for _, row in table.iterrows():
        rows.append(
            {
                "palika_name_en": clean(row["Name"]),
                "palika_name_ne": clean(row["Nepali"]),
                "palika_type_en": "Gaunpalika",
                "palika_type_ne": TYPE_NE["Gaunpalika"],
                "district_en": clean(row["District"]),
                "province_en": clean(row["Province"]),
                "wards": to_int(row["Wards"]),
                "population_2021": clean(row["Population (2021)"]),
                "area_km2": clean(row["Area (KM2)"]),
                "website": "",
                "source_url": GAUNPALIKA_URL,
            }
        )
    return rows


def build_master() -> list[dict[str, object]]:
    district_names = district_ne_lookup()
    rows = city_rows() + rural_rows()
    output: list[dict[str, object]] = []

    for row in rows:
        province = str(row["province_en"])
        district = str(row["district_en"])
        palika = str(row["palika_name_en"])
        palika_type = str(row["palika_type_en"])
        palika_id = f"{slug(province)}-{slug(district)}-{slug(palika)}-{slug(palika_type)}"
        district_ne = (
            district_names.get((province, district))
            or district_names.get((province, location_key(district)))
            or DISTRICT_NE.get(location_key(district), "")
        )
        palika_ne = str(row["palika_name_ne"]) or palika
        full_en = f"{palika} {palika_type}"
        full_ne = f"{palika_ne} {row['palika_type_ne']}"

        output.append(
            {
                "palika_id": palika_id,
                "province_en": province,
                "province_ne": PROVINCE_NE.get(province, province),
                "district_en": district,
                "district_ne": district_ne,
                "palika_name_en": palika,
                "palika_name_ne": palika_ne,
                "palika_type_en": palika_type,
                "palika_type_ne": row["palika_type_ne"],
                "palika_full_name_en": full_en,
                "palika_full_name_ne": full_ne,
                "palika_label": f"{full_ne} / {full_en}",
                "wards": row["wards"],
                "population_2021": row["population_2021"],
                "area_km2": row["area_km2"],
                "website": row["website"],
                "source_url": row["source_url"],
            }
        )

    output.sort(key=lambda item: (item["province_en"], item["district_en"], item["palika_full_name_en"]))
    return output


def main() -> None:
    rows = build_master()
    ids = [row["palika_id"] for row in rows]
    if len(rows) != 753:
        raise SystemExit(f"Expected 753 palikas, found {len(rows)}")
    if len(ids) != len(set(ids)):
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        raise SystemExit(f"Duplicate palika ids: {duplicates[:10]}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - script entrypoint
        print(f"palika fetch failed: {exc}", file=sys.stderr)
        raise
