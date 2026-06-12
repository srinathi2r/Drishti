/**
 * Initial Rapid Assessment Google Form + Google Sheets setup for MoFAGA IRA reporting.
 *
 * Usage:
 * 1. Create a new Apps Script project.
 * 2. Paste this file into Code.gs.
 * 3. Set optional script property PALIKA_MASTER_CSV_URL to a published CSV URL.
 * 4. Run setupDrishti().
 * 5. Run installTrigger() once manually after setupDrishti().
 */

const DRISHTI = {
  spreadsheetName: 'प्रारम्भिक द्रुत मूल्यांकन डाटाबेस / Initial Rapid Assessment Database',
  formName: 'प्रारम्भिक द्रुत मूल्यांकन फाराम / Initial Rapid Assessment Form',
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

const SCRIPT_PROPERTIES = {
  sheetId: 'DRISHTI_SHEET_ID',
  formId: 'DRISHTI_FORM_ID',
  autoCleanupFormResponses: 'DRISHTI_AUTO_CLEANUP_FORM_RESPONSES',
  legacySheetId: 'SPREADSHEET_ID',
  legacyFormId: 'FORM_ID',
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

const FALLBACK_PALIKA_MASTER = [
  { palika_id: 'bagmati-bhaktapur-suryabinayak-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Bhaktapur', district_ne: 'भक्तपुर', palika_name_en: 'Suryabinayak', palika_name_ne: 'सूर्यविनायक', palika_full_name_en: 'Suryabinayak Municipality', palika_full_name_ne: 'सूर्यविनायक नगरपालिका', palika_label: 'सूर्यविनायक नगरपालिका / Suryabinayak Municipality' },
  { palika_id: 'bagmati-kathmandu-budhanilkantha-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Budhanilkantha', palika_name_ne: 'बुढानिलकण्ठ', palika_full_name_en: 'Budhanilkantha Municipality', palika_full_name_ne: 'बुढानिलकण्ठ नगरपालिका', palika_label: 'बुढानिलकण्ठ नगरपालिका / Budhanilkantha Municipality' },
  { palika_id: 'bagmati-kathmandu-chandragiri-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Chandragiri', palika_name_ne: 'चन्द्रागिरी', palika_full_name_en: 'Chandragiri Municipality', palika_full_name_ne: 'चन्द्रागिरी नगरपालिका', palika_label: 'चन्द्रागिरी नगरपालिका / Chandragiri Municipality' },
  { palika_id: 'bagmati-kathmandu-gokarneshwar-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Gokarneshwar', palika_name_ne: 'गोकर्णेश्वर', palika_full_name_en: 'Gokarneshwar Municipality', palika_full_name_ne: 'गोकर्णेश्वर नगरपालिका', palika_label: 'गोकर्णेश्वर नगरपालिका / Gokarneshwar Municipality' },
  { palika_id: 'bagmati-kathmandu-kageshwari-manohara-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Kageshwari-Manohara', palika_name_ne: 'कागेश्वरी मनोहरा', palika_full_name_en: 'Kageshwari-Manohara Municipality', palika_full_name_ne: 'कागेश्वरी मनोहरा नगरपालिका', palika_label: 'कागेश्वरी मनोहरा नगरपालिका / Kageshwari-Manohara Municipality' },
  { palika_id: 'bagmati-kathmandu-kathmandu-metropolitan-city', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Kathmandu', palika_name_ne: 'काठमाडौँ', palika_full_name_en: 'Kathmandu Metropolitan City', palika_full_name_ne: 'काठमाडौँ महानगरपालिका', palika_label: 'काठमाडौँ महानगरपालिका / Kathmandu Metropolitan City' },
  { palika_id: 'bagmati-kathmandu-tarakeshwar-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Tarakeshwar', palika_name_ne: 'तारकेश्वर', palika_full_name_en: 'Tarakeshwar Municipality', palika_full_name_ne: 'तारकेश्वर नगरपालिका', palika_label: 'तारकेश्वर नगरपालिका / Tarakeshwar Municipality' },
  { palika_id: 'bagmati-kathmandu-tokha-municipality', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Kathmandu', district_ne: 'काठमाडौँ', palika_name_en: 'Tokha', palika_name_ne: 'टोखा', palika_full_name_en: 'Tokha Municipality', palika_full_name_ne: 'टोखा नगरपालिका', palika_label: 'टोखा नगरपालिका / Tokha Municipality' },
  { palika_id: 'bagmati-lalitpur-lalitpur-metropolitan-city', province_en: 'Bagmati', province_ne: 'बागमती', district_en: 'Lalitpur', district_ne: 'ललितपुर', palika_name_en: 'Lalitpur', palika_name_ne: 'ललितपुर', palika_full_name_en: 'Lalitpur Metropolitan City', palika_full_name_ne: 'ललितपुर महानगरपालिका', palika_label: 'ललितपुर महानगरपालिका / Lalitpur Metropolitan City' },
  { palika_id: 'gandaki-kaski-pokhara-metropolitan-city', province_en: 'Gandaki', province_ne: 'गण्डकी', district_en: 'Kaski', district_ne: 'कास्की', palika_name_en: 'Pokhara', palika_name_ne: 'पोखरा', palika_full_name_en: 'Pokhara Metropolitan City', palika_full_name_ne: 'पोखरा महानगरपालिका', palika_label: 'पोखरा महानगरपालिका / Pokhara Metropolitan City' },
  { palika_id: 'karnali-dailekh-aathabis-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Aathabis', palika_name_ne: 'आठबीस', palika_full_name_en: 'Aathabis Municipality', palika_full_name_ne: 'आठबीस नगरपालिका', palika_label: 'आठबीस नगरपालिका / Aathabis Municipality' },
  { palika_id: 'karnali-dailekh-bhagawatimai-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Bhagawatimai', palika_name_ne: 'भगवतीमाई', palika_full_name_en: 'Bhagawatimai Gaunpalika', palika_full_name_ne: 'भगवतीमाई गाउँपालिका', palika_label: 'भगवतीमाई गाउँपालिका / Bhagawatimai Gaunpalika' },
  { palika_id: 'karnali-dailekh-bhairabi-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Bhairabi', palika_name_ne: 'भैरवी', palika_full_name_en: 'Bhairabi Gaunpalika', palika_full_name_ne: 'भैरवी गाउँपालिका', palika_label: 'भैरवी गाउँपालिका / Bhairabi Gaunpalika' },
  { palika_id: 'karnali-dailekh-chamunda-bindrasaini-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Chamunda Bindrasaini', palika_name_ne: 'चामुण्डा विन्द्रासैनी', palika_full_name_en: 'Chamunda Bindrasaini Municipality', palika_full_name_ne: 'चामुण्डा विन्द्रासैनी नगरपालिका', palika_label: 'चामुण्डा विन्द्रासैनी नगरपालिका / Chamunda Bindrasaini Municipality' },
  { palika_id: 'karnali-dailekh-dullu-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Dullu', palika_name_ne: 'दुल्लु', palika_full_name_en: 'Dullu Municipality', palika_full_name_ne: 'दुल्लु नगरपालिका', palika_label: 'दुल्लु नगरपालिका / Dullu Municipality' },
  { palika_id: 'karnali-dailekh-dungeshwar-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Dungeshwar', palika_name_ne: 'डुंगेश्वर', palika_full_name_en: 'Dungeshwar Gaunpalika', palika_full_name_ne: 'डुंगेश्वर गाउँपालिका', palika_label: 'डुंगेश्वर गाउँपालिका / Dungeshwar Gaunpalika' },
  { palika_id: 'karnali-dailekh-gurans-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Gurans', palika_name_ne: 'गुराँस', palika_full_name_en: 'Gurans Gaunpalika', palika_full_name_ne: 'गुराँस गाउँपालिका', palika_label: 'गुराँस गाउँपालिका / Gurans Gaunpalika' },
  { palika_id: 'karnali-dailekh-mahabu-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Mahabu', palika_name_ne: 'महावु', palika_full_name_en: 'Mahabu Gaunpalika', palika_full_name_ne: 'महावु गाउँपालिका', palika_label: 'महावु गाउँपालिका / Mahabu Gaunpalika' },
  { palika_id: 'karnali-dailekh-narayan-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Narayan', palika_name_ne: 'नारायण', palika_full_name_en: 'Narayan Municipality', palika_full_name_ne: 'नारायण नगरपालिका', palika_label: 'नारायण नगरपालिका / Narayan Municipality' },
  { palika_id: 'karnali-dailekh-naumule-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Naumule', palika_name_ne: 'नौमुले', palika_full_name_en: 'Naumule Gaunpalika', palika_full_name_ne: 'नौमुले गाउँपालिका', palika_label: 'नौमुले गाउँपालिका / Naumule Gaunpalika' },
  { palika_id: 'karnali-dailekh-thantikandh-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Dailekh', district_ne: 'दैलेख', palika_name_en: 'Thantikandh', palika_name_ne: 'ठाँटीकाँध', palika_full_name_en: 'Thantikandh Gaunpalika', palika_full_name_ne: 'ठाँटीकाँध गाउँपालिका', palika_label: 'ठाँटीकाँध गाउँपालिका / Thantikandh Gaunpalika' },
  { palika_id: 'karnali-jajarkot-barekot-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Barekot', palika_name_ne: 'बारेकोट', palika_full_name_en: 'Barekot Gaunpalika', palika_full_name_ne: 'बारेकोट गाउँपालिका', palika_label: 'बारेकोट गाउँपालिका / Barekot Gaunpalika' },
  { palika_id: 'karnali-jajarkot-bheri-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Bheri', palika_name_ne: 'भेरी', palika_full_name_en: 'Bheri Municipality', palika_full_name_ne: 'भेरी नगरपालिका', palika_label: 'भेरी नगरपालिका / Bheri Municipality' },
  { palika_id: 'karnali-jajarkot-chhedagad-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Chhedagad', palika_name_ne: 'छेडागाड', palika_full_name_en: 'Chhedagad Municipality', palika_full_name_ne: 'छेडागाड नगरपालिका', palika_label: 'छेडागाड नगरपालिका / Chhedagad Municipality' },
  { palika_id: 'karnali-jajarkot-junichande-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Junichande', palika_name_ne: 'जुनीचाँदे', palika_full_name_en: 'Junichande Gaunpalika', palika_full_name_ne: 'जुनीचाँदे गाउँपालिका', palika_label: 'जुनीचाँदे गाउँपालिका / Junichande Gaunpalika' },
  { palika_id: 'karnali-jajarkot-kushe-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Kushe', palika_name_ne: 'कुसे', palika_full_name_en: 'Kushe Gaunpalika', palika_full_name_ne: 'कुसे गाउँपालिका', palika_label: 'कुसे गाउँपालिका / Kushe Gaunpalika' },
  { palika_id: 'karnali-jajarkot-nalgad-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Nalgad', palika_name_ne: 'नलगाड', palika_full_name_en: 'Nalgad Municipality', palika_full_name_ne: 'नलगाड नगरपालिका', palika_label: 'नलगाड नगरपालिका / Nalgad Municipality' },
  { palika_id: 'karnali-jajarkot-shivalaya-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Jajarkot', district_ne: 'जाजरकोट', palika_name_en: 'Shivalaya', palika_name_ne: 'शिवालय', palika_full_name_en: 'Shivalaya Gaunpalika', palika_full_name_ne: 'शिवालय गाउँपालिका', palika_label: 'शिवालय गाउँपालिका / Shivalaya Gaunpalika' },
  { palika_id: 'karnali-salyan-bagchaur-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Bagchaur', palika_name_ne: 'बागचौर', palika_full_name_en: 'Bagchaur Municipality', palika_full_name_ne: 'बागचौर नगरपालिका', palika_label: 'बागचौर नगरपालिका / Bagchaur Municipality' },
  { palika_id: 'karnali-salyan-bangad-kupinde-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Bangad Kupinde', palika_name_ne: 'बनगाड कुपिण्डे', palika_full_name_en: 'Bangad Kupinde Municipality', palika_full_name_ne: 'बनगाड कुपिण्डे नगरपालिका', palika_label: 'बनगाड कुपिण्डे नगरपालिका / Bangad Kupinde Municipality' },
  { palika_id: 'karnali-salyan-chhatreshwari-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Chhatreshwari', palika_name_ne: 'छत्रेश्वरी', palika_full_name_en: 'Chhatreshwari Gaunpalika', palika_full_name_ne: 'छत्रेश्वरी गाउँपालिका', palika_label: 'छत्रेश्वरी गाउँपालिका / Chhatreshwari Gaunpalika' },
  { palika_id: 'karnali-salyan-darma-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Darma', palika_name_ne: 'दार्मा', palika_full_name_en: 'Darma Gaunpalika', palika_full_name_ne: 'दार्मा गाउँपालिका', palika_label: 'दार्मा गाउँपालिका / Darma Gaunpalika' },
  { palika_id: 'karnali-salyan-kalimati-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Kalimati', palika_name_ne: 'कालीमाटी', palika_full_name_en: 'Kalimati Gaunpalika', palika_full_name_ne: 'कालीमाटी गाउँपालिका', palika_label: 'कालीमाटी गाउँपालिका / Kalimati Gaunpalika' },
  { palika_id: 'karnali-salyan-kapurkot-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Kapurkot', palika_name_ne: 'कपुरकोट', palika_full_name_en: 'Kapurkot Gaunpalika', palika_full_name_ne: 'कपुरकोट गाउँपालिका', palika_label: 'कपुरकोट गाउँपालिका / Kapurkot Gaunpalika' },
  { palika_id: 'karnali-salyan-kumakh-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Kumakh', palika_name_ne: 'कुमाख', palika_full_name_en: 'Kumakh Gaunpalika', palika_full_name_ne: 'कुमाख गाउँपालिका', palika_label: 'कुमाख गाउँपालिका / Kumakh Gaunpalika' },
  { palika_id: 'karnali-salyan-sharada-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Sharada', palika_name_ne: 'शारदा', palika_full_name_en: 'Sharada Municipality', palika_full_name_ne: 'शारदा नगरपालिका', palika_label: 'शारदा नगरपालिका / Sharada Municipality' },
  { palika_id: 'karnali-salyan-siddha-kumakh-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Siddha Kumakh', palika_name_ne: 'सिद्ध कुमाख', palika_full_name_en: 'Siddha Kumakh Gaunpalika', palika_full_name_ne: 'सिद्ध कुमाख गाउँपालिका', palika_label: 'सिद्ध कुमाख गाउँपालिका / Siddha Kumakh Gaunpalika' },
  { palika_id: 'karnali-salyan-tribeni-gaunpalika', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Salyan', district_ne: 'सल्यान', palika_name_en: 'Tribeni', palika_name_ne: 'त्रिवेणी', palika_full_name_en: 'Tribeni Gaunpalika', palika_full_name_ne: 'त्रिवेणी गाउँपालिका', palika_label: 'त्रिवेणी गाउँपालिका / Tribeni Gaunpalika' },
  { palika_id: 'karnali-surkhet-birendranagar-municipality', province_en: 'Karnali', province_ne: 'कर्णाली', district_en: 'Surkhet', district_ne: 'सुर्खेत', palika_name_en: 'Birendranagar', palika_name_ne: 'वीरेन्द्रनगर', palika_full_name_en: 'Birendranagar Municipality', palika_full_name_ne: 'वीरेन्द्रनगर नगरपालिका', palika_label: 'वीरेन्द्रनगर नगरपालिका / Birendranagar Municipality' },
  { palika_id: 'koshi-jhapa-mechinagar-municipality', province_en: 'Koshi', province_ne: 'कोशी', district_en: 'Jhapa', district_ne: 'झापा', palika_name_en: 'Mechinagar', palika_name_ne: 'मेचीनगर', palika_full_name_en: 'Mechinagar Municipality', palika_full_name_ne: 'मेचीनगर नगरपालिका', palika_label: 'मेचीनगर नगरपालिका / Mechinagar Municipality' },
  { palika_id: 'koshi-morang-biratnagar-metropolitan-city', province_en: 'Koshi', province_ne: 'कोशी', district_en: 'Morang', district_ne: 'मोरंग', palika_name_en: 'Biratnagar', palika_name_ne: 'विराटनगर', palika_full_name_en: 'Biratnagar Metropolitan City', palika_full_name_ne: 'विराटनगर महानगरपालिका', palika_label: 'विराटनगर महानगरपालिका / Biratnagar Metropolitan City' },
  { palika_id: 'koshi-sunsari-dharan-sub-metropolitan-city', province_en: 'Koshi', province_ne: 'कोशी', district_en: 'Sunsari', district_ne: 'सुनसरी', palika_name_en: 'Dharan', palika_name_ne: 'धरान', palika_full_name_en: 'Dharan Sub-Metropolitan City', palika_full_name_ne: 'धरान उपमहानगरपालिका', palika_label: 'धरान उपमहानगरपालिका / Dharan Sub-Metropolitan City' },
  { palika_id: 'koshi-sunsari-itahari-sub-metropolitan-city', province_en: 'Koshi', province_ne: 'कोशी', district_en: 'Sunsari', district_ne: 'सुनसरी', palika_name_en: 'Itahari', palika_name_ne: 'इटहरी', palika_full_name_en: 'Itahari Sub-Metropolitan City', palika_full_name_ne: 'इटहरी उपमहानगरपालिका', palika_label: 'इटहरी उपमहानगरपालिका / Itahari Sub-Metropolitan City' },
  { palika_id: 'lumbini-banke-nepalgunj-sub-metropolitan-city', province_en: 'Lumbini', province_ne: 'लुम्बिनी', district_en: 'Banke', district_ne: 'बाँके', palika_name_en: 'Nepalgunj', palika_name_ne: 'नेपालगञ्ज', palika_full_name_en: 'Nepalgunj Sub-Metropolitan City', palika_full_name_ne: 'नेपालगञ्ज उपमहानगरपालिका', palika_label: 'नेपालगञ्ज उपमहानगरपालिका / Nepalgunj Sub-Metropolitan City' },
  { palika_id: 'lumbini-dang-ghorahi-sub-metropolitan-city', province_en: 'Lumbini', province_ne: 'लुम्बिनी', district_en: 'Dang', district_ne: 'दाङ', palika_name_en: 'Ghorahi', palika_name_ne: 'घोराही', palika_full_name_en: 'Ghorahi Sub-Metropolitan City', palika_full_name_ne: 'घोराही उपमहानगरपालिका', palika_label: 'घोराही उपमहानगरपालिका / Ghorahi Sub-Metropolitan City' },
  { palika_id: 'lumbini-dang-tulsipur-sub-metropolitan-city', province_en: 'Lumbini', province_ne: 'लुम्बिनी', district_en: 'Dang', district_ne: 'दाङ', palika_name_en: 'Tulsipur', palika_name_ne: 'तुलसीपुर', palika_full_name_en: 'Tulsipur Sub-Metropolitan City', palika_full_name_ne: 'तुलसीपुर उपमहानगरपालिका', palika_label: 'तुलसीपुर उपमहानगरपालिका / Tulsipur Sub-Metropolitan City' },
  { palika_id: 'lumbini-rupandehi-butwal-sub-metropolitan-city', province_en: 'Lumbini', province_ne: 'लुम्बिनी', district_en: 'Rupandehi', district_ne: 'रुपन्देही', palika_name_en: 'Butwal', palika_name_ne: 'बुटवल', palika_full_name_en: 'Butwal Sub-Metropolitan City', palika_full_name_ne: 'बुटवल उपमहानगरपालिका', palika_label: 'बुटवल उपमहानगरपालिका / Butwal Sub-Metropolitan City' },
  { palika_id: 'lumbini-rupandehi-tilottama-municipality', province_en: 'Lumbini', province_ne: 'लुम्बिनी', district_en: 'Rupandehi', district_ne: 'रुपन्देही', palika_name_en: 'Tilottama', palika_name_ne: 'तिलोत्तमा', palika_full_name_en: 'Tilottama Municipality', palika_full_name_ne: 'तिलोत्तमा नगरपालिका', palika_label: 'तिलोत्तमा नगरपालिका / Tilottama Municipality' },
  { palika_id: 'madhesh-bara-kalaiya-sub-metropolitan-city', province_en: 'Madhesh', province_ne: 'मधेश', district_en: 'Bara', district_ne: 'बारा', palika_name_en: 'Kalaiya', palika_name_ne: 'कलैया', palika_full_name_en: 'Kalaiya Sub-Metropolitan City', palika_full_name_ne: 'कलैया उपमहानगरपालिका', palika_label: 'कलैया उपमहानगरपालिका / Kalaiya Sub-Metropolitan City' },
  { palika_id: 'madhesh-parsa-birgunj-metropolitan-city', province_en: 'Madhesh', province_ne: 'मधेश', district_en: 'Parsa', district_ne: 'पर्सा', palika_name_en: 'Birgunj', palika_name_ne: 'वीरगञ्ज', palika_full_name_en: 'Birgunj Metropolitan City', palika_full_name_ne: 'वीरगञ्ज महानगरपालिका', palika_label: 'वीरगञ्ज महानगरपालिका / Birgunj Metropolitan City' },
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
  'client_submission_id',
  'source',
  'province_pcode',
  'district_pcode',
  'palika_pcode',
  'palika_type_en',
  'palika_type_ne',
  'submitter_email',
];

const FORM_FIELD_MAP = [
  ['event_name', 'घटनाको नाम / Event name', 'event'],
  ['palika', 'पालिकाको नाम / Palika name', 'palika'],
  ['operator_name', 'तपाईंको नाम / Your name', 'text', true],
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

const FORM_DESCRIPTION = [
  'यो फाराम विपद् भएको पहिलो ७२ घण्टाभित्र पालिकाबाट प्रारम्भिक द्रुत मूल्यांकन सूचना संकलन गर्न प्रयोग गरिन्छ।',
  'कृपया सक्रिय घटना र आफ्नो पालिका छानेर उपलब्ध तथ्यांक मात्र भर्नुहोस्। अनिवार्य प्रश्नहरूमा * चिन्ह छ।',
  'संख्यात्मक प्रश्नमा संख्या मात्र लेख्नुहोस्। जानकारी उपलब्ध नभएको गैर-अनिवार्य प्रश्न खाली छोड्न सकिन्छ।',
  'एउटै घटना र पालिकाको दोस्रो पेशी duplicate review का लागि चिन्हित हुन्छ। सच्याउनुपर्ने भए edit response link वा DEOC समन्वयकर्तालाई सम्पर्क गर्नुहोस्।',
  '',
  'Use this form to submit Initial Rapid Assessment information from the palika within the first 72 hours after a disaster.',
  'Select the active event and your palika, then enter only the information currently available. Required questions are marked with *.',
  'Enter numbers only in numeric questions. Optional fields may be left blank when information is not yet available.',
  'A second submission for the same event and palika will be flagged for duplicate review. Use the edit response link or contact the DEOC coordinator for corrections.',
].join('\n');

const FORM_SECTIONS = {
  identification: {
    title: 'पहिचान / Identification',
    description:
      'घटना, पालिका, नाम, इमेल र पेश गर्ने तरिका छान्नुहोस्। / Select the event, palika, name, email, and submission type.',
  },
  affectedPopulation: {
    title: 'प्रभावित जनसंख्या / Affected Population',
    description:
      'मृत्यु, बेपत्ता, घाइते, विस्थापित घरधुरी र कुल प्रभावित जनसंख्या लेख्नुहोस्। / Enter deaths, missing, injured, displaced households, and total affected population.',
  },
  searchAndRescue: {
    title: 'खोज तथा उद्धार / Search and Rescue',
    description:
      'खोज तथा उद्धारको अवस्था, सम्पन्न वडा र उद्धार संख्या लेख्नुहोस्। / Enter rescue status, completed wards, and total rescued.',
  },
  temporaryShelter: {
    title: 'अस्थायी आश्रय / Temporary Shelter',
    description:
      'अस्थायी आश्रयमा रहेका घरधुरी र तत्काल आवास आवश्यकता लेख्नुहोस्। / Enter households using temporary shelter and immediate shelter needs.',
  },
  communicationsElectricity: {
    title: 'संचार तथा विद्युत / Communications and Electricity',
    description:
      'संचार र विद्युत सेवा अवरुद्ध भए/नभएको उल्लेख गर्नुहोस्। / Indicate whether communications and electricity services are disrupted.',
  },
  waterSupply: {
    title: 'खानेपानीको आपूर्ति / Water Supply',
    description:
      'खानेपानी आपूर्ति अवरुद्ध भए/नभएको र प्रभावित घरधुरी लेख्नुहोस्। / Indicate water supply disruption and affected households.',
  },
  physicalStructures: {
    title: 'भौतिक संरचना / Physical Structures',
    description:
      'निजी घर, सरकारी कार्यालय र सार्वजनिक भवनको पूर्ण तथा आंशिक क्षति लेख्नुहोस्। / Enter full and partial damage to private houses, government offices, and public buildings.',
  },
  immediateNeeds: {
    title: 'तत्काल आवश्यकता / Immediate Needs',
    description:
      'राहत सामग्री र पिउने पानीको तत्काल आवश्यकता लेख्नुहोस्। / Enter immediate needs for relief items and drinking water.',
  },
};

function setupDrishti() {
  const resources = getOrCreateResources_();
  const spreadsheet = resources.spreadsheet;
  const form = resources.form;

  ensureSheet_(spreadsheet, DRISHTI.sheets.eventConfig, EVENT_CONFIG_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.submissions, SUBMISSION_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.palikaMaster, PALIKA_MASTER_HEADERS);
  ensureSheet_(spreadsheet, DRISHTI.sheets.mockData, SUBMISSION_HEADERS);
  seedDefaultEvent_(spreadsheet);
  importPalikaMasterIfConfigured_(spreadsheet);

  configureForm_(form, spreadsheet);
  try {
    maybeCleanupFormResponsesSheet_(spreadsheet);
  } catch (error) {
    Logger.log(`Form Responses cleanup failed but setup will continue: ${error.stack || error.message}`);
  }

  PropertiesService.getScriptProperties().setProperties({
    [SCRIPT_PROPERTIES.sheetId]: spreadsheet.getId(),
    [SCRIPT_PROPERTIES.formId]: form.getId(),
    [SCRIPT_PROPERTIES.legacySheetId]: spreadsheet.getId(),
    [SCRIPT_PROPERTIES.legacyFormId]: form.getId(),
  });

  Logger.log(resources.created ? 'Creating new IRA Sheet and Form resources.' : 'Updating existing IRA Sheet and Form resources.');
  Logger.log(`Spreadsheet URL / Google Sheets: ${spreadsheet.getUrl()}`);
  Logger.log(`Form URL / Google Form: ${form.getPublishedUrl()}`);
  Logger.log(`QR URL / क्यूआर: ${qrCodeUrl_(form.getPublishedUrl())}`);
}

function refreshActiveEventFormChoices() {
  const spreadsheet = getSpreadsheet_();
  const form = FormApp.openById(getStoredProperty_(SCRIPT_PROPERTIES.formId, SCRIPT_PROPERTIES.legacyFormId));
  const activeEvent = getActiveEvent_(spreadsheet);
  const palikas = expectedPalikaChoices_(spreadsheet, activeEvent);

  form.setDescription(FORM_DESCRIPTION);

  const eventItem = findListItem_(form, 'घटनाको नाम / Event name');
  eventItem.setChoiceValues([`${activeEvent.event_name_ne} / ${activeEvent.event_name_en}`]);

  const palikaItem = findListItem_(form, 'पालिकाको नाम / Palika name');
  palikaItem.setChoiceValues(palikas.map((palika) => palika.palika_label));
}

// Run installTrigger() once manually after setupDrishti() so every new Google Form
// response is copied from Form Responses 1 into the normalized Submissions tab.
function installTrigger() {
  const spreadsheet = getSpreadsheet_();
  const form = FormApp.openById(getStoredProperty_(SCRIPT_PROPERTIES.formId, SCRIPT_PROPERTIES.legacyFormId));

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  Logger.log(`Installed onFormSubmit trigger for linked form: ${form.getEditUrl()}`);
  Logger.log(`Response spreadsheet / प्रतिक्रियाको स्प्रेडसिट: ${spreadsheet.getUrl()}`);
}

function onFormSubmit(e) {
  const spreadsheet = getSpreadsheet_();
  const response = formResponseRowMap_(spreadsheet, e);
  const row = buildSubmissionRow_(spreadsheet, response);
  const submissionsSheet = ensureSheet_(spreadsheet, DRISHTI.sheets.submissions, SUBMISSION_HEADERS);
  appendObject_(submissionsSheet, SUBMISSION_HEADERS, row);
  Logger.log(`Synced form response to Submissions: ${row.event_id} / ${row.palika_id}`);
}

function normalizeSubmission(e) {
  onFormSubmit(e);
}

// Run this manually only if repeated setupDrishti() runs have created duplicate
// columns in the legacy Google Form response sheet. It is not required for the
// standalone cascading HTML form, which writes directly to Submissions.
function cleanupFormResponsesSheet() {
  cleanupFormResponsesSheet_(getSpreadsheet_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  let payload = {};

  try {
    lock.waitLock(30000);
    hasLock = true;
    const spreadsheet = getSpreadsheet_();
    payload = parseJsonPost_(e);
    const row = buildWebSubmissionRow_(spreadsheet, payload);
    const submissionsSheet = ensureSheet_(spreadsheet, DRISHTI.sheets.submissions, SUBMISSION_HEADERS);
    appendObject_(submissionsSheet, SUBMISSION_HEADERS, row);
    Logger.log(`Synced standalone form submission to Submissions: ${row.event_id} / ${row.palika_id}`);
    let emailSent = false;
    try {
      emailSent = sendSubmissionConfirmationEmail_(row);
    } catch (emailError) {
      Logger.log(`Confirmation email failed but submission succeeded: ${emailError.stack || emailError.message}`);
    }
    return submissionResponse_(e, {
      ok: true,
      client_submission_id: row.client_submission_id,
      event_id: row.event_id,
      palika_id: row.palika_id,
      duplicate_status: row.duplicate_status,
      email_sent: emailSent,
    });
  } catch (error) {
    Logger.log(`Standalone form submission failed: ${error.stack || error.message}`);
    return submissionResponse_(e, {
      ok: false,
      client_submission_id: payload.client_submission_id || '',
      error: error.message || String(error),
    });
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === 'status') {
    const spreadsheet = getSpreadsheet_();
    const found = hasClientSubmission_(spreadsheet, params.submission_id);
    return jsonpResponse_(params.callback, { ok: true, found });
  }
  return jsonpResponse_(params.callback, { ok: false, error: 'Unsupported action' });
}

function sendSubmissionConfirmationEmail_(row) {
  const email = String(row.submitter_email || '').trim();
  if (!email) return false;

  const reference = row.client_submission_id || '—';
  const locationNe = `${row.palika_name_ne || '—'}, ${row.district_ne || '—'}, ${row.province_ne || '—'}`;
  const locationEn = `${row.palika_name_en || '—'}, ${row.district_en || '—'}, ${row.province_en || '—'}`;
  const detailLines = submissionEmailDetailLines_(row);
  const nepaliDetails = detailLines.length ? ['विवरण / Details'].concat(detailLines, ['']) : [];
  const englishDetails = detailLines.length ? ['Details'].concat(detailLines, ['']) : [];
  const subject = 'रिपोर्ट प्राप्त भयो / Report received';
  const body = [
    'नमस्कार,',
    '',
    'तपाईंको प्रारम्भिक द्रुत मूल्यांकन रिपोर्ट प्राप्त भयो।',
    `स्थान: ${locationNe}`,
    `सन्दर्भ नम्बर: ${reference}`,
    '',
    ...nepaliDetails,
    'यो स्वचालित सन्देश हो।',
    '',
    'Hello,',
    '',
    'Your Initial Rapid Assessment report has been received.',
    `Location: ${locationEn}`,
    `Reference number: ${reference}`,
    '',
    ...englishDetails,
    'This is an automated message.',
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject,
    body,
    name: 'Disaster Situation Dashboard',
  });
  return true;
}

function submissionEmailDetailLines_(row) {
  const skippedKeys = {
    event_name: true,
    palika: true,
    operator_name: true,
    submission_type: true,
  };

  return FORM_FIELD_MAP.reduce((lines, field) => {
    const key = field[0];
    const label = field[1];
    const type = field[2];
    if (skippedKeys[key] || !Object.prototype.hasOwnProperty.call(row, key)) return lines;

    const value = row[key];
    if (value === '' || value === null || value === undefined) return lines;

    lines.push(`${label}: ${emailDetailValue_(value, type)}`);
    return lines;
  }, []);
}

function emailDetailValue_(value, type) {
  if (type === 'yes_no') {
    return value === true || String(value).toLowerCase() === 'true' ? 'हो / Yes' : 'होइन / No';
  }
  return value;
}

function buildSubmissionRow_(spreadsheet, response) {
  logResponseMapKeys_(response);
  const activeEvent = getActiveEvent_(spreadsheet);
  const eventEntry = responseEntryForTitle_(response, 'घटनाको नाम / Event name');
  Logger.log(`Event entry: found=${eventEntry.found}, key="${eventEntry.key}", value="${eventEntry.value}"`);
  const submittedEvent = findEventByLabel_(spreadsheet, eventEntry.value);
  const event = submittedEvent || activeEvent;
  const palikaEntry = responseEntryForTitle_(response, 'पालिकाको नाम / Palika name');
  Logger.log(`Palika entry: found=${palikaEntry.found}, key="${palikaEntry.key}", value="${palikaEntry.value}"`);
  const palika = findPalikaByLabel_(spreadsheet, palikaEntry.value);
  const submissionType = responseValueForTitle_(response, 'पेश गर्ने तरिका / Submission type') || '';
  const duplicate = hasDuplicate_(spreadsheet, event.event_id, palika.palika_id);

  const row = {
    event_id: event.event_id,
    event_name_ne: event.event_name_ne,
    event_name_en: event.event_name_en,
    palika_id: palika.palika_id,
    palika_name_ne: palika.palika_full_name_ne,
    palika_name_en: palika.palika_full_name_en,
    district_ne: palika.district_ne,
    district_en: palika.district_en,
    province_ne: palika.province_ne,
    province_en: palika.province_en,
    submitted_at:
      responseValueForTitle_(response, 'Timestamp') ||
      responseValueForTitle_(response, 'पेश गरिएको मिति / Submission date and time') ||
      new Date(),
    operator_name:
      responseValueForTitle_(response, 'तपाईंको नाम / Your name') ||
      responseValueForTitle_(response, 'सञ्चालकको नाम / Operator name'),
    submission_type: englishSubmissionType_(submissionType),
    submission_type_ne: nepaliSubmissionType_(submissionType),
    is_proxy: isProxySubmission_(submissionType),
    duplicate_status: duplicate ? 'DUPLICATE_REVIEW_REQUIRED' : '',
    override_duplicate: '',
    client_submission_id: '',
    source: 'google_form',
    province_pcode: '',
    district_pcode: '',
    palika_pcode: '',
    palika_type_en: palika.palika_type_en || '',
    palika_type_ne: palika.palika_type_ne || '',
    submitter_email: responseValueForTitle_(response, 'इमेल / Email') || '',
  };

  FORM_FIELD_MAP.forEach(([key, title]) => {
    const match = responseEntryForTitle_(response, title);
    Logger.log(
      `FORM_FIELD_MAP lookup: key="${key}", title="${title}", found=${match.found}, matchedKey="${match.key}", value="${formatLogValue_(match.value)}"`,
    );
    if (SUBMISSION_HEADERS.indexOf(key) > -1 && !Object.prototype.hasOwnProperty.call(row, key)) {
      row[key] = normalizeValue_(match.value);
    }
  });

  return row;
}

function buildWebSubmissionRow_(spreadsheet, payload) {
  validateWebSubmission_(payload);

  const event = getActiveEvent_(spreadsheet);
  const palika = findPalikaForWebSubmission_(spreadsheet, payload);
  const submissionType = String(webFieldValue_(payload, 'submission_type') || 'Direct');
  const duplicate = hasDuplicate_(spreadsheet, event.event_id, palika.palika_id);

  const row = {
    event_id: event.event_id,
    event_name_ne: event.event_name_ne,
    event_name_en: event.event_name_en,
    palika_id: palika.palika_id,
    palika_name_ne: palika.palika_full_name_ne,
    palika_name_en: palika.palika_full_name_en,
    district_ne: palika.district_ne,
    district_en: palika.district_en,
    province_ne: palika.province_ne,
    province_en: palika.province_en,
    submitted_at: payload.submitted_at || new Date(),
    operator_name: webFieldValue_(payload, 'operator_name'),
    submitter_email: webFieldValue_(payload, 'submitter_email'),
    submission_type: englishSubmissionType_(submissionType),
    submission_type_ne: nepaliSubmissionType_(submissionType),
    is_proxy: isProxySubmission_(submissionType),
    duplicate_status: duplicate ? 'DUPLICATE_REVIEW_REQUIRED' : '',
    override_duplicate: '',
    client_submission_id: webFieldValue_(payload, 'client_submission_id'),
    source: payload.source || 'standalone_html_form',
    province_pcode: palika.province_pcode,
    district_pcode: palika.district_pcode,
    palika_pcode: palika.palika_pcode,
    palika_type_en: palika.palika_type_en,
    palika_type_ne: palika.palika_type_ne,
  };

  FORM_FIELD_MAP.forEach(([key]) => {
    if (SUBMISSION_HEADERS.indexOf(key) > -1 && !Object.prototype.hasOwnProperty.call(row, key)) {
      row[key] = normalizeWebValue_(webFieldValue_(payload, key));
    }
  });

  return row;
}

function buildForm_(form, spreadsheet) {
  const activeEvent = getActiveEvent_(spreadsheet);
  const expectedPalikas = expectedPalikaChoices_(spreadsheet, activeEvent);
  const numberValidation = FormApp.createTextValidation()
    .requireNumber()
    .setHelpText('संख्या मात्र लेख्नुहोस् / Enter numbers only')
    .build();

  addPageSection_(form, FORM_SECTIONS.identification);
  form
    .addListItem()
    .setTitle('घटनाको नाम / Event name')
    .setChoiceValues([`${activeEvent.event_name_ne} / ${activeEvent.event_name_en}`])
    .setRequired(false);
  form
    .addListItem()
    .setTitle('पालिकाको नाम / Palika name')
    .setChoiceValues(expectedPalikas.map((palika) => palika.palika_label))
    .setRequired(true);
  form
    .addTextItem()
    .setTitle('तपाईंको नाम / Your name')
    .setRequired(true);
  form
    .addTextItem()
    .setTitle('इमेल / Email')
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation()
        .requireTextIsEmail()
        .setHelpText('मान्य इमेल लेख्नुहोस् / Enter a valid email address')
        .build(),
    );
  form
    .addListItem()
    .setTitle('पेश गर्ने तरिका / Submission type')
    .setChoiceValues(DRISHTI.submissionTypes)
    .setRequired(true);
  form
    .addDateTimeItem()
    .setTitle('पेश गरिएको मिति / Submission date and time')
    .setHelpText('स्वतः Google Forms timestamp पनि रेकर्ड हुन्छ। / Google Forms timestamp is also recorded automatically.');

  addSection_(form, FORM_SECTIONS.affectedPopulation, numberValidation, 4, 9);
  addSection_(form, FORM_SECTIONS.searchAndRescue, numberValidation, 9, 12);
  addSection_(form, FORM_SECTIONS.temporaryShelter, numberValidation, 12, 17);
  addSection_(form, FORM_SECTIONS.communicationsElectricity, numberValidation, 17, 19);
  addSection_(form, FORM_SECTIONS.waterSupply, numberValidation, 19, 21);
  addSection_(form, FORM_SECTIONS.physicalStructures, numberValidation, 21, 27);
  addSection_(form, FORM_SECTIONS.immediateNeeds, numberValidation, 27, FORM_FIELD_MAP.length);
}

function getOrCreateResources_() {
  const sheetId = getStoredProperty_(SCRIPT_PROPERTIES.sheetId, SCRIPT_PROPERTIES.legacySheetId);
  const formId = getStoredProperty_(SCRIPT_PROPERTIES.formId, SCRIPT_PROPERTIES.legacyFormId);

  if (sheetId && formId) {
    try {
      Logger.log(`Updating existing IRA resources. Sheet ID: ${sheetId}; Form ID: ${formId}`);
      return {
        spreadsheet: SpreadsheetApp.openById(sheetId),
        form: FormApp.openById(formId),
        created: false,
      };
    } catch (error) {
      Logger.log(`Stored IRA resource IDs could not be opened. Creating new resources instead. Error: ${error.message}`);
    }
  }

  Logger.log('Creating new IRA Sheet and Form resources because saved IDs are empty.');
  return {
    spreadsheet: SpreadsheetApp.create(DRISHTI.spreadsheetName),
    form: FormApp.create(DRISHTI.formName),
    created: true,
  };
}

function getStoredProperty_(primaryKey, legacyKey) {
  const properties = PropertiesService.getScriptProperties();
  return String(properties.getProperty(primaryKey) || properties.getProperty(legacyKey) || '').trim();
}

function configureForm_(form, spreadsheet) {
  form.setTitle(DRISHTI.formName);
  form.setDescription(FORM_DESCRIPTION);
  ensureFormDestination_(form, spreadsheet);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage(
    'पेश गरिएको विवरण प्राप्त भयो। सच्याउनुपर्ने भए कृपया DEOC समन्वयकर्तालाई सम्पर्क गर्नुहोस्। / Your submission has been received. Contact the DEOC coordinator if a correction is needed.',
  );
  removeAllFormItems_(form);
  buildForm_(form, spreadsheet);
}

function ensureFormDestination_(form, spreadsheet) {
  let destinationId = '';
  try {
    destinationId = form.getDestinationId();
  } catch (error) {
    Logger.log(`Form destination was not available and will be set now. Error: ${error.message}`);
  }
  if (destinationId === spreadsheet.getId()) return;
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
}

function removeAllFormItems_(form) {
  const items = form.getItems();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    form.deleteItem(items[index]);
  }
}

function addPageSection_(form, section) {
  form.addPageBreakItem().setTitle(section.title).setHelpText(section.description);
}

function addSection_(form, section, numberValidation, start, end) {
  addPageSection_(form, section);
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
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
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
      'प्रारम्भिक द्रुत मूल्यांकन अभ्यास २०८३',
      'Initial Rapid Assessment Drill 2083',
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
  const url = String(PropertiesService.getScriptProperties().getProperty('PALIKA_MASTER_CSV_URL') || '').trim();
  const rows = url ? fetchPalikaMasterRows_(url) : fallbackPalikaMasterRows_();
  writePalikaMasterRows_(spreadsheet, rows);
}

function fetchPalikaMasterRows_(url) {
  const response = UrlFetchApp.fetch(url);
  return Utilities.parseCsv(response.getContentText());
}

function fallbackPalikaMasterRows_() {
  return [
    PALIKA_MASTER_HEADERS,
    ...FALLBACK_PALIKA_MASTER.map((palika) =>
      PALIKA_MASTER_HEADERS.map((header) => palika[header] ?? ''),
    ),
  ];
}

function writePalikaMasterRows_(spreadsheet, rows) {
  const sheet = spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster);
  sheet.clear();
  if (sheet.getMaxColumns() < rows[0].length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), rows[0].length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
}

function getSpreadsheet_() {
  const id = getStoredProperty_(SCRIPT_PROPERTIES.sheetId, SCRIPT_PROPERTIES.legacySheetId);
  return SpreadsheetApp.openById(id);
}

function getActiveEvent_(spreadsheet) {
  const rows = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.eventConfig));
  const active = rows.find((row) => String(row.active).toUpperCase() === 'TRUE') || rows[0];
  if (!active) throw new Error('No active event found / सक्रिय घटना भेटिएन');
  return active;
}

function parseJsonPost_(e) {
  const contents = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (contents) return JSON.parse(contents);
  if (e && e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  if (e && e.parameter) return e.parameter;
  throw new Error('Empty request body / खाली अनुरोध');
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function submissionResponse_(e, payload) {
  const format = String((e && e.parameter && e.parameter.response_format) || '').trim();
  if (format === 'postMessage') return postMessageResponse_(payload);
  return jsonResponse_(payload);
}

function postMessageResponse_(payload) {
  const message = JSON.stringify({ ...payload, source: 'disaster-submit' }).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    `<!doctype html><html><body><script>window.parent.postMessage(${message}, "*");</script></body></html>`,
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonpResponse_(callback, payload) {
  const callbackName = validJsonpCallback_(callback) ? callback : 'drishtiStatus';
  return ContentService.createTextOutput(`${callbackName}(${JSON.stringify(payload)});`).setMimeType(
    ContentService.MimeType.JAVASCRIPT,
  );
}

function validJsonpCallback_(callback) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(String(callback || ''));
}

function validEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function webFieldValue_(payload, key) {
  const fields = payload && payload.fields ? payload.fields : {};
  if (Object.prototype.hasOwnProperty.call(fields, key)) return fields[key];
  if (Object.prototype.hasOwnProperty.call(payload || {}, key)) return payload[key];
  return '';
}

function webLocation_(payload, key) {
  return payload && payload.location && payload.location[key] ? payload.location[key] : {};
}

function validateWebSubmission_(payload) {
  const province = webLocation_(payload, 'province');
  const district = webLocation_(payload, 'district');
  const palika = webLocation_(payload, 'palika');
  const requiredFields = [
    'client_submission_id',
    'operator_name',
    'submitter_email',
    'submission_type',
    'deaths',
    'missing',
    'injured',
    'displaced_households',
    'private_houses_fully_damaged',
  ];

  if (!province.name_en || !district.name_en || !palika.palika_id) {
    throw new Error('Province, district, and palika are required / प्रदेश, जिल्ला र पालिका अनिवार्य छन्');
  }

  requiredFields.forEach((key) => {
    const value = webFieldValue_(payload, key);
    if (value === '' || value === null || value === undefined) {
      throw new Error(`Required field missing: ${key}`);
    }
  });

  if (!validEmail_(webFieldValue_(payload, 'submitter_email'))) {
    throw new Error('Valid email is required / मान्य इमेल अनिवार्य छ');
  }
}

function findPalikaForWebSubmission_(spreadsheet, payload) {
  const province = webLocation_(payload, 'province');
  const district = webLocation_(payload, 'district');
  const palikaPayload = webLocation_(payload, 'palika');
  const master = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster));
  const masterMatch = master.find((row) => row.palika_id === palikaPayload.palika_id);
  const fullNameEn = palikaPayload.full_name_en || palikaPayload.name_en || (masterMatch && masterMatch.palika_full_name_en) || '';
  const fullNameNe = palikaPayload.full_name_ne || palikaPayload.name_ne || (masterMatch && masterMatch.palika_full_name_ne) || '';

  return {
    palika_id: palikaPayload.palika_id,
    province_en: province.name_en || (masterMatch && masterMatch.province_en) || '',
    province_ne: province.name_ne || (masterMatch && masterMatch.province_ne) || '',
    district_en: district.name_en || (masterMatch && masterMatch.district_en) || '',
    district_ne: district.name_ne || (masterMatch && masterMatch.district_ne) || '',
    palika_name_en: palikaPayload.name_en || (masterMatch && masterMatch.palika_name_en) || fullNameEn,
    palika_name_ne: palikaPayload.name_ne || (masterMatch && masterMatch.palika_name_ne) || fullNameNe,
    palika_full_name_en: fullNameEn,
    palika_full_name_ne: fullNameNe,
    palika_label: palikaPayload.label || `${fullNameNe} / ${fullNameEn}`,
    province_pcode: province.ocha_adm1_pcode || '',
    district_pcode: district.ocha_adm2_pcode || '',
    palika_pcode: palikaPayload.ocha_adm3_pcode || '',
    palika_type_en: palikaPayload.type_en || (masterMatch && masterMatch.palika_type_en) || '',
    palika_type_ne: palikaPayload.type_ne || (masterMatch && masterMatch.palika_type_ne) || '',
  };
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

function findEventByLabel_(spreadsheet, label) {
  const eventLabel = String(label || '').trim();
  if (!eventLabel) return null;
  return (
    sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.eventConfig)).find((row) => {
      const bilingual = `${row.event_name_ne} / ${row.event_name_en}`;
      return eventLabel === bilingual || eventLabel === row.event_name_ne || eventLabel === row.event_name_en;
    }) || null
  );
}

