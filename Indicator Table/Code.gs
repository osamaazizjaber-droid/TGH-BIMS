/**
 * TGH Indicator Dashboard - Google Apps Script Backend
 * Serves the HTML dashboard and handles direct Google Sheets integration.
 * Utilizes a relational sheets structure:
 * - "Parm": Project metadata (Project Code, Project Name, Donor, Start Date, End Date)
 * - "indicators": Indicator metrics (Project Code, Description, Targets, Demographics)
 * - "NGO Indicator Database": Flat combined database synced in real-time.
 */

// ======================== CONFIGURATION ========================
// 1. SPREADSHEET_ID: Leave blank if this script was created via "Extensions -> Apps Script" inside your Sheet.
//    If you created this as a standalone script from Google Drive, paste your Google Sheet's ID here!
var SPREADSHEET_ID = ""; 

// 2. SHEET_TAB_NAME: Leave blank to read from the currently active sheet tab.
//    Or specify the exact name of the sheet tab containing your data (e.g. "NGO Indicator Database").
var SHEET_TAB_NAME = "NGO Indicator Database"; 
// ===============================================================

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TGH Indicator Dashboard - KU')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ======================== GOOGLE SHEETS TRIGGERS ========================

/**
 * Creates custom spreadsheet menus and updates validations on load.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('TGH Dashboard')
    .addItem('Setup/Reset Sheets', 'initializeSpreadsheet')
    .addItem('Manually Sync Database', 'syncDatabase')
    .addToUi();
  
  try {
    updateIndicatorProjectValidation();
  } catch (e) {
    Logger.log("Failed to update validation on open: " + e.toString());
  }
}

/**
 * Handles real-time syncing when cells in Parm or indicators sheets are edited.
 */
function onEdit(e) {
  if (!e) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  
  if (sheetName === "Parm" || sheetName === "indicators") {
    syncDatabase();
    if (sheetName === "Parm") {
      updateIndicatorProjectValidation();
    }
  }
}

/**
 * Handles structural spreadsheet changes (like row deletion/insertion) to keep database in sync.
 */
function onChange(e) {
  if (!e) return;
  var changeType = e.changeType;
  if (changeType === "REMOVE_ROW" || changeType === "INSERT_ROW" || changeType === "EDIT" || changeType === "OTHER") {
    syncDatabase();
    updateIndicatorProjectValidation();
  }
}

// ======================== CORE SYNC LOGIC ========================

/**
 * Performs a relational join between "Parm" (projects) and "indicators" sheets in-memory,
 * and writes the compiled flat database to the "NGO Indicator Database" sheet.
 */
