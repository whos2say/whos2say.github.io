/**
 * RT Davies Estimate System — Apps Script Web App (container-bound to spreadsheet).
 *
 * Setup:
 * 1. Extensions → Apps Script on the "RT Davies Estimate System" spreadsheet.
 * 2. Paste this file, save.
 * 3. Project Settings → Script properties → add RTD_API_SECRET (long random string).
 * 4. Deploy → New deployment → Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the /exec URL into Next.js RTD_APPS_SCRIPT_URL (use /exec not /dev).
 */

var SHEET = {
  CUSTOMERS: 'Customers',
  ESTIMATES: 'Estimates',
  LINE_ITEMS: 'Estimate_Line_Items',
  JOBS: 'Jobs',
  SETTINGS: 'Settings',
};

var REQUIRED_TABS = [
  SHEET.CUSTOMERS,
  SHEET.ESTIMATES,
  SHEET.LINE_ITEMS,
  SHEET.JOBS,
  SHEET.SETTINGS,
];

function doPost(e) {
  return handleRequest_(e);
}

function doGet(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    var body = parseBody_(e);
    validateSecret_(body.secret);
    var action = String(body.action || '').trim();
    var payload = body.payload || {};
    var data = routeAction_(action, payload);
    return jsonResponse_({ ok: true, data: data });
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Request failed';
    if (message.indexOf('Unauthorized') === 0) {
      return jsonResponse_({ ok: false, error: 'Unauthorized' }, 401);
    }
    if (message.indexOf('Not found') === 0) {
      return jsonResponse_({ ok: false, error: message }, 404);
    }
    return jsonResponse_({ ok: false, error: message }, 400);
  }
}

function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  if (e.parameter && e.parameter.action) {
    return {
      secret: e.parameter.secret,
      action: e.parameter.action,
      payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {},
    };
  }
  return {};
}

/** Secret is sent top-level as body.secret (matches Next.js rtdApiClient). */
function validateSecret_(provided) {
  var expected = PropertiesService.getScriptProperties().getProperty('RTD_API_SECRET');
  if (!expected || provided == null || provided === '') {
    throw new Error('Unauthorized');
  }
  if (String(provided).trim() !== String(expected).trim()) {
    throw new Error('Unauthorized');
  }
}

function routeAction_(action, payload) {
  switch (action) {
    case 'health':
      return actionHealth_();
    case 'dashboard':
      return actionDashboard_();
    case 'listCustomers':
      return getRows_(SHEET.CUSTOMERS);
    case 'getCustomer':
      return { customer: findRowById_(SHEET.CUSTOMERS, 'customer_id', payload.customer_id) };
    case 'createCustomer':
      return appendCustomer_(payload.customer);
    case 'updateCustomer':
      return updateCustomer_(payload.customer_id, payload.data);
    case 'listEstimates':
      return listEstimates_();
    case 'getEstimate':
      return getEstimate_(payload.estimate_id);
    case 'createEstimate':
      return createEstimate_(payload.estimate, payload.lineItems);
    case 'updateEstimate':
      return updateEstimate_(payload.estimate, payload.lineItems);
    case 'updateEstimateStatus':
      return updateEstimateStatus_(payload.estimate_id, payload.status, payload.extra);
    case 'generateEstimateNumber':
      return { estimate_number: generateEstimateNumber_() };
    case 'listJobs':
      return getRows_(SHEET.JOBS);
    case 'getJob':
      return { job: findRowById_(SHEET.JOBS, 'job_id', payload.job_id) };
    case 'createJob':
      return appendJob_(payload.job);
    case 'updateJob':
      return updateJob_(payload.job_id, payload.data);
    case 'getSettings':
      return getSettingsMap_();
    case 'updateSettings':
      return updateSettings_(payload.settings);
    default:
      throw new Error('Unknown action: ' + action);
  }
}

// ——— Health ———

function actionDashboard_() {
  var estimates = safeGetRows_(SHEET.ESTIMATES);
  var jobs = safeGetRows_(SHEET.JOBS);

  estimates.sort(function (a, b) {
    var tb = new Date(b.created_at || 0).getTime();
    var ta = new Date(a.created_at || 0).getTime();
    return tb - ta;
  });

  var draftEstimates = estimates.filter(function (e) {
    return e.status === 'draft';
  });
  var sentEstimates = estimates.filter(function (e) {
    return e.status === 'sent';
  });
  var approvedEstimates = estimates.filter(function (e) {
    return e.status === 'approved';
  });
  var completedUnpaidJobs = estimates.filter(function (e) {
    return e.status === 'completed' && !e.paid_at;
  });

  var scheduledJobs = jobs.filter(function (j) {
    return j.job_status === 'scheduled' || j.job_status === 'in_progress';
  }).length;

  var activeStatuses = { sent: true, approved: true, scheduled: true };
  var totalEstimatedRevenue = estimates.reduce(function (sum, e) {
    if (!activeStatuses[e.status]) return sum;
    return sum + (parseFloat(e.total) || 0);
  }, 0);

  var recentEstimates = estimates.slice(0, 10);

  return {
    draftEstimates: draftEstimates,
    sentEstimates: sentEstimates,
    approvedEstimates: approvedEstimates,
    scheduledJobs: scheduledJobs,
    completedUnpaidJobs: completedUnpaidJobs,
    totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
    recentEstimates: recentEstimates,
  };
}