function findListItem_(form, title) {
  const item = form.getItems(FormApp.ItemType.LIST).find((candidate) => candidate.getTitle() === title);
  if (!item) throw new Error(`Missing list item: ${title}`);
  return item.asListItem();
}

function findPalikaByLabel_(spreadsheet, label) {
  const master = sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.palikaMaster));
  const rawLabel = String(label || '');
  const lookupLabel = normalizeLookupText_(label);
  const parts = splitPalikaLabel_(label);

  Logger.log(`findPalikaByLabel_ received label: "${rawLabel}"`);
  Logger.log(`findPalikaByLabel_ label length: ${rawLabel.length}`);
  Logger.log(`findPalikaByLabel_ first 10 char codes: ${firstCharCodes_(rawLabel).join(', ')}`);
  master.forEach((row) => {
    const storedLabel = row.palika_label || '';
    const matches = normalizeLookupText_(storedLabel) === lookupLabel;
    Logger.log(`Palika master label compare: "${storedLabel}" | matches=${matches}`);
  });

  const exactMatch = lookupLabel
    ? master.find((row) => normalizeLookupText_(row.palika_label) === lookupLabel)
    : null;
  if (exactMatch) return exactMatch;

  const englishFullNameMatch = findPalikaByEnglishFullName_(master, parts.en);
  if (englishFullNameMatch) {
    Logger.log(`Palika matched by English full name: "${parts.en}" -> "${englishFullNameMatch.palika_full_name_en}"`);
    return englishFullNameMatch;
  }

  const partialMatch = master.find((row) => {
    const englishCandidates = [row.palika_name_en, row.palika_full_name_en].map(normalizeLookupText_).filter(Boolean);
    const nepaliCandidates = [row.palika_name_ne, row.palika_full_name_ne].map(normalizeLookupText_).filter(Boolean);
    const englishLabel = normalizeLookupText_(parts.en || label);
    const nepaliLabel = normalizeLookupText_(parts.ne || label);
    return (
      englishCandidates.some((candidate) => containsLookupText_(englishLabel, candidate)) ||
      nepaliCandidates.some((candidate) => containsLookupText_(nepaliLabel, candidate))
    );
  });
  if (partialMatch) return partialMatch;

  Logger.log(`Palika not found in master. Using minimal fallback. Unmatched label: ${label}`);
  return fallbackPalikaFromLabel_(label);
}