function syncDatabase() {
  try {
    var activeSheet = null;
    if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
      activeSheet = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } else {
      activeSheet = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!activeSheet) return;
    
    var parmSheet = activeSheet.getSheetByName("Parm");
    var indSheet = activeSheet.getSheetByName("indicators");
    var dbTabName = SHEET_TAB_NAME || "NGO Indicator Database";
    var dbSheet = activeSheet.getSheetByName(dbTabName);
    
    if (!parmSheet || !indSheet || !dbSheet) {
      Logger.log("Required tabs not found. Skipping sync.");
      return;
    }
    
    // 1. Read Parm sheet and build a project metadata lookup map
    var lastRowParm = parmSheet.getLastRow();
    var projectMap = {};
    if (lastRowParm > 1) {
      // Columns: Code, Name, Donor, Start, End
      var parmValues = parmSheet.getRange(2, 1, lastRowParm - 1, 5).getValues();
      for (var i = 0; i < parmValues.length; i++) {
        var code = String(parmValues[i][0]).trim();
        if (code !== "") {
          projectMap[code.toLowerCase()] = {
            name: parmValues[i][1],
            donor: parmValues[i][2],
            start: parmValues[i][3],
            end: parmValues[i][4]
          };
        }
      }
    }
    
    // 2. Read indicators sheet
    var lastRowInd = indSheet.getLastRow();
    var dbRows = [];
    
    if (lastRowInd > 1) {
      // Columns: Code, Description, Target, Achieved, BNFs, Men, Women, Total
      var indValues = indSheet.getRange(2, 1, lastRowInd - 1, 8).getValues();
      
      for (var j = 0; j < indValues.length; j++) {
        var code = String(indValues[j][0]).trim();
        if (code === "") continue; // Skip entries with empty Project Code
        
        var lookup = projectMap[code.toLowerCase()] || { name: "", donor: "", start: "", end: "" };
        
        var indicator = String(indValues[j][1]).trim();
        var target = indValues[j][2];
        var achieved = indValues[j][3];
        var bnfType = String(indValues[j][4]).trim();
        var noOfMen = indValues[j][5];
        var noOfWomen = indValues[j][6];
        
        // Clean numbers
        target = (target === "" || isNaN(target)) ? 0 : Number(target);
        achieved = (achieved === "" || isNaN(achieved)) ? 0 : Number(achieved);
        noOfMen = (noOfMen === "" || isNaN(noOfMen)) ? 0 : Number(noOfMen);
        noOfWomen = (noOfWomen === "" || isNaN(noOfWomen)) ? 0 : Number(noOfWomen);
        
        // Format dates
        var startDate = lookup.start;
        if (startDate instanceof Date) startDate = formatDate(startDate);
        var endDate = lookup.end;
        if (endDate instanceof Date) endDate = formatDate(endDate);
        
        var dbRowIdx = dbRows.length + 2; // Row position in database tab (row 2 onwards)
        var metricType = classifyMetricType(indicator, bnfType, noOfMen, noOfWomen);
        var formulaTotal = "";
        if (metricType === "People") {
          formulaTotal = "=IF(J" + dbRowIdx + "+K" + dbRowIdx + ">0, J" + dbRowIdx + "+K" + dbRowIdx + ", H" + dbRowIdx + ")";
        }
        
        dbRows.push([
          code,
          lookup.name,
          lookup.donor,
          startDate,
          endDate,
          indicator,
          target,
          achieved,
          bnfType,
          noOfMen,
          noOfWomen,
          formulaTotal
        ]);
      }
    }
    
    // 3. Clear database sheet from row 2 downwards
    var lastRowDb = dbSheet.getLastRow();
    if (lastRowDb > 1) {
      dbSheet.getRange(2, 1, lastRowDb - 1, 12).clearContent();
      dbSheet.getRange(2, 1, lastRowDb - 1, 12).clearFormat();
    }
    
    // 4. Write new compiled rows
    if (dbRows.length > 0) {
      dbSheet.getRange(2, 1, dbRows.length, 12).setValues(dbRows);
      
      // Apply clean formatting and alignments
      dbSheet.getRange(2, 1, dbRows.length, 3).setHorizontalAlignment("left");
      dbSheet.getRange(2, 4, dbRows.length, 2).setHorizontalAlignment("center");
      dbSheet.getRange(2, 6, dbRows.length, 1).setHorizontalAlignment("left");
      dbSheet.getRange(2, 7, dbRows.length, 2).setHorizontalAlignment("right").setNumberFormat("#,##0");
      dbSheet.getRange(2, 9, dbRows.length, 1).setHorizontalAlignment("left");
      dbSheet.getRange(2, 10, dbRows.length, 3).setHorizontalAlignment("right").setNumberFormat("#,##0");
    }
    
    activeSheet.toast("Database successfully synced! " + dbRows.length + " indicators compiled.", "Sync Status");
  } catch (err) {
    Logger.log("Error syncing database: " + err.toString());
  }
}

/**
 * Dynamically binds a list validation containing all codes from the "Parm" sheet to Column A of the "indicators" sheet.
 */
function updateIndicatorProjectValidation() {
  try {
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!activeSheet) return;
    
    var parmSheet = activeSheet.getSheetByName("Parm");
    var indSheet = activeSheet.getSheetByName("indicators");
    if (!parmSheet || !indSheet) return;
    
    var lastRowParm = parmSheet.getLastRow();
    var projectCodes = [];
    if (lastRowParm > 1) {
      var values = parmSheet.getRange(2, 1, lastRowParm - 1, 1).getValues();
      var uniqueCodes = {};
      for (var i = 0; i < values.length; i++) {
        var val = String(values[i][0]).trim();
        if (val !== "") {
          uniqueCodes[val] = true;
        }
      }
      projectCodes = Object.keys(uniqueCodes);
    }
    
    var indLastRow = Math.max(indSheet.getLastRow() + 100, 200);
    var range = indSheet.getRange(2, 1, indLastRow - 1, 1);
    
    if (projectCodes.length > 0) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(projectCodes, true)
        .setAllowInvalid(true)
        .setHelpText("Select a project code from the Parm sheet, or type a new one.")
        .build();
      range.setDataValidation(rule);
    } else {
      range.clearDataValidations();
    }
  } catch (err) {
    Logger.log("Failed to update validation: " + err.toString());
  }
}

// ======================== API AND HELPER FUNCTIONS ========================

/**
 * Main API function called by the frontend to fetch project data.
 */
