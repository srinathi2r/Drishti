const SUBMISSION_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxfK7Ff9WQnwDuYkXi7v3hSqD49Zq9O8BN3rwj7CmcQxP8tnYXpzV1NrqjEuXeJWJRV/exec";
const HIERARCHY_URL = new URL("../data/nepal_admin_hierarchy.json", window.location.href).href;
const VERIFY_INTERVAL_MS = 2000;
const VERIFY_TIMEOUT_MS = 15000;
const JSONP_REQUEST_TIMEOUT_MS = 5000;

const form = document.querySelector("#iraForm");
const provinceSelect = document.querySelector("#provinceSelect");
const districtSelect = document.querySelector("#districtSelect");
const palikaSelect = document.querySelector("#palikaSelect");
const submitButton = document.querySelector("#submitButton");
const statusMessage = document.querySelector("#formStatus");

let hierarchy = { provinces: [] };

function option(label, value = "") {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function bilingualLabel(ne, en) {
  return ne ? `${ne} / ${en}` : en;
}

function selectedProvince() {
  return hierarchy.provinces.find((province) => province.ocha_adm1_pcode === provinceSelect.value);
}

function selectedDistrict() {
  const province = selectedProvince();
  return province?.districts.find((district) => district.ocha_adm2_pcode === districtSelect.value);
}

function selectedPalika() {
  const district = selectedDistrict();
  return district?.palikas.find((palika) => palika.palika_id === palikaSelect.value);
}

function resetSelect(select, label, disabled = true) {
  select.innerHTML = "";
  select.append(option(label));
  select.disabled = disabled;
}

function fillProvinces() {
  resetSelect(provinceSelect, "छान्नुहोस् / Choose", false);
  hierarchy.provinces.forEach((province) => {
    provinceSelect.append(option(bilingualLabel(province.name_ne, province.name_en), province.ocha_adm1_pcode));
  });
}

function fillDistricts() {
  const province = selectedProvince();
  resetSelect(districtSelect, "जिल्ला छान्नुहोस् / Choose district", !province);
  resetSelect(palikaSelect, "पहिले जिल्ला छान्नुहोस् / Select district first", true);
  if (!province) return;

  province.districts.forEach((district) => {
    districtSelect.append(option(bilingualLabel(district.name_ne, district.name_en), district.ocha_adm2_pcode));
  });
}

function fillPalikas() {
  const district = selectedDistrict();
  resetSelect(palikaSelect, "पालिका छान्नुहोस् / Choose palika", !district);
  if (!district) return;

  district.palikas.forEach((palika) => {
    palikaSelect.append(option(palika.label || bilingualLabel(palika.full_name_ne, palika.full_name_en), palika.palika_id));
  });
}

function formIsValid() {
  return Boolean(
    selectedProvince() &&
      selectedDistrict() &&
      selectedPalika() &&
      form.checkValidity() &&
      SUBMISSION_ENDPOINT_URL.trim(),
  );
}

function updateSubmitState() {
  submitButton.disabled = !formIsValid();
  if (!SUBMISSION_ENDPOINT_URL.trim()) {
    statusMessage.className = "status-message error";
    statusMessage.textContent = "Apps Script endpoint URL सेट गरिएको छैन / Apps Script endpoint URL is not configured";
  } else if (!form.checkValidity() || !selectedPalika()) {
    statusMessage.className = "status-message";
    statusMessage.textContent = "अनिवार्य विवरण पूरा गर्नुहोस् / Complete required fields";
  } else {
    statusMessage.className = "status-message";
    statusMessage.textContent = "";
  }
}

function fieldValue(input) {
  if (input.type === "number") return input.value === "" ? "" : Number(input.value);
  if (input.value === "true") return true;
  if (input.value === "false") return false;
  return input.value.trim();
}

function generateClientSubmissionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const randomPart = Math.random().toString(36).slice(2);
  return `submission-${Date.now()}-${randomPart}`;
}

