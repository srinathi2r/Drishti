# IRA Google Form setup

1. Open [script.google.com](https://script.google.com/) and create a new Apps Script project.
2. Paste `Code.gs` into the project.
3. Set script property `PALIKA_MASTER_CSV_URL` to the raw or published CSV URL for `public/data/palika_master.csv`.
4. Run `setupDrishti()`.
5. Install a trigger: function `normalizeSubmission`, event source `From form`, event type `On form submit`.
6. Edit `Event Config` and run `refreshActiveEventFormChoices()` whenever the active event scope changes.

Native Google Forms cannot show a custom pre-submit summary or block a duplicate before the user presses submit. This script keeps the Google Form workflow, flags duplicate palika-event submissions in `Submissions`, and leaves `override_duplicate` for the DEOC coordinator to approve.
