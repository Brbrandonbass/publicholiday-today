/**
 * publicholiday.today — Email Holiday Alerts.
 *
 * Two jobs live in this one script:
 *
 *  1. doPost(e) — a webhook that receives {email, country, timestamp} JSON
 *     posts from the signup form on index.html and appends each submission
 *     to a "Signups" sheet.
 *
 *  2. sendHolidayReminders() — a daily job (you wire up the trigger, see
 *     below) that checks every signed-up country for a public holiday
 *     exactly 3 days away and emails everyone signed up for that country.
 *     Sent reminders are logged to a "SentLog" sheet so nobody gets the
 *     same reminder twice.
 *
 * ─── Setup ──────────────────────────────────────────────────────────
 *  1. Create a new Google Sheet (or open an existing one).
 *  2. Extensions → Apps Script, delete any boilerplate, paste this whole file.
 *  3. Deploy → New deployment → type "Web app".
 *     - Execute as: Me
 *     - Who has access: Anyone
 *     Click Deploy, authorize with your Google account, and copy the
 *     "Web app URL" (ends in /exec).
 *  4. Paste that URL into EMAIL_WEBHOOK_URL near the top of the <script> in
 *     index.html, replacing "REPLACE_WITH_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL".
 *  5. In the Apps Script editor, run createDailyTrigger() once (select it in
 *     the function dropdown, click Run, approve the Gmail/permissions
 *     prompt). This schedules sendHolidayReminders() to run every day so the
 *     3-day-before reminders actually go out — step 3 alone only collects
 *     signups, it does not send anything on its own.
 *
 * Sheets created automatically:
 *   Signups  — Timestamp | Email | Country
 *   SentLog  — Email | Country | HolidayDate | SentAt   (de-dupe log)
 */

const SIGNUPS_SHEET = 'Signups';
const SENTLOG_SHEET = 'SentLog';
const REMINDER_DAYS_BEFORE = 3;

// ── Webhook: collect signups ─────────────────────────────────────────
function doPost(e) {
  const sheet = getOrCreateSheet_(SIGNUPS_SHEET, ['Timestamp', 'Email', 'Country']);
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON payload' });
  }

  const email = String(data.email || '').trim();
  const country = String(data.country || '').trim().toUpperCase();
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  if (!email || !country) {
    return jsonResponse_({ ok: false, error: 'Missing email or country' });
  }

  sheet.appendRow([timestamp, email, country]);
  return jsonResponse_({ ok: true });
}

// ── Daily job: send 3-day-before reminders ───────────────────────────
function sendHolidayReminders() {
  const signups = getOrCreateSheet_(SIGNUPS_SHEET, ['Timestamp', 'Email', 'Country']);
  const sentLog = getOrCreateSheet_(SENTLOG_SHEET, ['Email', 'Country', 'HolidayDate', 'SentAt']);

  const rows = signups.getDataRange().getValues().slice(1); // skip header
  if (!rows.length) return;

  // Group signup emails by country so we only fetch each country's calendar once.
  const byCountry = {};
  rows.forEach(([, email, country]) => {
    if (!email || !country) return;
    const code = String(country).toUpperCase();
    if (!byCountry[code]) byCountry[code] = new Set();
    byCountry[code].add(String(email).trim());
  });

  const alreadySent = new Set(
    sentLog.getDataRange().getValues().slice(1).map(r => `${r[0]}|${r[1]}|${r[2]}`)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(today.getTime() + REMINDER_DAYS_BEFORE * 86400000);
  const targetStr = Utilities.formatDate(targetDate, 'UTC', 'yyyy-MM-dd');
  const year = targetDate.getFullYear();

  Object.keys(byCountry).forEach(code => {
    const holidays = fetchHolidays_(code, year);
    const hit = holidays.find(h => h.date === targetStr);
    if (!hit) return;

    byCountry[code].forEach(email => {
      const key = `${email}|${code}|${hit.date}`;
      if (alreadySent.has(key)) return;
      sendReminderEmail_(email, code, hit);
      sentLog.appendRow([email, code, hit.date, new Date()]);
    });
  });
}

function fetchHolidays_(countryCode, year) {
  try {
    const resp = UrlFetchApp.fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return [];
    return JSON.parse(resp.getContentText());
  } catch (err) {
    return [];
  }
}

function sendReminderEmail_(email, countryCode, holiday) {
  const name = holiday.localName || holiday.name;
  const subject = `${name} is in ${REMINDER_DAYS_BEFORE} days`;
  const body = `Hi,\n\n` +
    `Just a heads up: ${name} falls on ${holiday.date} — that's ${REMINDER_DAYS_BEFORE} days from now in ${countryCode}.\n\n` +
    `— publicholiday.today\n` +
    `https://publicholiday.today/${countryCode}\n\n` +
    `You're receiving this because you signed up for holiday alerts for ${countryCode} at publicholiday.today.`;
  MailApp.sendEmail(email, subject, body);
}

// ── One-time setup helper: run this once from the Apps Script editor ─
function createDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendHolidayReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendHolidayReminders')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
}

// ── Helpers ───────────────────────────────────────────────────────────
function getOrCreateSheet_(name, headerRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headerRow);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