function safeGetRows_(sheetName) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];
    return getRows_(sheetName);
  } catch (err) {
    return [];
  }
}

function actionHealth_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ss.getSheets().map(function (s) {
    return s.getName();
  });
  return {
    tabs: names,
    spreadsheet_title: ss.getName(),
    missing_tabs: REQUIRED_TABS.filter(function (t) {
      return names.indexOf(t) === -1;
    }),
  };
}

// ——— Sheet helpers ———

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet not found: ' + name);
  }
  return sheet;
}

function getRows_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  var headers = values[0].map(function (h) {
    return String(h).trim();
  });
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row || row.every(function (c) {
      return c === '' || c === null;
    })) {
      continue;
    }
    var obj = {};
    headers.forEach(function (header, col) {
      obj[header] = String(row[col] != null ? row[col] : '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function getHeaders_(sheetName) {
  var sheet = getSheet_(sheetName);
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
}

function findRowIndexById_(sheetName, idColumn, idValue) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return null;

  var headers = values[0].map(function (h) {
    return String(h).trim();
  });
  var idCol = headers.indexOf(idColumn);
  if (idCol === -1) {
    throw new Error('Column not found: ' + idColumn);
  }

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol] || '').trim() === String(idValue).trim()) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

function findRowById_(sheetName, idColumn, idValue) {
  var rows = getRows_(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idColumn] === String(idValue).trim()) {
      return rows[i];
    }
  }
  return null;
}

function appendRowObject_(sheetName, obj) {
  var headers = getHeaders_(sheetName);
  var row = headers.map(function (h) {
    return obj[h] != null ? String(obj[h]) : '';
  });
  getSheet_(sheetName).appendRow(row);
}

function updateRowObject_(sheetName, idColumn, idValue, patch) {
  var found = findRowIndexById_(sheetName, idColumn, idValue);
  if (!found) {
    throw new Error('Not found: ' + idValue);
  }
  var sheet = getSheet_(sheetName);
  var current = sheet
    .getRange(found.rowIndex, 1, found.rowIndex, found.headers.length)
    .getValues()[0];
  var updated = found.headers.map(function (header, col) {
    if (patch.hasOwnProperty(header)) {
      return String(patch[header] != null ? patch[header] : '');
    }
    return String(current[col] != null ? current[col] : '');
  });
  sheet
    .getRange(found.rowIndex, 1, found.rowIndex, found.headers.length)
    .setValues([updated]);
}

function clearRowById_(sheetName, idColumn, idValue) {
  var found = findRowIndexById_(sheetName, idColumn, idValue);
  if (!found) return;
  var sheet = getSheet_(sheetName);
  var empty = found.headers.map(function () {
    return '';
  });
  sheet
    .getRange(found.rowIndex, 1, found.rowIndex, found.headers.length)
    .setValues([empty]);
}

// ——— Customers ———

function appendCustomer_(customer) {
  if (!customer || !customer.customer_id) {
    throw new Error('Invalid customer payload');
  }
  appendRowObject_(SHEET.CUSTOMERS, customer);
  return customer;
}

function updateCustomer_(customerId, data) {
  var existing = findRowById_(SHEET.CUSTOMERS, 'customer_id', customerId);
  if (!existing) throw new Error('Not found: customer');
  var patch = {};
  for (var key in data) {
    if (data.hasOwnProperty(key)) patch[key] = data[key];
  }
  patch.updated_at = new Date().toISOString();
  updateRowObject_(SHEET.CUSTOMERS, 'customer_id', customerId, patch);
  return findRowById_(SHEET.CUSTOMERS, 'customer_id', customerId);
}

// ——— Estimates ———

