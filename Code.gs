// ============================================================
// Google Apps Script — Workout Logger Web App
// ============================================================
// Deploy: New deployment → Web app → Execute as "Me" → Access "Anyone"
// Paste the deployment URL into APPS_SCRIPT_URL in index.html
//
// This script receives POST requests from the dashboard and
// appends a new date column to the correct section in the sheet.
// ============================================================

const SPREADSHEET_ID = '1-90RuZhoTEBevAUqphehDaOtimhbIyPy63nRTEAwmlQ';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { sheetTab, sectionLabel, date, bodyWeight, exercises } = data;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetTab);
    if (!sheet) throw new Error('Sheet tab not found: ' + sheetTab);

    const allData = sheet.getDataRange().getValues();
    const numRows = allData.length;

    // Find the section header row (cell A matches sectionLabel)
    let headerRowIdx = -1;
    for (let r = 0; r < numRows; r++) {
      const cellA = String(allData[r][0] || '').trim();
      if (cellA.toLowerCase() === sectionLabel.toLowerCase()) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) throw new Error('Section not found: ' + sectionLabel);

    // Find next section header to bound our search
    let nextSectionIdx = numRows;
    for (let r = headerRowIdx + 1; r < numRows; r++) {
      const cellA = String(allData[r][0] || '').trim().toLowerCase();
      if (cellA.includes('workout') || cellA === 'back & biceps' ||
          cellA === 'back & legs' || cellA === 'chest + tris') {
        let dateCount = 0;
        for (let c = 1; c < Math.min(allData[r].length, 15); c++) {
          const v = String(allData[r][c] || '').trim();
          if (v && isLikelyDate(v)) dateCount++;
        }
        if (dateCount >= 1) {
          nextSectionIdx = r;
          break;
        }
      }
    }

    // Find the next empty column (after the last non-empty cell in header row)
    const headerRow = allData[headerRowIdx];
    let newCol = 1;
    for (let c = headerRow.length - 1; c >= 1; c--) {
      if (String(headerRow[c] || '').trim()) {
        newCol = c + 1;
        break;
      }
    }

    // Write date into header row (Sheets API is 1-indexed)
    sheet.getRange(headerRowIdx + 1, newCol + 1).setValue(date);

    // Write each exercise value into its matching row
    for (const ex of exercises) {
      if (!ex.value || !ex.value.trim()) continue;
      for (let r = headerRowIdx + 1; r < nextSectionIdx; r++) {
        const rowLabel = String(allData[r][0] || '').trim();
        if (rowLabel.toLowerCase() === ex.name.toLowerCase()) {
          sheet.getRange(r + 1, newCol + 1).setValue(ex.value);
          break;
        }
      }
    }

    // Write body weight if provided
    if (bodyWeight) {
      for (let r = headerRowIdx + 1; r < nextSectionIdx; r++) {
        const rowLabel = String(allData[r][0] || '').trim();
        if (rowLabel.toLowerCase() === 'weight') {
          sheet.getRange(r + 1, newCol + 1).setValue(bodyWeight);
          break;
        }
      }
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function isLikelyDate(str) {
  return /\d/.test(str) && (/\//.test(str) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(str));
}

// Health check endpoint
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Workout logger API is running' })
  ).setMimeType(ContentService.MimeType.JSON);
}