function getProjectData() {
  try {
    var activeSheet = null;
    if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
      activeSheet = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } else {
      activeSheet = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!activeSheet) {
      Logger.log("No active spreadsheet found. Falling back to mock data.");
      return getMockDataResponse("Demo Mode: No Google Sheet detected.");
    }
    
    var sheet = null;
    if (SHEET_TAB_NAME && SHEET_TAB_NAME.trim() !== "") {
      sheet = activeSheet.getSheetByName(SHEET_TAB_NAME.trim());
    }
    
    if (!sheet) {
      sheet = activeSheet.getActiveSheet();
    }
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length <= 1) {
      Logger.log("Spreadsheet is empty or only contains headers. Falling back to mock data.");
      return getMockDataResponse("Demo Mode: Google Sheet tab '" + sheet.getName() + "' is empty.");
    }
    
    var headerRowIdx = 0;
    for (var r = 0; r < Math.min(values.length, 10); r++) {
      var row = values[r];
      var hasKeyHeader = row.some(function(cell) {
        var c = String(cell).toLowerCase().trim();
        return c.indexOf('project code') !== -1 || 
               c.indexOf('project name') !== -1 || 
               c.indexOf('donor') !== -1 ||
               c.indexOf('indicator') !== -1;
      });
      if (hasKeyHeader) {
        headerRowIdx = r;
        break;
      }
    }
    
    var headers = values[headerRowIdx].map(function(h) {
      return String(h).trim();
    });
    
    var mappedData = [];
    
    for (var i = headerRowIdx + 1; i < values.length; i++) {
      var row = values[i];
      var isEmpty = row.every(function(val) {
        return val === "" || val === null || val === undefined;
      });
      if (isEmpty) continue;
      
      var record = {};
      var standardKeys = [
        'projectCode', 'projectName', 'donor', 'startDate', 'endDate', 
        'indicator', 'target', 'achievedTarget', 
        'bnfType', 'noOfMen', 'noOfWomen', 'total'
      ];

      headers.forEach(function(header, idx) {
        var value = row[idx];
        if (value === undefined || value === null) value = "";
        
        var normalizedKey = normalizeHeader(header);
        var isStandardKey = standardKeys.indexOf(normalizedKey) !== -1;
        if (!isStandardKey && idx < standardKeys.length) {
          normalizedKey = standardKeys[idx];
        }
        
        if (value instanceof Date) {
          record[normalizedKey] = formatDate(value);
        } else if (typeof value === 'number') {
          record[normalizedKey] = value;
        } else {
          var stringVal = String(value).trim();
          if (isNumericColumn(normalizedKey)) {
            var parsedNum = parseFloat(stringVal.replace(/[\$,]/g, ''));
            record[normalizedKey] = isNaN(parsedNum) ? 0 : parsedNum;
          } else {
            record[normalizedKey] = stringVal;
          }
        }
      });
      
      var men = record['noOfMen'] || 0;
      var women = record['noOfWomen'] || 0;
      var calculatedTotal = men + women;
      
      if (!record['total'] || record['total'] === 0) {
        if (calculatedTotal > 0) {
          record['total'] = calculatedTotal;
        } else if (record['metricType'] === 'People' || !record['metricType']) {
          record['total'] = record['achievedTarget'] || 0;
        } else {
          record['total'] = 0;
        }
      }
      
      var target = record['target'] || 0;
      var achieved = record['achievedTarget'] || 0;
      record['progressRate'] = target > 0 ? Math.round((achieved / target) * 100) : 0;
      
      var sector = classifySector(record['projectName'], record['indicator']);
      var metricType = classifyMetricType(record['indicator'], record['bnfType'], men, women);
      record['sector'] = sector;
      record['metricType'] = metricType;
      
      mappedData.push(record);
    }
    
    var payload = {
      status: "success",
      source: "Google Sheet (" + sheet.getName() + ")",
      data: mappedData,
      isDemo: false,
      headers: headers
    };
    return JSON.stringify(payload);
    
  } catch (error) {
    Logger.log("Error reading spreadsheet: " + error.toString());
    return getMockDataResponse("Demo Mode: Encountered error reading sheet (" + error.message + "). Serving demo data instead.");
  }
}

function normalizeHeader(header) {
  var h = header.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
  
  if (h.indexOf('project code') !== -1) return 'projectCode';
  if (h.indexOf('project name') !== -1) return 'projectName';
  if (h.indexOf('donor') !== -1) return 'donor';
  if (h.indexOf('start') !== -1) return 'startDate';
  if (h.indexOf('end') !== -1) return 'endDate';
  if (h.indexOf('indicator') !== -1) return 'indicator';
  if (h.indexOf('achieved') !== -1) return 'achievedTarget';
  if (h.indexOf('target') !== -1) return 'target';
  if (h.indexOf('type of bnf') !== -1 || h.indexOf('bnf') !== -1) return 'bnfType';
  if (h.indexOf('women') !== -1 || h.indexOf('woman') !== -1) return 'noOfWomen';
  if (h.indexOf('men') !== -1 || h.indexOf('man') !== -1) return 'noOfMen';
  if (h.indexOf('total') !== -1) return 'total';
  
  return h.replace(/\s+(.)/g, function(match, group1) {
    return group1.toUpperCase();
  });
}

function isNumericColumn(key) {
  var numericKeys = ['target', 'achievedTarget', 'noOfMen', 'noOfWomen', 'total'];
  return numericKeys.indexOf(key) !== -1;
}

function formatDate(date) {
  var d = new Date(date);
  if (isNaN(d.getTime())) return "";
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return yyyy + "-" + mm + "-" + dd;
}

