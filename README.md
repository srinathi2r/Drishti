# Disaster Situation Dashboard

Disaster Situation Reporting Tool for Nepal's Ministry of Federal Affairs and General Administration (MoFAGA).

This repository contains a bilingual Nepali/English Initial Rapid Assessment (IRA) workflow for the first 72 hours after a disaster:

- Google Form for palika-level data entry
- Google Sheets database with event-scoped palika lists
- React dashboard for aggregation, submission tracking, alerts, and export
- A4 print-ready blank IRA PDF for field preparedness

## Repository layout

```text
form/Code.gs                         Google Apps Script for Form + Sheet setup
pdf/blank-ira-form.html              Print source for the blank field form
pdf/drishti_blank_ira_form.pdf       Generated A4 PDF
public/data/palika_master.csv        753-palika master list
public/data/event_config.csv         Active event configuration
public/data/expected_palikas.csv     Event-scoped expected palikas
public/data/mock_submissions.csv     20 mock submissions for the dashboard
src/                                 React dashboard
sheets/schema.md                     Google Sheets tab contract
scripts/                             Data and PDF generation scripts
```

## Palika master source

`scripts/fetch_palika_master.py` builds the 753-palika master list from open tables:

- [Wards and electoral divisions of Nepal](https://en.wikipedia.org/wiki/Wards_and_electoral_divisions_of_Nepal)
- [List of cities in Nepal](https://en.wikipedia.org/wiki/List_of_cities_in_Nepal)
- [List of gaunpalikas of Nepal](https://en.wikipedia.org/wiki/List_of_gaunpalikas_of_Nepal)

The generated CSV includes province, district, Nepali and English palika names, palika type, ward count, population, and source URL.

## Local setup

```bash
npm install
npm run build
npm run dev -- --host 127.0.0.1
```

The dashboard defaults to bundled CSV seed data in `public/data`.

To point the dashboard at published Google Sheets CSV tabs, create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then set:

```text
VITE_EVENT_CONFIG_CSV_URL=
VITE_EXPECTED_PALIKAS_CSV_URL=
VITE_SUBMISSIONS_CSV_URL=
VITE_PALIKA_MASTER_CSV_URL=
```

## Event scoping workflow

1. In `Event Config`, create one active event row with `active=TRUE`.
2. Set affected province and districts in Nepali and English.
3. Put the active event's expected palikas in `expected_palika_ids`, separated by semicolons.
4. Run `refreshActiveEventFormChoices()` in Apps Script.
5. The Google Form palika dropdown and dashboard tracker are now scoped to those expected palikas.

The tracker uses event scope, so the headline is `X of Y expected palikas reported`, not `X of 753`.

## Google Form and Sheets

1. Open Apps Script and paste `form/Code.gs`.
2. Set script property `PALIKA_MASTER_CSV_URL` to the raw or published CSV URL for `public/data/palika_master.csv`.
3. Run `setupDrishti()`.
4. Install the `normalizeSubmission` form-submit trigger.
5. Copy the generated Google Form URL for sharing.
6. Use the logged QuickChart QR URL, or any QR generator, to create a shareable QR code.

Native Google Forms cannot show a custom pre-submit summary or block duplicates before submit. The script preserves the Google Form workflow, normalizes district/province into `Submissions`, flags duplicate palika-event submissions, and leaves `override_duplicate` for coordinator review.

## Mock event

The bundled mock event is a neutral IRA drill scoped to 25 expected palikas across Dailekh, Jajarkot, and Salyan in Karnali Province, with 20 submitted mock IRA rows and 5 outstanding palikas.

Regenerate data:

```bash
python3 scripts/fetch_palika_master.py
python3 scripts/build_seed_data.py
```

## Blank PDF form

The generated field form is:

```text
pdf/drishti_blank_ira_form.pdf
public/drishti_blank_ira_form.pdf
```

Regenerate it on macOS with Chrome or Edge installed:

```bash
npm run pdf:build
```

## Deployment

### GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`. Enable GitHub Pages with GitHub Actions as the source, then push to `main`.

### Vercel

Import the repository into Vercel. Use:

```text
Build command: npm run build
Output directory: dist
```

Set the same `VITE_*_CSV_URL` environment variables if using live Google Sheets CSVs.
