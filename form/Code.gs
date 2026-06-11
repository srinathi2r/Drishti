/**
 * DRISHTI Google Form + Google Sheets setup for MoFAGA IRA reporting.
 *
 * Usage:
 * 1. Create a new Apps Script project.
 * 2. Paste this file into Code.gs.
 * 3. Set optional script property PALIKA_MASTER_CSV_URL to a published CSV URL.
 * 4. Run setupDrishti().
 * 5. Install an on form submit trigger for normalizeSubmission.
 */

const DRISHTI = {
  spreadsheetName: 'DRISHTI IRA Database / दृष्टि प्रारम्भिक द्रुत मूल्यांकन डाटाबेस',
  formName: 'दृष्टि प्रारम्भिक द्रुत मूल्यांकन फाराम / DRISHTI Initial Rapid Assessment Form',
  sheets: {
    eventConfig: 'Event Config',
    submissions: 'Submissions',
    palikaMaster: 'Palika Master',
    mockData: 'Mock Data',
  },
  submissionTypes: [
    'सिधा / Direct',
    'कागजको फारामको फोटो / Photo of paper form',
    'फोन कल / Voice call',
  ],
  yesNo: ['हो / Yes', 'होइन / No'],
};

const EVENT_CONFIG_HEADERS = [
  'event_id',
  'active',
  'event_name_ne',
  'event_name_en',
  'affected_province_ne',
  'affected_province_en',
  'affected_districts_ne',
  'affected_districts_en',
  'expected_palika_ids',
  'expected_palikas_ne',
  'expected_palikas_en',
  'deaths_threshold',
  'displaced_households_threshold',
  'water_disruption_palikas_threshold',
  'shelter_need_households_threshold',
  'refresh_seconds',
];

const PALIKA_MASTER_HEADERS = [
  'palika_id',
  'province_en',
  'province_ne',
  'district_en',
  'district_ne',
  'palika_name_en',
  'palika_name_ne',
  'palika_type_en',
  'palika_type_ne',
  'palika_full_name_en',
  'palika_full_name_ne',
  'palika_label',
  'wards',
  'population_2021',
  'area_km2',
  'website',
  'source_url',
];

const SUBMISSION_HEADERS = [
  'event_id',
  'event_name_ne',
  'event_name_en',
  'palika_id',
  'palika_name_ne',
  'palika_name_en',
  'district_ne',
  'district_en',
  'province_ne',
  'province_en',
  'submitted_at',
  'operator_name',
  'submission_type',
  'submission_type_ne',
  'is_proxy',
  'duplicate_status',
  'override_duplicate',
  'deaths',
  'missing',
  'injured',
  'displaced_households',
  'total_affected_population',
  'rescue_ongoing_wards',
  'rescue_completed_wards',
  'total_rescued',
  'shelter_households_schools',
  'shelter_households_public_buildings',
  'shelter_households_relatives',
  'shelter_households_open_areas',
  'immediate_shelter_need_households',
  'communications_disrupted',
  'electricity_disrupted',
  'water_supply_disrupted',
  'water_disruption_households',
  'private_houses_fully_damaged',
  'private_houses_partially_damaged',
  'government_buildings_fully_damaged',
  'government_buildings_partially_damaged',
  'public_buildings_fully_damaged',
  'public_buildings_partially_damaged',
  'tents_needed',
  'tarpaulins_needed',
  'food_packages_needed',
  'blankets_needed',
  'drinking_water_people',
];

