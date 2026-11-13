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

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var name = clean_(data.name, 80);
    var contact = clean_(data.contact, 120);
    var city = clean_(data.city, 80);
    var perfumes = (Array.isArray(data.perfumes) ? data.perfumes : []).slice(0, 40).map(function (p) { return clean_(p, 80); }).filter(String);
    if (name.length < 2 || contact.length < 5 || city.length < 2 || !perfumes.length) return json_({ ok: false, error: 'Missing details' });
    if (data.consent !== true) return json_({ ok: false, error: 'Consent is required' });

    var sheet = sheet_();
    var key = contact.toLowerCase().replace(/[\s()-]/g, '');
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
