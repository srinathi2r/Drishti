import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Droplets,
  FileSpreadsheet,
  Home,
  Radio,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const localDataUrl = (fileName) => `${import.meta.env.BASE_URL}data/${fileName}`;

const DATA_URLS = {
  eventConfig: import.meta.env.VITE_EVENT_CONFIG_CSV_URL || localDataUrl("event_config.csv"),
  expectedPalikas:
    import.meta.env.VITE_EXPECTED_PALIKAS_CSV_URL || localDataUrl("expected_palikas.csv"),
  liveSubmissions: import.meta.env.VITE_SHEETS_CSV_URL || import.meta.env.VITE_SUBMISSIONS_CSV_URL || "",
  mockSubmissions: localDataUrl("mock_submissions.csv"),
  palikaMaster: import.meta.env.VITE_PALIKA_MASTER_CSV_URL || localDataUrl("palika_master.csv"),
};

const DATA_SOURCE_BADGES = {
  live: {
    label: "Live Data / लाइभ डेटा",
    style: {
      background: "#dcfce7",
      border: "1px solid #86efac",
      color: "#166534",
    },
  },
  demo: {
    label: "Demo Data / डेमो डेटा",
    style: {
      background: "#fef3c7",
      border: "1px solid #f59e0b",
      color: "#92400e",
    },
  },
};

const SUMMARY_CARDS = [
  { key: "deaths", ne: "मृत्यु", en: "Deaths", icon: ShieldAlert, tone: "danger" },
  { key: "missing", ne: "बेपत्ता", en: "Missing", icon: AlertTriangle, tone: "warning" },
  { key: "injured", ne: "घाइते", en: "Injured", icon: Users, tone: "orange" },
  {
    key: "displacedHouseholds",
    ne: "विस्थापित घरधुरी",
    en: "Displaced Households",
    icon: Home,
    tone: "teal",
  },
  {
    key: "fullyDamagedStructures",
    ne: "पूर्ण क्षति भएका संरचना",
    en: "Fully Damaged Structures",
    icon: Home,
    tone: "danger",
  },
  {
    key: "partiallyDamagedStructures",
    ne: "आंशिक क्षति",
    en: "Partially Damaged Structures",
    icon: Home,
    tone: "warning",
  },
  {
    key: "immediateShelterNeed",
    ne: "तत्काल आश्रय आवश्यकता",
    en: "Immediate Shelter Need",
    icon: Home,
    tone: "teal",
  },
  {
    key: "waterDisruptedPalikas",
    ne: "खानेपानी अवरुद्ध",
    en: "Water Disruption",
    icon: Droplets,
    tone: "teal",
    suffixNe: "पालिका",
    suffixEn: "palikas",
  },
  {
    key: "communicationsDisruptedPalikas",
    ne: "संचार अवरुद्ध",
    en: "Communications Disruption",
    icon: Radio,
    tone: "orange",
    suffixNe: "पालिका",
    suffixEn: "palikas",
  },
];

const NEED_CARDS = [
  { key: "tentsNeeded", ne: "टेन्ट संख्या", en: "Tents needed" },
  { key: "tarpaulinsNeeded", ne: "त्रिपाल", en: "Tarpaulins needed" },
  { key: "foodPackagesNeeded", ne: "दाल, चामल, घिउ, तेल", en: "Food packages needed" },
  { key: "blanketsNeeded", ne: "कम्बल थान", en: "Blankets needed" },
  { key: "drinkingWaterPeople", ne: "पिउने पानी", en: "Drinking water needed" },
];

const SUBMISSION_TYPES = {
  Direct: { ne: "सिधा", en: "Direct" },
  Photo: { ne: "कागजको फारामको फोटो", en: "Photo of paper form" },
  Voice: { ne: "फोन कल", en: "Voice call" },
};

const DISASTER_TYPE_HINTS = [
  { key: "earthquake", ne: "भूकम्प", en: "Earthquake", tokens: ["earthquake", "quake", "eq", "भूकम्प"] },
  { key: "flood", ne: "बाढी", en: "Flood", tokens: ["flood", "flooding", "बाढी"] },
  { key: "landslide", ne: "पहिरो", en: "Landslide", tokens: ["landslide", "पहिरो"] },
  { key: "fire", ne: "आगलागी", en: "Fire", tokens: ["fire", "आगलागी"] },
  { key: "storm", ne: "हावाहुरी", en: "Storm", tokens: ["storm", "windstorm", "हावाहुरी"] },
];