function getMockDataResponse(message) {
  var mockData = [
    {
      projectCode: "KU38",
      projectName: "Emergency Food Assistance for Host Communities",
      donor: "WFP",
      startDate: "2024-01-10",
      endDate: "2024-10-31",
      indicator: "Number of individuals provided with standard food rations",
      target: 15000,
      achievedTarget: 14200,
      bnfType: "Vulnerable Families",
      noOfMen: 6800,
      noOfWomen: 7400,
      total: 14200
    },
    {
      projectCode: "KU39",
      projectName: "Refugees Integrated Health Services",
      donor: "UNHCR",
      startDate: "2024-02-01",
      endDate: "2024-12-31",
      indicator: "Number of patient visits facilitated in primary clinics",
      target: 25000,
      achievedTarget: 26100,
      bnfType: "Refugees & Local Communities",
      noOfMen: 12100,
      noOfWomen: 14000,
      total: 26100
    },
    {
      projectCode: "KU40",
      projectName: "Borehole Rehabilitation & Hygiene Promotion",
      donor: "UNICEF",
      startDate: "2024-03-15",
      endDate: "2024-11-30",
      indicator: "Number of individuals provided access to safe clean water supply",
      target: 8000,
      achievedTarget: 7900,
      bnfType: "IDPs, Host Communities",
      noOfMen: 3800,
      noOfWomen: 4100,
      total: 7900
    },
    {
      projectCode: "KU41",
      projectName: "Child Protection & PSS Services",
      donor: "Save the Children",
      startDate: "2024-05-01",
      endDate: "2025-04-30",
      indicator: "Number of children participating in structured PSS activities",
      target: 3500,
      achievedTarget: 3200,
      bnfType: "Displaced Children",
      noOfMen: 1550,
      noOfWomen: 1650,
      total: 3200
    },
    {
      projectCode: "KU42",
      projectName: "Vocational Training & Micro-Business Grants",
      donor: "UNDP",
      startDate: "2024-06-01",
      endDate: "2025-05-31",
      indicator: "Number of individuals receiving vocational training and start-up kits",
      target: 1200,
      achievedTarget: 1150,
      bnfType: "Unemployed Youth",
      noOfMen: 550,
      noOfWomen: 600,
      total: 1150
    },
    {
      projectCode: "KU43",
      projectName: "Emergency Shelter & NFI Distribution",
      donor: "IOM",
      startDate: "2024-08-01",
      endDate: "2025-02-28",
      indicator: "Number of households receiving emergency shelter materials",
      target: 4500,
      achievedTarget: 4300,
      bnfType: "Flood Affected Families",
      noOfMen: 2100,
      noOfWomen: 2200,
      total: 4300
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of households receiving emergency cash transfers",
      target: 5000,
      achievedTarget: 4800,
      bnfType: "Conflict Affected Families",
      noOfMen: 2300,
      noOfWomen: 2500,
      total: 4800
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of individuals trained in safe sanitation practices",
      target: 12000,
      achievedTarget: 11400,
      bnfType: "Community Members",
      noOfMen: 5500,
      noOfWomen: 5900,
      total: 11400
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of boreholes rehabilitated and operational",
      target: 15,
      achievedTarget: 12,
      bnfType: "Water Facilities",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of women attending psychosocial support sessions",
      target: 2500,
      achievedTarget: 2350,
      bnfType: "Vulnerable Women & Girls",
      noOfMen: 0,
      noOfWomen: 2350,
      total: 2350
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of children enrolled in temporary learning spaces",
      target: 6000,
      achievedTarget: 5800,
      bnfType: "Displaced Children",
      noOfMen: 2800,
      noOfWomen: 3000,
      total: 5800
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of hygiene kits distributed to vulnerable families",
      target: 8000,
      achievedTarget: 7900,
      bnfType: "Host & Displaced Families",
      noOfMen: 3800,
      noOfWomen: 4100,
      total: 7900
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of clinical consultations conducted at mobile health posts",
      target: 18000,
      achievedTarget: 19500,
      bnfType: "Patients",
      noOfMen: 9000,
      noOfWomen: 10500,
      total: 19500
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Percentage of target population reporting access to clean water",
      target: 90,
      achievedTarget: 85,
      bnfType: "Beneficiary Families",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of community outreach sessions on gender-based violence",
      target: 50,
      achievedTarget: 48,
      bnfType: "Outreach Events",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of farmers receiving seeds and tools for winter planting",
      target: 3000,
      achievedTarget: 2900,
      bnfType: "Smallholder Farmers",
      noOfMen: 1400,
      noOfWomen: 1500,
      total: 2900
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Percentage of infants screened for acute malnutrition",
      target: 100,
      achievedTarget: 98,
      bnfType: "Infants Under 2",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU44",
      projectName: "Multi-Sectoral Humanitarian Assistance Program",
      donor: "BHA",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      indicator: "Number of safe spaces for child protection established",
      target: 8,
      achievedTarget: 6,
      bnfType: "Safe Spaces",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU45",
      projectName: "Primary Education Support",
      donor: "ECHO",
      startDate: "2025-02-15",
      endDate: "2025-11-30",
      indicator: "Number of primary schools supplied with learning materials",
      target: 45,
      achievedTarget: 42,
      bnfType: "Schools Supported",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU46",
      projectName: "Maternal and Neonatal Health Care",
      donor: "WHO",
      startDate: "2025-03-01",
      endDate: "2026-02-28",
      indicator: "Number of births attended by skilled health personnel",
      target: 1500,
      achievedTarget: 1350,
      bnfType: "Pregnant Women",
      noOfMen: 0,
      noOfWomen: 1350,
      total: 1350
    },
    {
      projectCode: "KU47",
      projectName: "Agricultural Inputs & Irrigation Rehab",
      donor: "FAO",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
      indicator: "Number of irrigation canals cleaned and rehabilitated",
      target: 12,
      achievedTarget: 10,
      bnfType: "Canals rehabilitated",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU48",
      projectName: "Gender-Based Violence Prevention",
      donor: "UN Women",
      startDate: "2025-06-01",
      endDate: "2026-05-31",
      indicator: "Number of support staff trained in GBV case management",
      target: 150,
      achievedTarget: 142,
      bnfType: "Humanitarian Workers",
      noOfMen: 52,
      noOfWomen: 90,
      total: 142
    },
    {
      projectCode: "KU49",
      projectName: "Solid Waste Management and Cash-for-Work",
      donor: "GIZ",
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      indicator: "Number of individuals employed in cash-for-work schemes",
      target: 2500,
      achievedTarget: 2100,
      bnfType: "Host & Displaced Workers",
      noOfMen: 1050,
      noOfWomen: 1050,
      total: 2100
    },
    {
      projectCode: "KU50",
      projectName: "Solar Power for Rural Health Clinics",
      donor: "USAID",
      startDate: "2025-09-01",
      endDate: "2026-08-31",
      indicator: "Number of rural clinics equipped with off-grid solar power systems",
      target: 20,
      achievedTarget: 18,
      bnfType: "Clinics",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    },
    {
      projectCode: "KU51",
      projectName: "Emergency Cholera Response & Surveillance",
      donor: "UNICEF",
      startDate: "2025-10-01",
      endDate: "2026-04-30",
      indicator: "Number of oral rehydration points (ORPs) established",
      target: 30,
      achievedTarget: 28,
      bnfType: "Health Facilities",
      noOfMen: 0,
      noOfWomen: 0,
      total: 0
    }
  ];

  mockData.forEach(function(record) {
    var men = record['noOfMen'] || 0;
    var women = record['noOfWomen'] || 0;
    record['sector'] = classifySector(record['projectName'], record['indicator']);
    record['metricType'] = classifyMetricType(record['indicator'], record['bnfType'], men, women);
    var target = record['target'] || 0;
    var achieved = record['achievedTarget'] || 0;
    record['progressRate'] = target > 0 ? Math.round((achieved / target) * 100) : 0;
  });

  var payload = {
    status: "success",
    source: "Mock Indicator Database",
    data: mockData,
    isDemo: true,
    message: message
  };
  return JSON.stringify(payload);
}