function buildPayload() {
  const province = selectedProvince();
  const district = selectedDistrict();
  const palika = selectedPalika();
  const fields = {};

  form.querySelectorAll("[data-field]").forEach((input) => {
    fields[input.dataset.field] = fieldValue(input);
  });

  return {
    client_submission_id: generateClientSubmissionId(),
    submitted_at: new Date().toISOString(),
    source: "standalone_html_form",
    location: {
      province: {
        name_ne: province.name_ne,
        name_en: province.name_en,
        ocha_adm1_pcode: province.ocha_adm1_pcode,
      },
      district: {
        name_ne: district.name_ne,
        name_en: district.name_en,
        ocha_adm2_pcode: district.ocha_adm2_pcode,
      },
      palika: {
        palika_id: palika.palika_id,
        name_ne: palika.name_ne,
        name_en: palika.name_en,
        full_name_ne: palika.full_name_ne,
        full_name_en: palika.full_name_en,
        type_ne: palika.type_ne,
        type_en: palika.type_en,
        label: palika.label,
        ocha_adm3_pcode: palika.ocha_adm3_pcode,
      },
    },
    fields,
  };
}

async function submitPayload(payload) {
  await fetch(SUBMISSION_ENDPOINT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function endpointUrl(params) {
  const url = new URL(SUBMISSION_ENDPOINT_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function verifySubmissionStatus(submissionId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const callbackName = `drishtiStatus_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Verification timed out"));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(Boolean(payload?.ok && payload.found));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Verification request failed"));
    };

    script.src = endpointUrl({
      action: "status",
      submission_id: submissionId,
      callback: callbackName,
    });
    document.head.append(script);
  });
}

async function waitForSubmissionConfirmation(submissionId) {
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const timeoutMs = Math.min(JSONP_REQUEST_TIMEOUT_MS, deadline - Date.now());
      if (timeoutMs > 0 && (await verifySubmissionStatus(submissionId, timeoutMs))) return true;
    } catch {
      // Keep polling until the overall verification window expires.
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) await delay(Math.min(VERIFY_INTERVAL_MS, remainingMs));
  }

  return false;
}

async function initialize() {
  try {
    const response = await fetch(HIERARCHY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    hierarchy = await response.json();
    fillProvinces();
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.className = "status-message error";
    statusMessage.textContent = `स्थान सूची लोड हुन सकेन / Location list could not load: ${error.message}`;
  }
  updateSubmitState();
}

provinceSelect.addEventListener("change", () => {
  fillDistricts();
  updateSubmitState();
});

districtSelect.addEventListener("change", () => {
  fillPalikas();
  updateSubmitState();
});

palikaSelect.addEventListener("change", updateSubmitState);
form.addEventListener("input", updateSubmitState);
form.addEventListener("change", updateSubmitState);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateSubmitState();
  if (submitButton.disabled) return;

  submitButton.disabled = true;
  statusMessage.className = "status-message";
  statusMessage.textContent = "पेश हुँदैछ / Submitting";

  try {
    const payload = buildPayload();
    await submitPayload(payload);
    statusMessage.textContent = "पुष्टि हुँदैछ / Confirming submission";

    if (await waitForSubmissionConfirmation(payload.client_submission_id)) {
      form.reset();
      resetSelect(districtSelect, "पहिले प्रदेश छान्नुहोस् / Select province first", true);
      resetSelect(palikaSelect, "पहिले जिल्ला छान्नुहोस् / Select district first", true);
      statusMessage.className = "status-message success";
      statusMessage.textContent = "सफलतापूर्वक पेश भयो / Submitted successfully";
    } else {
      statusMessage.className = "status-message warning";
      statusMessage.textContent =
        "पेशी पठाइयो तर पुष्टि हुन सकेन - कृपया समन्वयकर्तासँग जाँच गर्नुहोस् / Submission sent but not yet confirmed - please check with your coordinator";
      submitButton.disabled = !formIsValid();
    }
  } catch (error) {
    statusMessage.className = "status-message error";
    statusMessage.textContent = `पेश हुन सकेन / Submission failed: ${error.message}`;
    submitButton.disabled = !formIsValid();
  }
});

initialize();