const FORM_FIELD_MAP = [
  ['event_name', 'घटनाको नाम / Event name', 'event'],
  ['palika', 'पालिकाको नाम / Palika name', 'palika'],
  ['operator_name', 'सञ्चालकको नाम / Operator name', 'text', true],
  ['submission_type', 'पेश गर्ने तरिका / Submission type', 'submission_type', true],
  ['deaths', 'मृत्यु / Deaths', 'number', true],
  ['missing', 'बेपत्ता / Missing', 'number', true],
  ['injured', 'घाइते / Injured', 'number', true],
  ['displaced_households', 'विस्थापित घरधुरी / Displaced households', 'number', true],
  ['total_affected_population', 'कुल प्रभावित जनसंख्या / Total affected population', 'number'],
  ['rescue_ongoing_wards', 'उद्धार कार्य भइरहेको वडा संख्या / Wards with rescue ongoing', 'number'],
  ['rescue_completed_wards', 'उद्धार कार्य सकिएको वडा संख्या / Wards with rescue completed', 'number'],
  ['total_rescued', 'उद्धार संख्या / Total rescued', 'number'],
  ['shelter_households_schools', 'विद्यालयमा आश्रित घरधुरी / Households in schools', 'number'],
  ['shelter_households_public_buildings', 'सार्वजनिक भवनमा / Households in public buildings', 'number'],
  ['shelter_households_relatives', 'आफन्त/छिमेकीमा / Households with relatives', 'number'],
  ['shelter_households_open_areas', 'खुला क्षेत्रमा / Households in open areas', 'number'],
  ['immediate_shelter_need_households', 'तत्काल अस्थायी आवासको आवश्यकता / Immediate shelter need', 'number'],
  ['communications_disrupted', 'संचार सेवा अवरुद्ध / Communications disrupted', 'yes_no'],
  ['electricity_disrupted', 'विद्युत सेवा अवरुद्ध / Electricity disrupted', 'yes_no'],
  ['water_supply_disrupted', 'खानेपानी आपूर्ति अवरुद्ध / Water supply disrupted', 'yes_no'],
  ['water_disruption_households', 'अवरुद्ध भएको घरधुरी / Households affected by water disruption', 'number'],
  ['private_houses_fully_damaged', 'निजी घर पूर्ण क्षति / Private houses fully damaged', 'number', true],
  ['private_houses_partially_damaged', 'निजी घर आंशिक क्षति / Private houses partially damaged', 'number'],
  ['government_buildings_fully_damaged', 'सरकारी कार्यालय पूर्ण क्षति / Government buildings fully damaged', 'number'],
  ['government_buildings_partially_damaged', 'सरकारी कार्यालय आंशिक क्षति / Government buildings partially damaged', 'number'],
  ['public_buildings_fully_damaged', 'सार्वजनिक भवन पूर्ण क्षति / Public buildings fully damaged', 'number'],
  ['public_buildings_partially_damaged', 'सार्वजनिक भवन आंशिक क्षति / Public buildings partially damaged', 'number'],
  ['tents_needed', 'टेन्ट संख्या / Tents needed', 'number'],
  ['tarpaulins_needed', 'त्रिपाल / Tarpaulins needed', 'number'],
  ['food_packages_needed', 'दाल, चामल, घिउ, तेल / Food packages needed', 'number'],
  ['blankets_needed', 'कम्बल थान / Blankets needed', 'number'],
  ['drinking_water_people', 'पिउने पानी / Drinking water needed', 'number'],
];

function setupDrishti() {
  const spreadsheet = SpreadsheetApp.create(DRISHTI.spreadsheetName);
  ensureSheet_(spreadsheet, DRISHTI.sheets.eventConfig, EVENT_CONFIG_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.submissions, SUBMISSION_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.palikaMaster, PALIKA_MASTER_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.mockData, SUBMISSION_HEADERS);
  seedDefaultEvent_(spreadsheet);
  importPalikaMasterIfConfigured_(spreadsheet);

  const form = FormApp.create(DRISHTI.formName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage(
    'पेश गरिएको विवरण प्राप्त भयो। आवश्यकता परे “Edit response” बाट सच्याउन सकिन्छ। / Your submission has been received. Use “Edit response” if correction is needed.',
  );
  buildForm_(form, spreadsheet);

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    FORM_ID: form.getId(),
  });

  Logger.log(`Spreadsheet URL / Google Sheets: ${spreadsheet.getUrl()}`);
  Logger.log(`Form URL / Google Form: ${form.getPublishedUrl()}`);
  Logger.log(`QR URL / क्यूआर: ${qrCodeUrl_(form.getPublishedUrl())}`);
}