const DETAIL_SECTIONS = [
  {
    ne: "१. प्रभावित जनसंख्या",
    en: "Affected Population",
    fields: [
      { key: "deaths", ne: "मृत्यु", en: "Deaths" },
      { key: "missing", ne: "बेपत्ता", en: "Missing" },
      { key: "injured", ne: "घाइते", en: "Injured" },
      { key: "displaced_households", ne: "विस्थापित घरधुरी", en: "Displaced households" },
      { key: "total_affected_population", ne: "कुल प्रभावित जनसंख्या", en: "Total affected population" },
    ],
  },
  {
    ne: "२. खोज तथा उद्धार",
    en: "Search and Rescue",
    fields: [
      { key: "rescue_ongoing_wards", ne: "उद्धार कार्य भइरहेको वडा संख्या", en: "Wards with rescue ongoing" },
      { key: "rescue_completed_wards", ne: "उद्धार कार्य सकिएको वडा संख्या", en: "Wards with rescue completed" },
      { key: "total_rescued", ne: "उद्धार संख्या", en: "Total rescued" },
    ],
  },
  {
    ne: "३. अस्थायी आश्रय",
    en: "Temporary Shelter",
    fields: [
      { key: "shelter_households_schools", ne: "विद्यालयमा आश्रित घरधुरी", en: "Households in schools" },
      { key: "shelter_households_public_buildings", ne: "सार्वजनिक भवनमा", en: "Households in public buildings" },
      { key: "shelter_households_relatives", ne: "आफन्त/छिमेकीमा", en: "Households with relatives" },
      { key: "shelter_households_open_areas", ne: "खुला क्षेत्रमा", en: "Households in open areas" },
      { key: "immediate_shelter_need_households", ne: "तत्काल अस्थायी आवासको आवश्यकता", en: "Immediate shelter need" },
    ],
  },
  {
    ne: "५. संचार तथा विद्युत",
    en: "Communications and Electricity",
    fields: [
      { key: "communications_disrupted", ne: "संचार सेवा अवरुद्ध", en: "Communications disrupted", type: "boolean" },
      { key: "electricity_disrupted", ne: "विद्युत सेवा अवरुद्ध", en: "Electricity disrupted", type: "boolean" },
    ],
  },
  {
    ne: "९. खानेपानीको आपूर्ति",
    en: "Water Supply",
    fields: [
      { key: "water_supply_disrupted", ne: "खानेपानी आपूर्ति अवरुद्ध", en: "Water supply disrupted", type: "boolean" },
      { key: "water_disruption_households", ne: "अवरुद्ध भएको घरधुरी", en: "Households affected by water disruption" },
    ],
  },
  {
    ne: "११. भौतिक संरचना",
    en: "Physical Structures",
    fields: [
      { key: "private_houses_fully_damaged", ne: "निजी घर पूर्ण क्षति", en: "Private houses fully damaged" },
      { key: "private_houses_partially_damaged", ne: "निजी घर आंशिक क्षति", en: "Private houses partially damaged" },
      { key: "government_buildings_fully_damaged", ne: "सरकारी कार्यालय पूर्ण क्षति", en: "Government buildings fully damaged" },
      { key: "government_buildings_partially_damaged", ne: "सरकारी कार्यालय आंशिक क्षति", en: "Government buildings partially damaged" },
      { key: "public_buildings_fully_damaged", ne: "सार्वजनिक भवन पूर्ण क्षति", en: "Public buildings fully damaged" },
      { key: "public_buildings_partially_damaged", ne: "सार्वजनिक भवन आंशिक क्षति", en: "Public buildings partially damaged" },
    ],
  },
  {
    ne: "१४. तत्काल आवश्यकता",
    en: "Immediate Needs",
    fields: [
      { key: "tents_needed", ne: "टेन्ट संख्या", en: "Tents needed" },
      { key: "tarpaulins_needed", ne: "त्रिपाल", en: "Tarpaulins needed" },
      { key: "food_packages_needed", ne: "दाल, चामल, घिउ, तेल", en: "Food packages needed" },
      { key: "blankets_needed", ne: "कम्बल थान", en: "Blankets needed" },
      { key: "drinking_water_people", ne: "पिउने पानी", en: "Drinking water needed" },
    ],
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""])),
  );
}

async function fetchCsv(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return parseCsv(await response.text());
}

async function fetchSubmissionsCsv(mode = "live") {
  if (mode === "demo") {
    const rows = await fetchCsv(DATA_URLS.mockSubmissions);
    return { rows, source: "demo" };
  }

  const liveUrl = String(DATA_URLS.liveSubmissions || "").trim();
  let liveError = "";

  if (liveUrl) {
    try {
      const rows = await fetchCsv(liveUrl);
      if (rows.length) {
        return { rows, source: "live" };
      }
      liveError = "Live submissions CSV returned no rows";
    } catch (err) {
      liveError = `Live submissions CSV failed: ${err.message || String(err)}`;
    }
  }

  try {
    const rows = await fetchCsv(DATA_URLS.mockSubmissions);
    return { rows, source: "demo" };
  } catch (err) {
    const mockError = `Demo submissions CSV failed: ${err.message || String(err)}`;
    throw new Error(liveError ? `${liveError}; ${mockError}` : mockError);
  }
}

function Bi({ ne, en, className = "" }) {
  return (
    <span className={`bi ${className}`}>
      <span lang="ne">{ne}</span>
      <span>{en}</span>
    </span>
  );
}