/**
 * Automatically initializes your Google Sheet with three sheets:
 * 1. "Parm": Projects list with metadata.
 * 2. "indicators": Indicator details list.
 * 3. "NGO Indicator Database": Flat combined database synced in real-time.
 */
function initializeSpreadsheet() {
  try {
    var activeSheet = null;
    if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
      activeSheet = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } else {
      activeSheet = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!activeSheet) {
      throw new Error("Could not find any active Spreadsheet. Please bound this script to a Google Sheet!");
    }
    
    // 1. Initialize Parm Sheet (Projects list)
    var parmSheet = activeSheet.getSheetByName("Parm");
    if (!parmSheet) {
      parmSheet = activeSheet.insertSheet("Parm");
    }
    parmSheet.clear();
    parmSheet.clearFormats();
    parmSheet.setFrozenRows(1);
    
    var parmHeaders = ["Project Code", "Project Name", "Donor", "Start of Project (YYYY-MM-DD)", "End of Project (YYYY-MM-DD)"];
    parmSheet.getRange(1, 1, 1, parmHeaders.length).setValues([parmHeaders])
      .setFontWeight("bold")
      .setBackground("#F49600")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");
      
    // Initial Projects Mock Data
    var mockProjects = [
      ["KU38", "Emergency Food Assistance for Host Communities", "WFP", "2024-01-10", "2024-10-31"],
      ["KU39", "Refugees Integrated Health Services", "UNHCR", "2024-02-01", "2024-12-31"],
      ["KU40", "Borehole Rehabilitation & Hygiene Promotion", "UNICEF", "2024-03-15", "2024-11-30"],
      ["KU41", "Child Protection & PSS Services", "Save the Children", "2024-05-01", "2025-04-30"],
      ["KU42", "Vocational Training & Micro-Business Grants", "UNDP", "2024-06-01", "2025-05-31"],
      ["KU43", "Emergency Shelter & NFI Distribution", "IOM", "2024-08-01", "2025-02-28"],
      ["KU44", "Multi-Sectoral Humanitarian Assistance Program", "BHA", "2025-01-01", "2025-12-31"],
      ["KU45", "Primary Education Support", "ECHO", "2025-02-15", "2025-11-30"],
      ["KU46", "Maternal and Neonatal Health Care", "WHO", "2025-03-01", "2026-02-28"],
      ["KU47", "Agricultural Inputs & Irrigation Rehab", "FAO", "2025-04-01", "2026-03-31"],
      ["KU48", "Gender-Based Violence Prevention", "UN Women", "2025-06-01", "2026-05-31"],
      ["KU49", "Solid Waste Management and Cash-for-Work", "GIZ", "2025-07-01", "2026-06-30"],
      ["KU50", "Solar Power for Rural Health Clinics", "USAID", "2025-09-01", "2026-08-31"],
      ["KU51", "Emergency Cholera Response & Surveillance", "UNICEF", "2025-10-01", "2026-04-30"]
    ];
    
    parmSheet.getRange(2, 1, mockProjects.length, parmHeaders.length).setValues(mockProjects);
    parmSheet.getRange(2, 1, mockProjects.length, 3).setHorizontalAlignment("left");
    parmSheet.getRange(2, 4, mockProjects.length, 2).setHorizontalAlignment("center");
    
    for (var col = 1; col <= parmHeaders.length; col++) {
      try { parmSheet.autoResizeColumn(col); } catch (e) {}
    }
    
    // 2. Initialize indicators Sheet (Indicators list)
    var indSheet = activeSheet.getSheetByName("indicators");
    if (!indSheet) {
      indSheet = activeSheet.insertSheet("indicators");
    }
    indSheet.clear();
    indSheet.clearFormats();
    indSheet.setFrozenRows(1);
    
    var indHeaders = [
      "Project Code", "Indicator Description", "Target Value", "Achieved Target",
      "Type of Beneficiaries (BNFs)", "Number of Men", "Number of Women", "Total Beneficiaries (Calculated)"
    ];
    indSheet.getRange(1, 1, 1, indHeaders.length).setValues([indHeaders])
      .setFontWeight("bold")
      .setBackground("#F49600")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");
      
    // Initial Indicators Mock Data
    var mockIndicators = [
      ["KU38", "Number of individuals provided with standard food rations", 15000, 14200, "Vulnerable Families", 6800, 7400, ""],
      ["KU39", "Number of patient visits facilitated in primary clinics", 25000, 26100, "Refugees & Local Communities", 12100, 14000, ""],
      ["KU40", "Number of individuals provided access to safe clean water supply", 8000, 7900, "IDPs, Host Communities", 3800, 4100, ""],
      ["KU41", "Number of children participating in structured PSS activities", 3500, 3200, "Displaced Children", 1550, 1650, ""],
      ["KU42", "Number of individuals receiving vocational training and start-up kits", 1200, 1150, "Unemployed Youth", 555, 595, ""],
      ["KU43", "Number of households receiving emergency shelter materials", 4500, 4300, "Flood Affected Families", 2100, 2200, ""],
      
      // KU44 - 12 indicators
      ["KU44", "Number of households receiving emergency cash transfers", 5000, 4800, "Conflict Affected Families", 2300, 2500, ""],
      ["KU44", "Number of individuals trained in safe sanitation practices", 12000, 11400, "Community Members", 5500, 5900, ""],
      ["KU44", "Number of boreholes rehabilitated and operational", 15, 12, "Water Facilities", 0, 0, ""],
      ["KU44", "Number of women attending psychosocial support sessions", 2500, 2350, "Vulnerable Women & Girls", 0, 2350, ""],
      ["KU44", "Number of children enrolled in temporary learning spaces", 6000, 5800, "Displaced Children", 2800, 3000, ""],
      ["KU44", "Number of hygiene kits distributed to vulnerable families", 8000, 7900, "Host & Displaced Families", 3800, 4100, ""],
      ["KU44", "Number of clinical consultations conducted at mobile health posts", 18000, 19500, "Patients", 9000, 10500, ""],
      ["KU44", "Percentage of target population reporting access to clean water", 90, 85, "Beneficiary Families", 0, 0, ""],
      ["KU44", "Number of community outreach sessions on gender-based violence", 50, 48, "Outreach Events", 0, 0, ""],
      ["KU44", "Number of farmers receiving seeds and tools for winter planting", 3000, 2900, "Smallholder Farmers", 1400, 1500, ""],
      ["KU44", "Percentage of infants screened for acute malnutrition", 100, 98, "Infants Under 2", 0, 0, ""],
      ["KU44", "Number of safe spaces for child protection established", 8, 6, "Safe Spaces", 0, 0, ""],
      
      ["KU45", "Number of primary schools supplied with learning materials", 45, 42, "Schools Supported", 0, 0, ""],
      ["KU46", "Number of births attended by skilled health personnel", 1500, 1350, "Pregnant Women", 0, 1350, ""],
      ["KU47", "Number of irrigation canals cleaned and rehabilitated", 12, 10, "Canals rehabilitated", 0, 0, ""],
      ["KU48", "Number of support staff trained in GBV case management", 150, 142, "Humanitarian Workers", 52, 90, ""],
      ["KU49", "Number of individuals employed in cash-for-work schemes", 2500, 2100, "Host & Displaced Workers", 1050, 1050, ""],
      ["KU50", "Number of rural clinics equipped with off-grid solar power systems", 20, 18, "Clinics", 0, 0, ""],
      ["KU51", "Number of oral rehydration points (ORPs) established", 30, 28, "Health Facilities", 0, 0, ""]
    ];
    
    for (var r = 0; r < mockIndicators.length; r++) {
      var rowNum = r + 2;
      mockIndicators[r][7] = "=IF(OR(E" + rowNum + "=\"Water Facilities\", E" + rowNum + "=\"Safe Spaces\", E" + rowNum + "=\"Schools Supported\", E" + rowNum + "=\"Canals rehabilitated\", E" + rowNum + "=\"Clinics\", E" + rowNum + "=\"Outreach Events\"), \"\", IF(F" + rowNum + "+G" + rowNum + ">0, F" + rowNum + "+G" + rowNum + ", D" + rowNum + "))";
    }
    
    indSheet.getRange(2, 1, mockIndicators.length, indHeaders.length).setValues(mockIndicators);
    indSheet.getRange(2, 1, mockIndicators.length, 2).setHorizontalAlignment("left");
    indSheet.getRange(2, 3, mockIndicators.length, 2).setHorizontalAlignment("right").setNumberFormat("#,##0");
    indSheet.getRange(2, 5, mockIndicators.length, 1).setHorizontalAlignment("left");
    indSheet.getRange(2, 6, mockIndicators.length, 3).setHorizontalAlignment("right").setNumberFormat("#,##0");
    
    for (var col = 1; col <= indHeaders.length; col++) {
      try { indSheet.autoResizeColumn(col); } catch (e) {}
    }
    
    // 3. Initialize database sheet
    var dbTabName = SHEET_TAB_NAME || "NGO Indicator Database";
    var dbSheet = activeSheet.getSheetByName(dbTabName);
    if (!dbSheet) {
      dbSheet = activeSheet.insertSheet(dbTabName);
    }
    dbSheet.clear();
    dbSheet.clearFormats();
    dbSheet.setFrozenRows(1);
    
    var dbHeaders = [
      "Project Code", "Project Name", "Donor", "Start of the Project", "End of the Project", 
      "Indicator", "Target", "Achieved Target", 
      "Type of BNFs", "No.of Men", "No. of Women", "Total"
    ];
    
    dbSheet.getRange(1, 1, 1, dbHeaders.length).setValues([dbHeaders])
      .setFontWeight("bold")
      .setBackground("#F49600")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");
      
    // 4. Perform initial sync and setup validations
    syncDatabase();
    updateIndicatorProjectValidation();
    
    // Move indicators to position 1, Parm to position 2, Database to position 3
    try {
      activeSheet.setActiveSheet(indSheet);
      activeSheet.moveActiveSheet(1);
      activeSheet.setActiveSheet(parmSheet);
      activeSheet.moveActiveSheet(2);
    } catch (e) {}
    
    SpreadsheetApp.getUi().alert("Setup completed successfully! 'Parm', 'indicators', and 'NGO Indicator Database' tabs have been initialized and are linked.");
  } catch (error) {
    Logger.log("Error initializing spreadsheet: " + error.toString());
    try {
      SpreadsheetApp.getUi().alert("Error initializing spreadsheet: " + error.toString());
    } catch (e) {}
  }
}