function refreshActiveEventFormChoices() {
  const spreadsheet = getSpreadsheet_();
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const activeEvent = getActiveEvent_(spreadsheet);
  const palikas = expectedPalikaChoices_(spreadsheet, activeEvent);

  const eventItem = findListItem_(form, 'घटनाको नाम / Event name');
  eventItem.setChoiceValues([`${activeEvent.event_name_ne} / ${activeEvent.event_name_en}`]);

  const palikaItem = findListItem_(form, 'पालिकाको नाम / Palika name');
  palikaItem.setChoiceValues(palikas.map((palika) => palika.palika_label));
}

function normalizeSubmission(e) {
  const spreadsheet = getSpreadsheet_();
  const activeEvent = getActiveEvent_(spreadsheet);
  const response = responseMap_(e.response);
  const palika = findPalikaByLabel_(spreadsheet, response['पालिकाको नाम / Palika name']);
  const submissionType = response['पेश गर्ने तरिका / Submission type'] || '';
  const duplicate = hasDuplicate_(spreadsheet, activeEvent.event_id, palika.palika_id);

  const row = {
    event_id: activeEvent.event_id,
    event_name_ne: activeEvent.event_name_ne,
    event_name_en: activeEvent.event_name_en,
    palika_id: palika.palika_id,
    palika_name_ne: palika.palika_full_name_ne,
    palika_name_en: palika.palika_full_name_en,
    district_ne: palika.district_ne,
    district_en: palika.district_en,
    province_ne: palika.province_ne,
    province_en: palika.province_en,
    submitted_at: new Date(),
    operator_name: response['सञ्चालकको नाम / Operator name'],
    submission_type: englishSubmissionType_(submissionType),
    submission_type_ne: nepaliSubmissionType_(submissionType),
    is_proxy: submissionType.indexOf('Photo') > -1 || submissionType.indexOf('Voice') > -1,
    duplicate_status: duplicate ? 'DUPLICATE_REVIEW_REQUIRED' : '',
    override_duplicate: '',
  };

  FORM_FIELD_MAP.forEach(([key, title]) => {
    if (SUBMISSION_HEADERS.indexOf(key) > -1) {
      row[key] = normalizeValue_(response[title]);
    }
  });

  appendObject_(spreadsheet.getSheetByName(DRISHTI.sheets.submissions), SUBMISSION_HEADERS, row);
}

function buildForm_(form, spreadsheet) {
  const activeEvent = getActiveEvent_(spreadsheet);
  const expectedPalikas = expectedPalikaChoices_(spreadsheet, activeEvent);
  const numberValidation = FormApp.createTextValidation()
    .requireNumber()
    .setHelpText('संख्या मात्र लेख्नुहोस् / Enter numbers only')
    .build();

  form.addSectionHeaderItem().setTitle('पहिचान / Identification');
  form
    .addListItem()
    .setTitle('घटनाको नाम / Event name')
    .setChoiceValues([`${activeEvent.event_name_ne} / ${activeEvent.event_name_en}`])
    .setRequired(true);
  form
    .addListItem()
    .setTitle('पालिकाको नाम / Palika name')
    .setChoiceValues(expectedPalikas.map((palika) => palika.palika_label))
    .setRequired(true);
  form
    .addTextItem()
    .setTitle('सञ्चालकको नाम / Operator name')
    .setRequired(true);
  form
    .addListItem()
    .setTitle('पेश गर्ने तरिका / Submission type')
    .setChoiceValues(DRISHTI.submissionTypes)
    .setRequired(true);
  form
    .addDateTimeItem()
    .setTitle('पेश गरिएको मिति / Submission date and time')
    .setHelpText('स्वतः Google Forms timestamp पनि रेकर्ड हुन्छ। / Google Forms timestamp is also recorded automatically.');

  addSection_(form, 'प्रभावित जनसंख्या / Affected Population', numberValidation, 4, 9);
  addSection_(form, 'खोज तथा उद्धार / Search and Rescue', numberValidation, 9, 12);
  addSection_(form, 'अस्थायी आश्रय / Temporary Shelter', numberValidation, 12, 17);
  addSection_(form, 'संचार तथा विद्युत / Communications and Electricity', numberValidation, 17, 19);
  addSection_(form, 'खानेपानीको आपूर्ति / Water Supply', numberValidation, 19, 21);
  addSection_(form, 'भौतिक संरचना / Physical Structures', numberValidation, 21, 27);
  addSection_(form, 'तत्काल आवश्यकता / Immediate Needs', numberValidation, 27, FORM_FIELD_MAP.length);
}