function truthy(value) {
  return ["true", "yes", "1", "हो"].includes(String(value).trim().toLowerCase());
}

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function districtTabKey(value) {
  return (
    String(value || "unknown")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

function buildDistrictTabs(rows) {
  const districts = new Map();

  rows.forEach((row) => {
    const districtEn = String(row.district_en || "").trim();
    const districtNe = String(row.district_ne || "").trim();
    const label = districtEn || districtNe;
    if (!label) return;

    const key = districtTabKey(label);
    if (!districts.has(key)) {
      districts.set(key, {
        key,
        districtEn,
        ne: districtNe || label,
        en: districtEn || label,
      });
    }
  });

  return [
    { key: "all", districtEn: "", ne: "सबै", en: "All" },
    ...Array.from(districts.values()).sort((a, b) => a.en.localeCompare(b.en)),
  ];
}

function districtSummaryLabel(districtTabs) {
  const districts = districtTabs.filter((tab) => tab.districtEn);
  if (!districts.length) return { ne: "—", en: "—" };
  if (districts.length > 6) {
    const count = formatNumber(districts.length);
    return { ne: `${count} जिल्ला`, en: `${count} districts` };
  }
  return {
    ne: districts.map((district) => district.ne).join("; "),
    en: districts.map((district) => district.en).join("; "),
  };
}

function districtMatches(row, districtEn) {
  return !districtEn || row.district_en === districtEn;
}

function buildTrackerRows(expectedRows, submittedRows, latestByPalika) {
  const expectedIds = new Set(expectedRows.map((palika) => palika.palika_id));
  const expectedTrackerRows = expectedRows.map((palika) => ({
    ...palika,
    expected: true,
    submission: latestByPalika.get(palika.palika_id),
  }));
  const additionalSubmittedRows = submittedRows
    .filter((submission) => !expectedIds.has(submission.palika_id))
    .map((submission) => ({
      event_id: submission.event_id,
      palika_id: submission.palika_id,
      palika_name_ne: submission.palika_name_ne,
      palika_name_en: submission.palika_name_en,
      district_ne: submission.district_ne,
      district_en: submission.district_en,
      province_ne: submission.province_ne,
      province_en: submission.province_en,
      expected: false,
      submission,
    }));

  return [...expectedTrackerRows, ...additionalSubmittedRows];
}

function formatDetailValue(row, field) {
  const raw = row?.[field.key];
  if (raw === undefined || raw === null || String(raw).trim() === "") return "—";
  if (field.type === "boolean") {
    return truthy(raw) ? "हो / Yes" : "होइन / No";
  }
  return formatNumber(toNumber(raw));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date);
  return `${formatted} NPT`;
}

function eventMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "Asia/Kathmandu",
    year: "numeric",
  }).format(date);
}

function eventMonthRangeLabel(rows) {
  const dates = rows
    .map((row) => new Date(row.submitted_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dates.length) return "";

  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return eventMonthLabel(first);
  }

  return `${eventMonthLabel(first)} - ${eventMonthLabel(last)}`;
}

function hintMatchesToken(text, token) {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const normalizedToken = String(token || "").normalize("NFKC").toLowerCase();
  if (!normalizedToken) return false;
  if (/^[a-z0-9]+$/.test(normalizedToken)) {
    return new RegExp(`(^|[^a-z0-9])${normalizedToken}([^a-z0-9]|$)`).test(normalized);
  }
  return normalized.includes(normalizedToken);
}

function disasterTypeFromRow(row) {
  const explicitNe = row.disaster_type_ne || row.hazard_type_ne || row.incident_type_ne || row.event_type_ne || "";
  const explicitEn = row.disaster_type_en || row.hazard_type_en || row.incident_type_en || row.event_type_en || "";
  const explicitLabel = `${explicitNe} ${explicitEn}`.trim();
  const inferredLabel = [row.event_id].filter(Boolean).join(" ");
  const label = explicitLabel || inferredLabel;
  const knownType = DISASTER_TYPE_HINTS.find((type) =>
    type.tokens.some((token) => hintMatchesToken(label, token)),
  );

  if (knownType) return knownType;
  if (explicitNe || explicitEn) {
    const fallback = explicitEn || explicitNe;
    return {
      key: fallback.normalize("NFKC").toLowerCase(),
      ne: explicitNe || fallback,
      en: explicitEn || fallback,
    };
  }
  return null;
}