function findPalikaByEnglishFullName_(master, englishLabel) {
  const englishLookup = normalizeLookupText_(englishLabel);
  if (!englishLookup) return null;
  return (
    master.find((row) => {
      const fullName = normalizeLookupText_(row.palika_full_name_en);
      return fullName === englishLookup || containsLookupText_(englishLookup, fullName);
    }) || null
  );
}

function normalizeLookupText_(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstCharCodes_(value) {
  return String(value || '')
    .slice(0, 10)
    .split('')
    .map((character) => character.charCodeAt(0));
}

function splitPalikaLabel_(label) {
  const parts = String(label || '').split(/\s*\/\s*/);
  return {
    ne: (parts[0] || '').trim(),
    en: (parts.slice(1).join(' / ') || parts[0] || '').trim(),
  };
}

function containsLookupText_(label, candidate) {
  if (!label || !candidate) return false;
  return label.indexOf(candidate) > -1 || candidate.indexOf(label) > -1;
}

function fallbackPalikaFromLabel_(label) {
  const parts = splitPalikaLabel_(label);
  const englishName = parts.en || parts.ne || 'Unknown Palika';
  const nepaliName = parts.ne || parts.en || 'पालिका नाम उपलब्ध छैन';
  return {
    palika_id: `unmatched-${slugify_(englishName || nepaliName)}`,
    province_en: '',
    province_ne: '',
    district_en: '',
    district_ne: '',
    palika_name_en: englishName,
    palika_name_ne: nepaliName,
    palika_full_name_en: englishName,
    palika_full_name_ne: nepaliName,
    palika_label: `${nepaliName} / ${englishName}`,
    is_proxy: false,
  };
}

function slugify_(value) {
  const slug = normalizeLookupText_(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'palika';
}

function responseMap_(response) {
  const map = {};
  if (response.getTimestamp) {
    map.Timestamp = response.getTimestamp();
  }
  response.getItemResponses().forEach((itemResponse) => {
    map[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  return map;
}

function logResponseMapKeys_(response) {
  const keys = Object.keys(response || {});
  Logger.log(`Response map keys (${keys.length}): ${keys.map((key) => `"${key}"`).join(', ')}`);
}

function responseValueForTitle_(response, title) {
  return responseEntryForTitle_(response, title).value;
}

function responseEntryForTitle_(response, title) {
  const responseMap = response || {};
  if (Object.prototype.hasOwnProperty.call(responseMap, title)) {
    return { found: true, key: title, value: responseMap[title] };
  }

  const normalizedTitle = normalizeLookupText_(title);
  const matchingKey = Object.keys(responseMap).find((key) => normalizeLookupText_(key) === normalizedTitle);
  if (matchingKey) {
    return { found: true, key: matchingKey, value: responseMap[matchingKey] };
  }

  return { found: false, key: '', value: '' };
}

function formatLogValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(formatLogValue_).join('; ');
  return String(value ?? '');
}

function formResponseRowMap_(spreadsheet, e) {
  Logger.log('Using namedValues path: ' + (e && e.namedValues ? 'yes' : 'no'));
  if (e && e.namedValues) return responseMapFromNamedValues_(e.namedValues);
  if (e && e.response) return responseMap_(e.response);
  if (e && e.range) return responseMapFromRange_(e.range);

  const responseSheet = getFormResponsesSheet_(spreadsheet);
  return responseMapFromRange_(responseSheet.getRange(responseSheet.getLastRow(), 1, 1, responseSheet.getLastColumn()));
}

function responseMapFromRange_(range) {
  const sheet = range.getSheet();
  const columnCount = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, columnCount).getValues()[0];
  const values = sheet.getRange(range.getRow(), 1, 1, columnCount).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    if (header) map[header] = values[index];
  });
  return map;
}

function responseMapFromNamedValues_(namedValues) {
  const map = {};
  Object.keys(namedValues).forEach((key) => {
    const value = namedValues[key];
    map[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
  });
  return map;
}

function getFormResponsesSheet_(spreadsheet) {
  const responseSheet = spreadsheet.getSheetByName('Form Responses 1');
  if (responseSheet) return responseSheet;

  const matchingSheet = spreadsheet.getSheets().find((sheet) => /^Form Responses \d+$/.test(sheet.getName()));
  if (matchingSheet) return matchingSheet;

  throw new Error('Form Responses 1 sheet not found / Form Responses 1 पाना भेटिएन');
}

function maybeCleanupFormResponsesSheet_(spreadsheet) {
  const autoCleanup = String(
    PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTIES.autoCleanupFormResponses) || '',
  ).toUpperCase();

  if (autoCleanup !== 'TRUE') {
    Logger.log(
      `Form Responses cleanup skipped during setup. Run cleanupFormResponsesSheet() manually, or set ${SCRIPT_PROPERTIES.autoCleanupFormResponses}=TRUE to enable automatic cleanup.`,
    );
    return;
  }

  cleanupFormResponsesSheet_(spreadsheet);
}

function cleanupFormResponsesSheet_(spreadsheet) {
  let responseSheet;
  try {
    responseSheet = getFormResponsesSheet_(spreadsheet);
  } catch (error) {
    Logger.log(`Skipping Form Responses cleanup: ${error.message}`);
    return;
  }

  const lastColumn = responseSheet.getLastColumn();
  if (lastColumn < 2) {
    Logger.log('Form Responses cleanup skipped: fewer than two columns.');
    return;
  }

  const headers = responseSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const seen = {};
  const duplicateColumns = [];

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeLookupText_(header);
    if (!normalizedHeader) return;
    if (seen[normalizedHeader]) {
      duplicateColumns.push(index + 1);
      return;
    }
    seen[normalizedHeader] = true;
  });

  duplicateColumns
    .slice()
    .reverse()
    .forEach((column) => {
      const maxColumns = responseSheet.getMaxColumns();
      if (column < 1 || column > maxColumns) {
        Logger.log(`Skipping Form Responses cleanup column ${column}: current max columns is ${maxColumns}.`);
        return;
      }
      responseSheet.deleteColumn(column);
    });

  Logger.log(
    `Form Responses cleanup complete. Removed ${duplicateColumns.length} duplicate columns: ${duplicateColumns.join(', ') || 'none'}`,
  );
}