function addSection_(form, title, numberValidation, start, end) {
  form.addSectionHeaderItem().setTitle(title);
  FORM_FIELD_MAP.slice(start, end).forEach(([key, label, type, required]) => {
    if (type === 'yes_no') {
      form.addMultipleChoiceItem().setTitle(label).setChoiceValues(DRISHTI.yesNo).setRequired(Boolean(required));
      return;
    }
    const item = form.addTextItem().setTitle(label).setRequired(Boolean(required));
    if (type === 'number') item.setValidation(numberValidation);
  });
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f5f2');
  return sheet;
}

function seedDefaultEvent_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(DRISHTI.sheets.eventConfig);
  sheet.getRange(2, 1, 1, EVENT_CONFIG_HEADERS.length).setValues([
    [
      'karnali-eq-2083-drill',
      'TRUE',
      'कर्णाली भूकम्प प्रारम्भिक मूल्यांकन अभ्यास २०८३',
      'Karnali Earthquake IRA Drill 2083',
      'कर्णाली',
      'Karnali',
      'जाजरकोट; दैलेख; सल्यान',
      'Dailekh; Jajarkot; Salyan',
      '',
      '',
      '',
      10,
      500,
      3,
      200,
      60,
    ],
  ]);
}

function importPalikaMasterIfConfigured_(spreadsheet) {
  const url = PropertiesService.getScriptProperties().getProperty('PALIKA_MASTER_CSV_URL');
  if (!url) return;
  const response = UrlFetchApp.fetch(url);
  const rows = Utilities.parseCsv(response.getContentText());
  const sheet = spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster);
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getActiveEvent_(spreadsheet) {
  const rows = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.eventConfig));
  const active = rows.find((row) => String(row.active).toUpperCase() === 'TRUE') || rows[0];
  if (!active) throw new Error('No active event found / सक्रिय घटना भेटिएन');
  return active;
}

function expectedPalikaChoices_(spreadsheet, activeEvent) {
  const master = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster));
  const expectedIds = String(activeEvent.expected_palika_ids || '')
    .split(';')
    .map((id) => id.trim())
    .filter(Boolean);
  if (expectedIds.length) return master.filter((row) => expectedIds.indexOf(row.palika_id) > -1);
  const districts = String(activeEvent.affected_districts_en || '')
    .split(';')
    .map((district) => district.trim());
  return master.filter((row) => districts.indexOf(row.district_en) > -1);
}

function findListItem_(form, title) {
  const item = form.getItems(FormApp.ItemType.LIST).find((candidate) => candidate.getTitle() === title);
  if (!item) throw new Error(`Missing list item: ${title}`);
  return item.asListItem();
}

function findPalikaByLabel_(spreadsheet, label) {
  const master = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster));
  const palika = master.find((row) => row.palika_label === label);
  if (!palika) throw new Error(`Palika not found / पालिका भेटिएन: ${label}`);
  return palika;
}

function responseMap_(response) {
  const map = {};
  response.getItemResponses().forEach((itemResponse) => {
    map[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  return map;
}

function hasDuplicate_(spreadsheet, eventId, palikaId) {
  return sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.submissions)).some(
    (row) => row.event_id === eventId && row.palika_id === palikaId,
  );
}

function sheetObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index];
    });
    return object;
  });
}

function appendObject_(sheet, headers, object) {
  sheet.appendRow(headers.map((header) => object[header] ?? ''));
}

function normalizeValue_(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (value === 'हो / Yes') return true;
  if (value === 'होइन / No') return false;
  return value ?? '';
}

function englishSubmissionType_(value) {
  if (value.indexOf('Photo') > -1) return 'Photo';
  if (value.indexOf('Voice') > -1) return 'Voice';
  return 'Direct';
}

function nepaliSubmissionType_(value) {
  return value.split('/')[0].trim();
}

function qrCodeUrl_(url) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=320`;
}
