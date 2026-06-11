#!/usr/bin/env python3
"""Build DRISHTI event-scoped CSV seed data from the palika master list."""

from __future__ import annotations

import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
MASTER = DATA_DIR / "palika_master.csv"

EVENT_ID = "karnali-eq-2083-drill"
EVENT_NAME_NE = "कर्णाली भूकम्प प्रारम्भिक मूल्यांकन अभ्यास २०८३"
EVENT_NAME_EN = "Karnali Earthquake IRA Drill 2083"
KARNALI_DISTRICTS = ["Dailekh", "Jajarkot", "Salyan"]

SUBMISSION_COLUMNS = [
    "event_id",
    "event_name_ne",
    "event_name_en",
    "palika_id",
    "palika_name_ne",
    "palika_name_en",
    "district_ne",
    "district_en",
    "province_ne",
    "province_en",
    "submitted_at",
    "operator_name",
    "submission_type",
    "submission_type_ne",
    "is_proxy",
    "duplicate_status",
    "override_duplicate",
    "deaths",
    "missing",
    "injured",
    "displaced_households",
    "total_affected_population",
    "rescue_ongoing_wards",
    "rescue_completed_wards",
    "total_rescued",
    "shelter_households_schools",
    "shelter_households_public_buildings",
    "shelter_households_relatives",
    "shelter_households_open_areas",
    "immediate_shelter_need_households",
    "communications_disrupted",
    "electricity_disrupted",
    "water_supply_disrupted",
    "water_disruption_households",
    "private_houses_fully_damaged",
    "private_houses_partially_damaged",
    "government_buildings_fully_damaged",
    "government_buildings_partially_damaged",
    "public_buildings_fully_damaged",
    "public_buildings_partially_damaged",
    "tents_needed",
    "tarpaulins_needed",
    "food_packages_needed",
    "blankets_needed",
    "drinking_water_people",
]

TYPE_NE = {
    "Direct": "सिधा",
    "Photo": "कागजको फारामको फोटो",
    "Voice": "फोन कल",
}


def read_master() -> list[dict[str, str]]:
    with MASTER.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {path}")


def event_palikas(master: list[dict[str, str]]) -> list[dict[str, str]]:
    by_district = {
        district: [
            row
            for row in master
            if row["province_en"] == "Karnali" and row["district_en"] == district
        ]
        for district in KARNALI_DISTRICTS
    }
    for rows in by_district.values():
        rows.sort(key=lambda row: (row["palika_type_en"] != "Municipality", row["palika_name_en"]))

    # 10 from Salyan, 7 from Jajarkot, and 8 from Dailekh = 25 expected palikas.
    selected = by_district["Salyan"][:10] + by_district["Jajarkot"][:7] + by_district["Dailekh"][:8]
    if len(selected) != 25:
        raise SystemExit(f"Expected 25 event palikas, found {len(selected)}")
    return selected


def build_event_config(expected: list[dict[str, str]]) -> list[dict[str, object]]:
    return [
        {
            "event_id": EVENT_ID,
            "active": "TRUE",
            "event_name_ne": EVENT_NAME_NE,
            "event_name_en": EVENT_NAME_EN,
            "affected_province_ne": "कर्णाली",
            "affected_province_en": "Karnali",
            "affected_districts_ne": "; ".join(sorted({row["district_ne"] for row in expected})),
            "affected_districts_en": "; ".join(KARNALI_DISTRICTS),
            "expected_palika_ids": ";".join(row["palika_id"] for row in expected),
            "expected_palikas_ne": "; ".join(row["palika_full_name_ne"] for row in expected),
            "expected_palikas_en": "; ".join(row["palika_full_name_en"] for row in expected),
            "deaths_threshold": 10,
            "displaced_households_threshold": 500,
            "water_disruption_palikas_threshold": 3,
            "shelter_need_households_threshold": 200,
            "refresh_seconds": 60,
        }
    ]


def build_expected_rows(expected: list[dict[str, str]]) -> list[dict[str, object]]:
    return [
        {
            "event_id": EVENT_ID,
            "palika_id": row["palika_id"],
            "palika_name_ne": row["palika_full_name_ne"],
            "palika_name_en": row["palika_full_name_en"],
            "district_ne": row["district_ne"],
            "district_en": row["district_en"],
            "province_ne": row["province_ne"],
            "province_en": row["province_en"],
        }
        for row in expected
    ]


def metric(seed: int, low: int, high: int) -> int:
    span = high - low + 1
    return low + ((seed * 37 + 11) % span)


def blank_if(condition: bool, value: int | str) -> int | str:
    return "" if condition else value