function hasDuplicate_(spreadsheet, eventId, palikaId) {
  return sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.submissions)).some(
    (row) => row.event_id === eventId && row.palika_id === palikaId,
  );
}

function hasClientSubmission_(spreadsheet, clientSubmissionId) {
  const targetId = String(clientSubmissionId || '').trim();
  if (!targetId) return false;
  return sheetObjects_(spreadsheet.getSheetByName(DRISHTI.sheets.submissions)).some(
    (row) => String(row.client_submission_id || '').trim() === targetId,
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

function normalizeWebValue_(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === '') return '';
  return text;
}

function englishSubmissionType_(value) {
  if (value.indexOf('Photo') > -1) return 'Photo';
  if (value.indexOf('Voice') > -1) return 'Voice';
  return 'Direct';
}

function isProxySubmission_(value) {
  const submissionType = englishSubmissionType_(String(value || ''));
  return submissionType === 'Photo' || submissionType === 'Voice';
}

function nepaliSubmissionType_(value) {
  const submissionType = englishSubmissionType_(String(value || ''));
  if (submissionType === 'Photo') return 'कागजको फारामको फोटो';
  if (submissionType === 'Voice') return 'फोन कल';
  if (submissionType === 'Direct') return 'सिधा';
  return String(value || '').split('/')[0].trim();
}

function qrCodeUrl_(url) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=320`;
}
