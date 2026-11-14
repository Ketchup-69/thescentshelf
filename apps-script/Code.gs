/**
 * The Scent Shelf: waitlist collector.
 * Paste this into Extensions > Apps Script of the Google Sheet that should hold
 * the waitlist, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Copy the /exec URL into js/config.js.
 */
var SHEET_NAME = 'Waitlist';
var HEADERS = ['Timestamp', 'Name', 'Contact', 'City', 'Perfumes', 'Consent', 'Consent wording', 'Page'];

function doGet() {
  return json_({ ok: true, service: 'The Scent Shelf waitlist' });
}

// Spam limits. The web address of this script is public (it is in js/config.js),
// so anyone could post to it. These checks keep junk out of the sheet.
var MAX_BODY = 8000;          // characters in one request
var MIN_FORM_MS = 2500;       // a person takes longer than this to fill in the form
var MAX_PER_MINUTE = 30;      // signups from everyone, per minute
var MAX_PER_CONTACT = 5;      // attempts with the same phone or email, per 10 minutes

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = e && e.postData ? String(e.postData.contents || '') : '';
    if (!body || body.length > MAX_BODY) return json_({ ok: false, error: 'Bad request' });
    var data = JSON.parse(body);
    // Bots: a filled-in hidden field, or a form "filled in" faster than a person could. Pretend it worked, save nothing.
    if (data.website) return json_({ ok: true, position: null });
    if (typeof data.ms !== 'number' || data.ms < MIN_FORM_MS) return json_({ ok: true, position: null });

    var name = clean_(data.name, 80);
    var contact = clean_(data.contact, 120);
    var city = clean_(data.city, 80);
    var perfumes = (Array.isArray(data.perfumes) ? data.perfumes : []).slice(0, 40).map(function (p) { return clean_(p, 80); }).filter(String);
    if (name.length < 2 || city.length < 2 || !perfumes.length || !validContact_(contact)) return json_({ ok: false, error: 'Missing details' });
    if (data.consent !== true) return json_({ ok: false, error: 'Consent is required' });

    var key = contact.toLowerCase().replace(/[\s()'-]/g, '');
    var cache = CacheService.getScriptCache();
    if (bump_(cache, 'all:' + Math.floor(Date.now() / 60000), 70) > MAX_PER_MINUTE) return json_({ ok: false, error: 'Busy, try again in a minute' });
    if (bump_(cache, 'c:' + key, 600) > MAX_PER_CONTACT) return json_({ ok: false, error: 'Too many attempts' });

    lock.waitLock(20000);
    var sheet = sheet_();
    var rows = sheet.getLastRow() - 1;
    if (rows > 0) {
      var existing = sheet.getRange(2, 3, rows, 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        var seen = String(existing[i][0]).toLowerCase().replace(/[\s()'-]/g, '');
        if (seen === key) return json_({ ok: true, position: i + 1 }); // already on the list: keep their place
      }
    }
    sheet.appendRow([new Date(), safe_(name), safe_(contact), safe_(city), safe_(perfumes.join(', ')), 'Yes', safe_(clean_(data.consentText, 200)), safe_(clean_(data.page, 120))]);
    return json_({ ok: true, position: sheet.getLastRow() - 1 });
  } catch (err) {
    return json_({ ok: false, error: 'Server error' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// A 10 to 13 digit phone number, or an email address.
function validContact_(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return true;
  if (/[^\d\s()+-]/.test(value)) return false;
  var digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

// Adds one to a short-lived counter and returns the new count.
function bump_(cache, key, seconds) {
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), seconds);
  return n;
}

function clean_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

// Stops a value such as "=IMPORTXML(...)" from running as a spreadsheet formula.
function safe_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