/**
 * Diagnostic test function. Select this in Apps Script dropdown to test local connection.
 */
function testConnection() {
  try {
    var resultString = getProjectData();
    Logger.log("--- TEST SUCCESS ---");
    Logger.log(resultString);
    return resultString;
  } catch (e) {
    Logger.log("--- TEST CRITICAL FAIL ---");
    Logger.log(e.toString());
    return e.toString();
  }
}

/**
 * Automatically classifies a row into a standard humanitarian sector.
 */
function classifySector(projectName, indicator) {
  var txt = (String(projectName || "") + " " + String(indicator || "")).toLowerCase();
  
  // 1. FSL / Livelihoods
  if (txt.indexOf("fsl") !== -1 || txt.indexOf("livelihood") !== -1 || txt.indexOf("farmer") !== -1 || 
      txt.indexOf("agriculture") !== -1 || txt.indexOf("productivity") !== -1 || txt.indexOf("feed") !== -1 || 
      txt.indexOf("input") !== -1 || txt.indexOf("livestock") !== -1 || txt.indexOf("crop") !== -1 || 
      txt.indexOf("pastoralist") !== -1 || txt.indexOf("cash transfer") !== -1 || txt.indexOf("parcel") !== -1 || 
      txt.indexOf("basket") !== -1 || txt.indexOf("micro business") !== -1 || txt.indexOf("income") !== -1 || 
      txt.indexOf("employment") !== -1 || txt.indexOf("job") !== -1 || txt.indexOf("business") !== -1 || 
      txt.indexOf("perma") !== -1 || txt.indexOf("economic") !== -1 || txt.indexOf("trade") !== -1) {
    return "FSL";
  }
  
  // 2. WASH
  if (txt.indexOf("wash") !== -1 || txt.indexOf("water") !== -1 || txt.indexOf("hygiene") !== -1 || 
      txt.indexOf("sanitation") !== -1 || txt.indexOf("toilet") !== -1 || txt.indexOf("well") !== -1 || 
      txt.indexOf("network rehabilitation") !== -1 || txt.indexOf("network rehab") !== -1 || 
      txt.indexOf("latrine") !== -1 || txt.indexOf("canal") !== -1 || txt.indexOf("sewerage") !== -1 || 
      txt.indexOf("network") !== -1 || txt.indexOf("aquifer") !== -1 || txt.indexOf("irrigation") !== -1) {
    return "WASH";
  }
  
  // 3. Protection
  if (txt.indexOf("protection") !== -1 || txt.indexOf("gbv") !== -1 || txt.indexOf("gender-based") !== -1 || 
      txt.indexOf("psychosocial") !== -1 || txt.indexOf("pss") !== -1 || txt.indexOf("safety") !== -1 || 
      txt.indexOf("gender") !== -1 || txt.indexOf("case management") !== -1 || txt.indexOf("rights") !== -1 || 
      txt.indexOf("advocacy") !== -1) {
    return "Protection";
  }
  
  // 4. Education
  if (txt.indexOf("education") !== -1 || txt.indexOf("school") !== -1 || txt.indexOf("learning") !== -1 || 
      txt.indexOf("teacher") !== -1 || txt.indexOf("student") !== -1 || txt.indexOf("classroom") !== -1 || 
      txt.indexOf("child friendly space") !== -1 || txt.indexOf("temporary learning space") !== -1 ||
      txt.indexOf("learning space") !== -1) {
    return "Education";
  }
  
  // 5. Health
  if (txt.indexOf("health") !== -1 || txt.indexOf("clinic") !== -1 || txt.indexOf("medical") !== -1 || 
      txt.indexOf("patient") !== -1 || txt.indexOf("disease") !== -1 || txt.indexOf("treatment") !== -1 || 
      txt.indexOf("doctor") !== -1 || txt.indexOf("nurse") !== -1 || txt.indexOf("nutrition") !== -1 || 
      txt.indexOf("sam") !== -1 || txt.indexOf("malnutrition") !== -1 || txt.indexOf("hospital") !== -1 || 
      txt.indexOf("phcc") !== -1 || txt.indexOf("maternal") !== -1 || txt.indexOf("vaccine") !== -1 || 
      txt.indexOf("immunization") !== -1) {
    return "Health";
  }
  
  return "Other";
}

