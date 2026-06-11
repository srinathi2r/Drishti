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
  submissions: import.meta.env.VITE_SUBMISSIONS_CSV_URL || localDataUrl("mock_submissions.csv"),
  palikaMaster: import.meta.env.VITE_PALIKA_MASTER_CSV_URL || localDataUrl("palika_master.csv"),
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

function Bi({ ne, en, className = "" }) {
  return (
    <span className={`bi ${className}`}>
      <span lang="ne">{ne}</span>
      <span>{en}</span>
    </span>
  );
}

function splitTitleLines(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 3) return [words.join(" ")];
  const splitAt = Math.ceil(words.length / 2);
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")];
}

function TitleLines({ text }) {
  return splitTitleLines(text).map((line) => (
    <span className="title-line" key={line}>
      {line}
    </span>
  ));
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

function printableSummaryHtml({ event, summary, rows, expectedCount, lastUpdated }) {
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
<title>DRISHTI Export</title>
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
  <h1>दृष्टि / DRISHTI</h1>
  <p>संघीय मामिला तथा सामान्य प्रशासन मन्त्रालय / Ministry of Federal Affairs and General Administration</p>
  <div class="meta">
    <p><strong>घटना / Event:</strong> ${event.event_name_ne} / ${event.event_name_en}</p>
    <p><strong>जिल्ला / Districts:</strong> ${event.affected_districts_ne} / ${event.affected_districts_en}</p>
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
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [eventConfig, expectedPalikas, submissions, palikaMaster] = await Promise.all([
        fetchCsv(DATA_URLS.eventConfig),
        fetchCsv(DATA_URLS.expectedPalikas),
        fetchCsv(DATA_URLS.submissions),
        fetchCsv(DATA_URLS.palikaMaster),
      ]);
      setData({ eventConfig, expectedPalikas, submissions, palikaMaster });
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

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
  const summary = useMemo(() => buildSummary(submittedRows), [submittedRows]);

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
    () =>
      scopedExpected.map((palika) => ({
        ...palika,
        submission: latestByPalika.get(palika.palika_id),
      })),
    [latestByPalika, scopedExpected],
  );

  const exportSummary = () => {
    setExportModalOpen(false);
    const summaryRows = [
      ["घटना / Event", `${activeEvent.event_name_ne} / ${activeEvent.event_name_en}`],
      ["जिल्ला / Districts", `${activeEvent.affected_districts_ne} / ${activeEvent.affected_districts_en}`],
      ["रिपोर्टिङ / Reporting", `${submittedRows.length} of ${scopedExpected.length}`],
      ["अन्तिम अद्यावधिक / Last updated", lastUpdated],
      [],
      ["सूचक / Indicator", "जम्मा / Total"],
      ...SUMMARY_CARDS.map((card) => [`${card.ne} / ${card.en}`, summary[card.key]]),
      [],
      ["तत्काल आवश्यकता / Immediate Need", "जम्मा / Total"],
      ...NEED_CARDS.map((card) => [`${card.ne} / ${card.en}`, summary[card.key]]),
    ];
    const csv = `\ufeff${summaryRows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
    downloadFile(`drishti-${activeEvent.event_id || "event"}-summary.csv`, csv, "text/csv;charset=utf-8");

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (printWindow) {
      printWindow.document.write(
        printableSummaryHtml({
          event: activeEvent,
          summary,
          rows: submittedRows,
          expectedCount: scopedExpected.length,
          lastUpdated,
        }),
      );
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <main className="app-shell">
      <header className="event-header">
        <div>
          <p className="eyebrow">दृष्टि / DRISHTI</p>
          <h1>
            <span lang="ne">
              <TitleLines text={activeEvent.event_name_ne || "घटना लोड हुँदै"} />
            </span>
            <span>
              {activeEvent.event_name_en || "Loading event"}
            </span>
          </h1>
          <div className="event-meta">
            <span className="district-pill">
              <span className="meta-line" lang="ne">{activeEvent.affected_districts_ne || "—"}</span>
              <span className="meta-line meta-english">{activeEvent.affected_districts_en || "—"}</span>
            </span>
            <span>
              {formatNumber(scopedExpected.length)} <span lang="ne">अपेक्षित पालिका</span> / expected palikas
            </span>
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
                {submittedRows.length} / {scopedExpected.length}
              </span>
            }
          />
          <p className="tracker-status">
            <span lang="ne">{submittedRows.length} मध्ये {scopedExpected.length} अपेक्षित पालिकाले रिपोर्ट गरेका छन्</span>
            <span>{submittedRows.length} of {scopedExpected.length} expected palikas reported</span>
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
                  return (
                    <tr key={row.palika_id} className={submitted ? "" : "outstanding"}>
                      <td>
                        <span className={`status ${submitted ? "submitted" : "pending"}`}>
                          {submitted ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <Bi ne={submitted ? "प्राप्त" : "बाँकी"} en={submitted ? "Submitted" : "Outstanding"} />
                        </span>
                      </td>
                      <td>
                        <strong lang="ne">{row.palika_name_ne}</strong>
                        <span>{row.palika_name_en}</span>
                      </td>
                      <td>
                        {row.district_ne} / {row.district_en}
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
      </section>

      {exportModalOpen ? (
        <ExportModal onCancel={() => setExportModalOpen(false)} onConfirm={exportSummary} />
      ) : null}
    </main>
  );
}

export default App;