function listEstimates_() {
  var rows = getRows_(SHEET.ESTIMATES);
  rows.sort(function (a, b) {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return rows;
}

function getEstimate_(estimateId) {
  var estimate = findRowById_(SHEET.ESTIMATES, 'estimate_id', estimateId);
  var lineItems = getRows_(SHEET.LINE_ITEMS)
    .filter(function (li) {
      return li.estimate_id === String(estimateId).trim();
    })
    .sort(function (a, b) {
      return parseInt(a.sort_order, 10) - parseInt(b.sort_order, 10);
    });
  return { estimate: estimate, lineItems: lineItems };
}

function createEstimate_(estimate, lineItems) {
  if (!estimate || !estimate.estimate_id) {
    throw new Error('Invalid estimate payload');
  }
  appendRowObject_(SHEET.ESTIMATES, estimate);
  replaceLineItems_(estimate.estimate_id, lineItems || []);
  return getEstimate_(estimate.estimate_id);
}

function updateEstimate_(estimate, lineItems) {
  if (!estimate || !estimate.estimate_id) {
    throw new Error('Invalid estimate payload');
  }
  var id = estimate.estimate_id;
  var existing = findRowById_(SHEET.ESTIMATES, 'estimate_id', id);
  if (!existing) throw new Error('Not found: estimate');
  updateRowObject_(SHEET.ESTIMATES, 'estimate_id', id, estimate);
  replaceLineItems_(id, lineItems || []);
  return getEstimate_(id);
}

function updateEstimateStatus_(estimateId, status, extra) {
  var existing = findRowById_(SHEET.ESTIMATES, 'estimate_id', estimateId);
  if (!existing) throw new Error('Not found: estimate');
  var now = new Date().toISOString();
  var patch = { status: status, updated_at: now };
  if (extra) {
    for (var k in extra) {
      if (extra.hasOwnProperty(k)) patch[k] = extra[k];
    }
  }
  if (status === 'sent') patch.sent_at = now;
  if (status === 'approved') patch.approved_at = now;
  if (status === 'scheduled') patch.scheduled_at = now;
  if (status === 'completed') patch.completed_at = now;
  if (status === 'paid') patch.paid_at = now;
  updateRowObject_(SHEET.ESTIMATES, 'estimate_id', estimateId, patch);
  return findRowById_(SHEET.ESTIMATES, 'estimate_id', estimateId);
}

function replaceLineItems_(estimateId, items) {
  var all = getRows_(SHEET.LINE_ITEMS);
  all.forEach(function (item) {
    if (item.estimate_id === String(estimateId).trim() && item.line_item_id) {
      clearRowById_(SHEET.LINE_ITEMS, 'line_item_id', item.line_item_id);
    }
  });
  (items || []).forEach(function (item) {
    appendRowObject_(SHEET.LINE_ITEMS, item);
  });
}

function generateEstimateNumber_() {
  var year = new Date().getFullYear();
  var prefix = 'RTD-' + year + '-';
  var estimates = getRows_(SHEET.ESTIMATES);
  var max = 0;
  estimates.forEach(function (e) {
    var n = e.estimate_number || '';
    if (n.indexOf(prefix) === 0) {
      var part = parseInt(n.slice(prefix.length), 10) || 0;
      if (part > max) max = part;
    }
  });
  return prefix + ('0000' + (max + 1)).slice(-4);
}

// ——— Jobs ———

function appendJob_(job) {
  if (!job || !job.job_id) throw new Error('Invalid job payload');
  appendRowObject_(SHEET.JOBS, job);
  return job;
}

function updateJob_(jobId, data) {
  var existing = findRowById_(SHEET.JOBS, 'job_id', jobId);
  if (!existing) throw new Error('Not found: job');
  var patch = {};
  for (var key in data) {
    if (data.hasOwnProperty(key)) patch[key] = data[key];
  }
  patch.updated_at = new Date().toISOString();
  updateRowObject_(SHEET.JOBS, 'job_id', jobId, patch);
  return findRowById_(SHEET.JOBS, 'job_id', jobId);
}

// ——— Settings ———

function getSettingsMap_() {
  var rows = getRows_(SHEET.SETTINGS);
  var map = {};
  rows.forEach(function (r) {
    if (r.setting_key) map[r.setting_key] = r.setting_value;
  });
  return map;
}

function updateSettings_(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings payload');
  }
  var existing = getRows_(SHEET.SETTINGS);
  for (var key in settings) {
    if (!settings.hasOwnProperty(key)) continue;
    var value = String(settings[key]);
    var row = null;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].setting_key === key) {
        row = existing[i];
        break;
      }
    }
    if (row) {
      updateRowObject_(SHEET.SETTINGS, 'setting_key', key, {
        setting_key: key,
        setting_value: value,
      });
    } else {
      appendRowObject_(SHEET.SETTINGS, {
        setting_key: key,
        setting_value: value,
      });
    }
  }
  return getSettingsMap_();
}

// ——— Response ———

function jsonResponse_(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
  return output;
}