/**
 * Automatically classifies an indicator into People (Beneficiaries), Infrastructure, or Percent.
 */
function classifyMetricType(indicator, bnfType, men, women) {
  var indText = String(indicator || "").toLowerCase();
  var bnfText = String(bnfType || "").toLowerCase();
  var txt = indText + " " + bnfText;
  
  // 1. Check for Percent metrics first
  if (txt.indexOf("percent") !== -1 || txt.indexOf("percentage") !== -1 || txt.indexOf("%") !== -1 || 
      txt.indexOf("pct") !== -1 || txt.indexOf("ratio") !== -1 || txt.indexOf("rate") !== -1) {
    return "Percent";
  }
  
  // Keywords indicating physical assets
  var keywords = [
    "rehabilitate", "rehab", "rehabilitation", "canal", "network", 
    "construction", "constructed", "reconstructed", "facility", "facilities", 
    "establishment", "established", "built", "contract", "contracts", 
    "system", "systems", 
    "infrastructure", "renovated", "renovation", "installed", "install", 
    "procured", "procurement", "partners", "actors"
  ];
  
  for (var i = 0; i < keywords.length; i++) {
    if (txt.indexOf(keywords[i]) !== -1) {
      return "Infrastructure";
    }
  }
  
  // If demographics are zero, verify if it represents non-people
  var totalDemographics = (men || 0) + (women || 0);
  if (totalDemographics === 0 && (indText.indexOf("number of") !== -1 || indText.indexOf("# of") !== -1)) {
    var humanKeywords = ["people", "individuals", "persons", "men", "women", "children", "households", "families", "farmers", "patients", "refugees", "idps", "returnees"];
    var hasHumanKeyword = false;
    for (var j = 0; j < humanKeywords.length; j++) {
      if (txt.indexOf(humanKeywords[j]) !== -1) {
        hasHumanKeyword = true;
        break;
      }
    }
    if (!hasHumanKeyword) {
      return "Infrastructure";
    }
  }
  
  return "People";
}