def build_submissions(expected: list[dict[str, str]]) -> list[dict[str, object]]:
    outstanding_indexes = {4, 9, 15, 21, 24}
    submitted = [row for index, row in enumerate(expected) if index not in outstanding_indexes]
    base_time = datetime(2026, 6, 11, 8, 15, tzinfo=timezone(timedelta(hours=5, minutes=45)))
    rows: list[dict[str, object]] = []

    for index, palika in enumerate(submitted):
        district = palika["district_en"]
        severe = district == "Jajarkot" or index in {0, 3, 12}
        moderate = district == "Salyan"
        submission_type = ["Direct", "Photo", "Voice", "Direct", "Photo"][index % 5]
        deaths = metric(index, 1, 7) if severe else metric(index, 0, 2)
        missing = metric(index, 0, 3) if severe else metric(index, 0, 1)
        injured = metric(index, 28, 92) if severe else metric(index, 4, 36)
        displaced = metric(index, 85, 230) if severe else metric(index, 8, 82)
        total_affected = displaced * metric(index, 4, 7) + injured * 3
        private_full = metric(index, 32, 125) if severe else metric(index, 0, 26)
        private_partial = private_full + metric(index, 40, 180)
        govt_full = metric(index, 0, 3) if severe else metric(index, 0, 1)
        public_full = metric(index, 1, 5) if severe else metric(index, 0, 2)
        immediate_shelter = displaced + metric(index, 20, 95) if severe or moderate else metric(index, 0, 45)
        water_disrupted = severe or index in {1, 6, 10, 18}
        comms_disrupted = severe or index in {2, 8, 13}

        rows.append(
            {
                "event_id": EVENT_ID,
                "event_name_ne": EVENT_NAME_NE,
                "event_name_en": EVENT_NAME_EN,
                "palika_id": palika["palika_id"],
                "palika_name_ne": palika["palika_full_name_ne"],
                "palika_name_en": palika["palika_full_name_en"],
                "district_ne": palika["district_ne"],
                "district_en": palika["district_en"],
                "province_ne": palika["province_ne"],
                "province_en": palika["province_en"],
                "submitted_at": (base_time + timedelta(minutes=index * 17)).isoformat(),
                "operator_name": f"DEOC Operator {index + 1}" if submission_type != "Direct" else f"{palika['palika_name_en']} Focal Person",
                "submission_type": submission_type,
                "submission_type_ne": TYPE_NE[submission_type],
                "is_proxy": "TRUE" if submission_type in {"Photo", "Voice"} else "FALSE",
                "duplicate_status": "",
                "override_duplicate": "",
                "deaths": deaths,
                "missing": missing,
                "injured": injured,
                "displaced_households": displaced,
                "total_affected_population": total_affected,
                "rescue_ongoing_wards": metric(index, 0, 5) if severe else metric(index, 0, 2),
                "rescue_completed_wards": metric(index, 1, 7),
                "total_rescued": metric(index, 15, 165) if severe else metric(index, 0, 42),
                "shelter_households_schools": blank_if(index in {6, 14}, metric(index, 0, 70)),
                "shelter_households_public_buildings": metric(index, 0, 55),
                "shelter_households_relatives": metric(index, 8, 140),
                "shelter_households_open_areas": metric(index, 0, 95) if severe else metric(index, 0, 24),
                "immediate_shelter_need_households": immediate_shelter,
                "communications_disrupted": "TRUE" if comms_disrupted else "FALSE",
                "electricity_disrupted": blank_if(index in {5, 16}, "TRUE" if severe or moderate else "FALSE"),
                "water_supply_disrupted": "TRUE" if water_disrupted else "FALSE",
                "water_disruption_households": metric(index, 90, 640) if water_disrupted else 0,
                "private_houses_fully_damaged": private_full,
                "private_houses_partially_damaged": private_partial,
                "government_buildings_fully_damaged": govt_full,
                "government_buildings_partially_damaged": blank_if(index in {3, 11}, metric(index, 0, 5)),
                "public_buildings_fully_damaged": public_full,
                "public_buildings_partially_damaged": metric(index, 0, 8),
                "tents_needed": max(0, immediate_shelter - metric(index, 5, 40)),
                "tarpaulins_needed": immediate_shelter + metric(index, 15, 120),
                "food_packages_needed": displaced + metric(index, 20, 180),
                "blankets_needed": displaced * 2 + metric(index, 25, 240),
                "drinking_water_people": metric(index, 300, 2600) if water_disrupted else metric(index, 0, 250),
            }
        )
    return rows


def main() -> None:
    master = read_master()
    expected = event_palikas(master)
    event_config = build_event_config(expected)
    expected_rows = build_expected_rows(expected)
    submissions = build_submissions(expected)

    write_csv(DATA_DIR / "event_config.csv", event_config, list(event_config[0].keys()))
    write_csv(DATA_DIR / "expected_palikas.csv", expected_rows, list(expected_rows[0].keys()))
    write_csv(DATA_DIR / "mock_submissions.csv", submissions, SUBMISSION_COLUMNS)


if __name__ == "__main__":
    main()