function inferredEventLabel(rows, source) {
  if (source !== "live" || !rows.length) {
    return { ne: "कुनै सक्रिय घटना छैन", en: "No active event", placeholder: true };
  }

  const dateRange = eventMonthRangeLabel(rows);
  if (!dateRange) {
    return { ne: "कुनै सक्रिय घटना छैन", en: "No active event", placeholder: true };
  }

  const counts = new Map();
  rows.forEach((row) => {
    const disasterType = disasterTypeFromRow(row);
    if (!disasterType) return;
    const current = counts.get(disasterType.key) || { disasterType, count: 0 };
    counts.set(disasterType.key, { ...current, count: current.count + 1 });
  });

  const mostFrequent = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]?.disasterType || {
    ne: "घटना",
    en: "Event",
  };

  return {
    ne: `${mostFrequent.ne} घटना - ${dateRange}`,
    en: `${mostFrequent.en} Event - ${dateRange}`,
    placeholder: false,
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadFile(name, body, type) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function metricSum(rows, key) {
  return rows.reduce((total, row) => total + toNumber(row[key]), 0);
}

function latestSubmissions(submissions) {
  const latest = new Map();
  submissions.forEach((row) => {
    const duplicateNeedsReview = row.duplicate_status && !truthy(row.override_duplicate);
    if (duplicateNeedsReview) return;
    const existing = latest.get(row.palika_id);
    if (!existing || new Date(row.submitted_at) > new Date(existing.submitted_at)) {
      latest.set(row.palika_id, row);
    }
  });
  return latest;
}

function buildSummary(rows) {
  return {
    deaths: metricSum(rows, "deaths"),
    missing: metricSum(rows, "missing"),
    injured: metricSum(rows, "injured"),
    displacedHouseholds: metricSum(rows, "displaced_households"),
    fullyDamagedStructures:
      metricSum(rows, "private_houses_fully_damaged") +
      metricSum(rows, "government_buildings_fully_damaged") +
      metricSum(rows, "public_buildings_fully_damaged"),
    partiallyDamagedStructures:
      metricSum(rows, "private_houses_partially_damaged") +
      metricSum(rows, "government_buildings_partially_damaged") +
      metricSum(rows, "public_buildings_partially_damaged"),
    immediateShelterNeed: metricSum(rows, "immediate_shelter_need_households"),
    waterDisruptedPalikas: rows.filter((row) => truthy(row.water_supply_disrupted)).length,
    communicationsDisruptedPalikas: rows.filter((row) => truthy(row.communications_disrupted)).length,
    tentsNeeded: metricSum(rows, "tents_needed"),
    tarpaulinsNeeded: metricSum(rows, "tarpaulins_needed"),
    foodPackagesNeeded: metricSum(rows, "food_packages_needed"),
    blanketsNeeded: metricSum(rows, "blankets_needed"),
    drinkingWaterPeople: metricSum(rows, "drinking_water_people"),
  };
}

function MetricCard({ card, value }) {
  const Icon = card.icon;
  return (
    <article className={`metric-card ${card.tone}`}>
      <div className="metric-icon" aria-hidden="true">
        <Icon size={22} />
      </div>
      <Bi ne={card.ne} en={card.en} className="metric-title" />
      <div className="metric-value">{formatNumber(value)}</div>
      {card.suffixNe ? (
        <div className="metric-suffix">
          {card.suffixNe} / {card.suffixEn}
        </div>
      ) : null}
    </article>
  );
}

function SectionTitle({ ne, en, right }) {
  return (
    <div className="section-title">
      <Bi ne={ne} en={en} />
      {right}
    </div>
  );
}

function PalikaDetailPanel({ submission, onClose }) {
  const type = SUBMISSION_TYPES[submission.submission_type] || {
    ne: submission.submission_type_ne || "—",
    en: submission.submission_type || "—",
  };

  return (
    <div className="panel detail-panel">
      <div className="detail-header">
        <div>
          <p className="detail-eyebrow">पालिका विवरण / Palika detail</p>
          <h2>
            <span lang="ne">{submission.palika_name_ne}</span>
            <span>{submission.palika_name_en}</span>
          </h2>
          <div className="detail-meta">
            <span>
              <Bi ne="जिल्ला" en="District" />
              <strong>{submission.district_ne} / {submission.district_en}</strong>
            </span>
            <span>
              <Bi ne="समय" en="Time" />
              <strong>{formatDate(submission.submitted_at)}</strong>
            </span>
            <span>
              <Bi ne="तरिका" en="Type" />
              <strong>{type.ne} / {type.en}</strong>
            </span>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="बन्द / Close">
          <XCircle size={22} />
          <Bi ne="बन्द" en="Close" />
        </button>
      </div>

      <div className="detail-sections">
        {DETAIL_SECTIONS.map((section) => (
          <section className="detail-section" key={section.en}>
            <h3>
              <Bi ne={section.ne} en={section.en} />
            </h3>
            <div className="detail-grid">
              {section.fields.map((field) => (
                <div className="detail-item" key={field.key}>
                  <Bi ne={field.ne} en={field.en} />
                  <strong>{formatDetailValue(submission, field)}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExportModal({ onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-icon" aria-hidden="true">
          <FileSpreadsheet size={26} />
        </div>
        <h2>
          <Bi ne="समन्वयकर्ता पुष्टि" en="Coordinator confirmation" />
        </h2>
        <p>
          <span lang="ne">कृपया पुष्टि गर्नुहोस्: यो निर्यात सक्रिय घटनाको आधिकारिक सारांश हो।</span>
          <span>
            Please confirm: this export is the official summary for the active event.
          </span>
        </p>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            <XCircle size={18} />
            <Bi ne="रद्द" en="Cancel" />
          </button>
          <button className="button primary" type="button" onClick={onConfirm}>
            <Download size={18} />
            <Bi ne="पुष्टि गरी निर्यात" en="Confirm export" />
          </button>
        </div>
      </div>
    </div>
  );
}

function printableSummaryHtml({
  eventLabel = { ne: "कुनै सक्रिय घटना छैन", en: "No active event" },
  districtSummary = { ne: "—", en: "—" },
  summary,
  rows,
  expectedCount,
  lastUpdated,
}) {
  const summaryLines = SUMMARY_CARDS.map((card) => [
    `${card.ne} / ${card.en}`,
    formatNumber(summary[card.key]),
  ]);
  const needLines = NEED_CARDS.map((card) => [`${card.ne} / ${card.en}`, formatNumber(summary[card.key])]);
  const submissionLines = rows.map((row) => [
    `${row.palika_name_ne} / ${row.palika_name_en}`,
    `${row.district_ne} / ${row.district_en}`,
    formatDate(row.submitted_at),
    `${SUBMISSION_TYPES[row.submission_type]?.ne || row.submission_type_ne || row.submission_type} / ${
      SUBMISSION_TYPES[row.submission_type]?.en || row.submission_type
    }`,
  ]);

  const rowHtml = (items) => `<tr>${items.map((item) => `<td>${item}</td>`).join("")}</tr>`;

  return `<!doctype html>
<html lang="ne">
<head>
<meta charset="utf-8">
<title>Disaster Situation Dashboard Export</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "Kohinoor Devanagari", "Devanagari Sangam MN", Arial, sans-serif; color: #17201c; }
  h1, h2 { margin: 0 0 8px; }
  h1 { font-size: 22px; }
  h2 { font-size: 15px; margin-top: 18px; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #aeb8b3; padding: 6px; text-align: left; vertical-align: top; }
  th { background: #e8efeb; }
  .meta { margin: 12px 0; padding: 10px; border: 1px solid #aeb8b3; }
</style>
</head>
<body>
  <h1>विपद् स्थिति ड्यासबोर्ड / Disaster Situation Dashboard</h1>
  <p>संघीय मामिला तथा सामान्य प्रशासन मन्त्रालय / Ministry of Federal Affairs and General Administration</p>
  <div class="meta">
    <p><strong>घटना / Event:</strong> ${eventLabel.ne} / ${eventLabel.en}</p>
    <p><strong>जिल्ला / Districts:</strong> ${districtSummary.ne} / ${districtSummary.en}</p>
    <p><strong>रिपोर्टिङ / Reporting:</strong> ${rows.length} / ${expectedCount}</p>
    <p><strong>अन्तिम अद्यावधिक / Last updated:</strong> ${lastUpdated}</p>
  </div>
  <h2>सारांश / Summary</h2>
  <table><tbody>${summaryLines.map(rowHtml).join("")}</tbody></table>
  <h2>तत्काल आवश्यकता / Immediate Needs</h2>
  <table><tbody>${needLines.map(rowHtml).join("")}</tbody></table>
  <h2>पेश गर्ने पालिका / Reporting Palikas</h2>
  <table>
    <thead><tr><th>पालिका / Palika</th><th>जिल्ला / District</th><th>समय / Time</th><th>तरिका / Type</th></tr></thead>
    <tbody>${submissionLines.map(rowHtml).join("")}</tbody>
  </table>
</body>
</html>`;
}

function App() {
  const [data, setData] = useState({
    eventConfig: [],
    expectedPalikas: [],
    submissions: [],
    palikaMaster: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [submissionMode, setSubmissionMode] = useState("live");
  const [submissionSource, setSubmissionSource] = useState("demo");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedPalikaId, setSelectedPalikaId] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [eventConfig, expectedPalikas, submissionsResult, palikaMaster] = await Promise.all([
        fetchCsv(DATA_URLS.eventConfig),
        fetchCsv(DATA_URLS.expectedPalikas),
        fetchSubmissionsCsv(submissionMode),
        fetchCsv(DATA_URLS.palikaMaster),
      ]);
      setData({ eventConfig, expectedPalikas, submissions: submissionsResult.rows, palikaMaster });
      setSubmissionSource(submissionsResult.source);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [submissionMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeEvent = useMemo(
    () => data.eventConfig.find((row) => truthy(row.active)) || data.eventConfig[0] || {},
    [data.eventConfig],
  );

  useEffect(() => {
    const refreshSeconds = Math.max(15, toNumber(activeEvent.refresh_seconds) || 60);
    const timer = window.setInterval(loadData, refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [activeEvent.refresh_seconds, loadData]);

  const scopedExpected = useMemo(() => {
    const fromExpected = data.expectedPalikas.filter((row) => row.event_id === activeEvent.event_id);
    if (fromExpected.length) return fromExpected;
    const expectedIds = String(activeEvent.expected_palika_ids || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    return data.palikaMaster
      .filter((row) => expectedIds.includes(row.palika_id))
      .map((row) => ({
        event_id: activeEvent.event_id,
        palika_id: row.palika_id,
        palika_name_ne: row.palika_full_name_ne,
        palika_name_en: row.palika_full_name_en,
        district_ne: row.district_ne,
        district_en: row.district_en,
        province_ne: row.province_ne,
        province_en: row.province_en,
      }));
  }, [activeEvent, data.expectedPalikas, data.palikaMaster]);

  const scopedSubmissions = useMemo(
    () => data.submissions.filter((row) => row.event_id === activeEvent.event_id),
    [activeEvent.event_id, data.submissions],
  );

  const latestByPalika = useMemo(() => latestSubmissions(scopedSubmissions), [scopedSubmissions]);
  const submittedRows = useMemo(() => Array.from(latestByPalika.values()), [latestByPalika]);
  const eventLabel = useMemo(
    () => inferredEventLabel(submittedRows, submissionSource),
    [submittedRows, submissionSource],
  );
  const districtTabs = useMemo(() => buildDistrictTabs(submittedRows), [submittedRows]);
  // TODO: If district count regularly exceeds ~12, replace scrolling tabs with All + searchable district dropdown.
  const districtSummary = useMemo(() => districtSummaryLabel(districtTabs), [districtTabs]);
  const activeDistrict = useMemo(
    () => districtTabs.find((tab) => tab.key === selectedDistrict) || districtTabs[0],
    [districtTabs, selectedDistrict],
  );
  useEffect(() => {
    if (!districtTabs.some((tab) => tab.key === selectedDistrict)) {
      setSelectedDistrict("all");
      setSelectedPalikaId("");
    }
  }, [districtTabs, selectedDistrict]);
  const filteredExpected = useMemo(
    () =>
      activeDistrict.districtEn
        ? scopedExpected.filter((row) => districtMatches(row, activeDistrict.districtEn))
        : scopedExpected,
    [activeDistrict.districtEn, scopedExpected],
  );
  const filteredSubmittedRows = useMemo(
    () =>
      activeDistrict.districtEn
        ? submittedRows.filter((row) => districtMatches(row, activeDistrict.districtEn))
        : submittedRows,
    [activeDistrict.districtEn, submittedRows],
  );
  const summary = useMemo(() => buildSummary(filteredSubmittedRows), [filteredSubmittedRows]);
  const exportTrackerRows = useMemo(
    () => buildTrackerRows(scopedExpected, submittedRows, latestByPalika),
    [scopedExpected, submittedRows, latestByPalika],
  );
  const exportSubmittedRows = useMemo(
    () => exportTrackerRows.map((row) => row.submission).filter(Boolean),
    [exportTrackerRows],
  );
  const allSummary = useMemo(() => buildSummary(exportSubmittedRows), [exportSubmittedRows]);
  const districtBreakdowns = useMemo(
    () =>
      districtTabs.filter((tab) => tab.districtEn).map((tab) => {
        const districtRows = exportTrackerRows.filter((row) => districtMatches(row, tab.districtEn));
        const expectedRows = districtRows.filter((row) => row.expected);
        const districtSubmittedRows = districtRows.map((row) => row.submission).filter(Boolean);
        return {
          ...tab,
          expectedCount: expectedRows.length,
          submittedCount: districtSubmittedRows.length,
          summary: buildSummary(districtSubmittedRows),
        };
      }),
    [districtTabs, exportTrackerRows],
  );

  const lastUpdated = useMemo(() => {
    const dates = submittedRows
      .map((row) => new Date(row.submitted_at))
      .filter((date) => !Number.isNaN(date.getTime()));
    if (!dates.length) return "—";
    return formatDate(new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString());
  }, [submittedRows]);

  const thresholds = useMemo(
    () => ({
      deaths: toNumber(activeEvent.deaths_threshold) || 10,
      displacedHouseholds: toNumber(activeEvent.displaced_households_threshold) || 500,
      waterDisruptedPalikas: toNumber(activeEvent.water_disruption_palikas_threshold) || 3,
      immediateShelterNeed: toNumber(activeEvent.shelter_need_households_threshold) || 200,
    }),
    [activeEvent],
  );

  const criticalFlags = useMemo(
    () =>
      [
        {
          ne: "मृत्यु सीमा नाघेको",
          en: "Deaths threshold exceeded",
          value: summary.deaths,
          threshold: thresholds.deaths,
        },
        {
          ne: "विस्थापित घरधुरी सीमा नाघेको",
          en: "Displaced households threshold exceeded",
          value: summary.displacedHouseholds,
          threshold: thresholds.displacedHouseholds,
        },
        {
          ne: "खानेपानी अवरुद्ध पालिका सीमा नाघेको",
          en: "Water disruption palika threshold exceeded",
          value: summary.waterDisruptedPalikas,
          threshold: thresholds.waterDisruptedPalikas,
        },
        {
          ne: "तत्काल आश्रय आवश्यकता सीमा नाघेको",
          en: "Immediate shelter need threshold exceeded",
          value: summary.immediateShelterNeed,
          threshold: thresholds.immediateShelterNeed,
        },
      ].filter((flag) => flag.value > flag.threshold),
    [summary, thresholds],
  );

  const trackerRows = useMemo(
    () => buildTrackerRows(filteredExpected, filteredSubmittedRows, latestByPalika),
    [filteredExpected, filteredSubmittedRows, latestByPalika],
  );
  const filteredExpectedSubmittedCount = useMemo(
    () => trackerRows.filter((row) => row.expected && row.submission).length,
    [trackerRows],
  );
  const filteredAdditionalSubmittedCount = useMemo(
    () => trackerRows.filter((row) => row.expected === false && row.submission).length,
    [trackerRows],
  );
  const selectedSubmission = selectedPalikaId ? latestByPalika.get(selectedPalikaId) : null;

  const selectDistrict = (districtKey) => {
    setSelectedDistrict(districtKey);
    setSelectedPalikaId("");
  };

  const toggleSubmissionMode = () => {
    setLoading(true);
    setSelectedPalikaId("");
    setSubmissionMode((mode) => (mode === "live" ? "demo" : "live"));
  };

  const sourceBadge = DATA_SOURCE_BADGES[submissionSource] || DATA_SOURCE_BADGES.demo;
  const toggleLabel =
    submissionMode === "live" ? "डेमो हेर्नुहोस् / View Demo" : "लाइभ हेर्नुहोस् / View Live";

  const exportSummary = () => {
    setExportModalOpen(false);
    const exportTimestamp = formatDate(new Date().toISOString());
    const summaryRows = [
      ["विपद् स्थिति ड्यासबोर्ड निर्यात / Disaster Situation Dashboard Export", ""],
      ["घटना / Event", `${eventLabel.ne} / ${eventLabel.en}`],
      ["जिल्ला / Districts", `${districtSummary.ne} / ${districtSummary.en}`],
      ["कुल अपेक्षित पालिका / Total expected palikas", scopedExpected.length],
      ["रिपोर्ट गरेका पालिका / Reporting palikas", exportSubmittedRows.length],
      ["निर्यात समय / Export timestamp", exportTimestamp],
      ["समन्वयकर्ताद्वारा पुष्टि / Confirmed by coordinator", "हो / Yes"],
      [],
      ["खण्ड १ -- सबै जिल्ला संयुक्त / Section 1 -- All Districts Combined"],
      ["सूचक / Indicator", "जम्मा / Total"],
      ...SUMMARY_CARDS.map((card) => [`${card.ne} / ${card.en}`, allSummary[card.key]]),
      [],
      ["खण्ड २ -- तत्काल आवश्यकता संयुक्त / Section 2 -- Immediate Needs Combined"],
      ["सूचक / Indicator", "जम्मा / Total"],
      ...NEED_CARDS.map((card) => [`${card.ne} / ${card.en}`, allSummary[card.key]]),
      [],
      ["खण्ड ३ -- जिल्ला विवरण / Section 3 -- District Breakdown"],
      ...districtBreakdowns.flatMap((district) => [
        [],
        [`जिल्ला / District`, `${district.ne} / ${district.en}`],
        ["रिपोर्टिङ / Reporting", `${district.submittedCount} / ${district.expectedCount}`],
        ["सूचक / Indicator", "जम्मा / Total"],
        ...SUMMARY_CARDS.map((card) => [`${card.ne} / ${card.en}`, district.summary[card.key]]),
      ]),
      [],
      ["खण्ड ४ -- पेश स्थिति / Section 4 -- Submission Status"],
      [
        "स्थिति / Status",
        "पालिका / Palika",
        "जिल्ला / District",
        "पेश समय / Submission time",
        "पेश प्रकार / Submission type",
      ],
      ...exportTrackerRows.map((row) => {
        const submitted = Boolean(row.submission);
        const type = SUBMISSION_TYPES[row.submission?.submission_type] || {
          ne: row.submission?.submission_type_ne || "—",
          en: row.submission?.submission_type || "—",
        };
        return [
          submitted ? "प्राप्त / Submitted" : "बाँकी / Outstanding",
          `${row.palika_name_ne} / ${row.palika_name_en}${row.expected === false ? " (scope बाहिर / outside scope)" : ""}`,
          `${row.district_ne} / ${row.district_en}`,
          submitted ? formatDate(row.submission.submitted_at) : "—",
          submitted ? `${type.ne} / ${type.en}` : "—",
        ];
      }),
    ];
    const csv = `\ufeff${summaryRows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
    downloadFile(`drishti-${activeEvent.event_id || "event"}-complete-summary.csv`, csv, "text/csv;charset=utf-8");
  };

  return (
    <main className="app-shell">
      <header className="event-header">
        <div>
          <h1>
            <span lang="ne">विपद् स्थिति ड्यासबोर्ड</span>
            <span>Disaster Situation Dashboard</span>
          </h1>
          <p className={`event-subtitle${eventLabel.placeholder ? " placeholder" : ""}`}>
            <span lang="ne">{eventLabel.ne}</span>
            <span>{eventLabel.en}</span>
          </p>
          <div className="event-meta">
            <span className="district-pill">
              <span className="meta-line" lang="ne">{districtSummary.ne}</span>
              <span className="meta-line meta-english">{districtSummary.en}</span>
            </span>
            <span>
              {formatNumber(scopedExpected.length)} <span lang="ne">अपेक्षित पालिका</span> / expected palikas
            </span>
            <span
              style={{
                ...sourceBadge.style,
                borderRadius: "999px",
                display: "inline-flex",
                fontSize: "0.78rem",
                fontWeight: 800,
                lineHeight: 1,
                padding: "0.42rem 0.65rem",
                whiteSpace: "nowrap",
              }}
            >
              {sourceBadge.label}
            </span>
            <button
              type="button"
              onClick={toggleSubmissionMode}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "999px",
                color: "#0f172a",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 800,
                lineHeight: 1,
                padding: "0.42rem 0.65rem",
                whiteSpace: "nowrap",
              }}
            >
              {toggleLabel}
            </button>
            <span className="time-pill">
              <Clock size={16} aria-hidden="true" />
              <span className="meta-line">
                <span lang="ne">अन्तिम अद्यावधिक</span>
                <span className="meta-english">Last updated</span>
                <span className="meta-time">{lastUpdated}</span>
              </span>
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button className="button secondary" type="button" onClick={loadData}>
            <RefreshCw size={18} />
            <Bi ne="ताजा गर्नुहोस्" en="Refresh" />
          </button>
          <button className="button primary" type="button" onClick={() => setExportModalOpen(true)}>
            <Download size={18} />
            <Bi ne="निर्यात" en="Export" />
          </button>
        </div>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          <AlertTriangle size={18} />
          <Bi ne="डेटा लोड हुन सकेन" en="Data could not be loaded" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="banner">
          <RefreshCw size={18} className="spin" />
          <Bi ne="डेटा लोड हुँदैछ" en="Loading data" />
        </div>
      ) : null}

      <nav className="district-tabs" aria-label="जिल्ला फिल्टर / District filter">
        {districtTabs.map((tab) => (
          <button
            className={`district-tab ${selectedDistrict === tab.key ? "active" : ""}`}
            type="button"
            key={tab.key}
            onClick={() => selectDistrict(tab.key)}
            aria-pressed={selectedDistrict === tab.key}
          >
            <Bi ne={tab.ne} en={tab.en} />
          </button>
        ))}
      </nav>

      <section className="summary-grid" aria-label="Summary">
        {SUMMARY_CARDS.map((card) => (
          <MetricCard key={card.key} card={card} value={summary[card.key]} />
        ))}
      </section>

      <section className="panel">
        <SectionTitle ne="तत्काल आवश्यकता" en="Immediate Needs" />
        <div className="needs-grid">
          {NEED_CARDS.map((card) => (
            <article className="need-card" key={card.key}>
              <Bi ne={card.ne} en={card.en} />
              <strong>{formatNumber(summary[card.key])}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <SectionTitle
            ne="पेश गर्ने पालिका ट्रयाकर"
            en="Submission Tracker"
            right={
              <span className="count-pill">
                {filteredExpectedSubmittedCount} / {filteredExpected.length}
                {filteredAdditionalSubmittedCount ? ` +${filteredAdditionalSubmittedCount}` : ""}
              </span>
            }
          />
          <p className="tracker-status">
            <span lang="ne">
              {filteredExpectedSubmittedCount} मध्ये {filteredExpected.length} अपेक्षित पालिकाले रिपोर्ट गरेका छन्
              {filteredAdditionalSubmittedCount
                ? `; ${filteredAdditionalSubmittedCount} अतिरिक्त पेशी scope बाहिर छन्`
                : ""}
            </span>
            <span>
              {filteredExpectedSubmittedCount} of {filteredExpected.length} expected palikas reported
              {filteredAdditionalSubmittedCount
                ? `; ${filteredAdditionalSubmittedCount} additional submission${filteredAdditionalSubmittedCount === 1 ? "" : "s"} outside scope`
                : ""}
            </span>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><Bi ne="स्थिति" en="Status" /></th>
                  <th><Bi ne="पालिका" en="Palika" /></th>
                  <th><Bi ne="जिल्ला" en="District" /></th>
                  <th><Bi ne="समय" en="Time" /></th>
                  <th><Bi ne="तरिका" en="Type" /></th>
                </tr>
              </thead>
              <tbody>
                {trackerRows.map((row) => {
                  const submitted = Boolean(row.submission);
                  const type = SUBMISSION_TYPES[row.submission?.submission_type] || {
                    ne: row.submission?.submission_type_ne || "—",
                    en: row.submission?.submission_type || "—",
                  };
                  const palikaNameNe = row.submission?.palika_name_ne || row.palika_name_ne;
                  const palikaNameEn = row.submission?.palika_name_en || row.palika_name_en;
                  const districtNe = row.submission?.district_ne || row.district_ne;
                  const districtEn = row.submission?.district_en || row.district_en;
                  return (
                    <tr
                      key={row.palika_id}
                      className={`${submitted ? "clickable-row" : "outstanding"} ${
                        selectedPalikaId === row.palika_id ? "selected-row" : ""
                      }`}
                      role={submitted ? "button" : undefined}
                      tabIndex={submitted ? 0 : undefined}
                      onClick={submitted ? () => setSelectedPalikaId(row.palika_id) : undefined}
                      onKeyDown={
                        submitted
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedPalikaId(row.palika_id);
                              }
                            }
                          : undefined
                      }
                    >
                      <td>
                        <span className={`status ${submitted ? "submitted" : "pending"}`}>
                          {submitted ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <Bi ne={submitted ? "प्राप्त" : "बाँकी"} en={submitted ? "Submitted" : "Outstanding"} />
                        </span>
                      </td>
                      <td>
                        <strong lang="ne">{palikaNameNe}</strong>
                        <span>{palikaNameEn}</span>
                        {row.expected === false ? (
                          <span className="scope-badge">
                            <Bi ne="scope बाहिर" en="outside scope" />
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {districtNe} / {districtEn}
                      </td>
                      <td>{submitted ? formatDate(row.submission.submitted_at) : "—"}</td>
                      <td>{submitted ? `${type.ne} / ${type.en}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selectedSubmission ? (
          <PalikaDetailPanel submission={selectedSubmission} onClose={() => setSelectedPalikaId("")} />
        ) : (
        <div className="panel">
          <SectionTitle ne="महत्वपूर्ण संकेत" en="Critical Need Flags" />
          {criticalFlags.length ? (
            <div className="flag-list">
              {criticalFlags.map((flag) => (
                <article className="flag" key={flag.en}>
                  <AlertTriangle size={20} aria-hidden="true" />
                  <div>
                    <Bi ne={flag.ne} en={flag.en} />
                    <span>
                      {formatNumber(flag.value)} / {formatNumber(flag.threshold)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <CheckCircle2 size={24} />
              <Bi ne="सीमा नाघेको संकेत छैन" en="No thresholds exceeded" />
            </div>
          )}

          <div className="refresh-note">
            <Clock size={17} />
            <Bi
              ne={`स्वचालित ताजा: ${toNumber(activeEvent.refresh_seconds) || 60} सेकेन्ड`}
              en={`Auto refresh: ${toNumber(activeEvent.refresh_seconds) || 60} seconds`}
            />
          </div>
          {lastRefresh ? (
            <div className="refresh-note">
              <RefreshCw size={17} />
              <Bi ne="हालै ताजा गरिएको" en={`Refreshed ${formatDate(lastRefresh.toISOString())}`} />
            </div>
          ) : null}
        </div>
        )}
      </section>

      {exportModalOpen ? (
        <ExportModal onCancel={() => setExportModalOpen(false)} onConfirm={exportSummary} />
      ) : null}
    </main>
  );
}

export default App;
