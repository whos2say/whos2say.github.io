/**
 * RT Davies Estimate System — Apps Script Web App
 * Container-bound to spreadsheet.
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
  return jsonResponse_({
    ok: true,
    message: 'RT Davies Estimate API is deployed. Use POST requests.',
  });
}

function handleRequest_(e) {
  try {
    var body = parseBody_(e);
    var action = String(body.action || '').trim();
    var payload = body.payload || {};

    // TEMP: Health is public so /api/sheets/health can verify deployment.
    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        data: actionHealth_(),
      });
    }

    // TEMP: Dashboard bypasses auth while we isolate the Next.js/Apps Script auth issue.
    if (action === 'dashboard' || action === 'listEstimates' || action === 'listJobs') {
      return jsonResponse_({
        ok: true,
        data: {
          forcedBypass: true,
          actionReceived: action,
          draftEstimates: [],
          sentEstimates: [],
          approvedEstimates: [],
          scheduledJobs: 0,
          completedUnpaidJobs: [],
          totalEstimatedRevenue: 0,
          recentEstimates: [],
        },
      });
    }

    validateSecret_(body.secret);

    var data = routeAction_(action, payload);

    return jsonResponse_({
      ok: true,
      data: data,
    });
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Request failed';

    return jsonResponse_({
      ok: false,
      error: message,
    });
  }
}

function parseBody_(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents || '{}');
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

function validateSecret_(provided) {
  var expected = PropertiesService
    .getScriptProperties()
    .getProperty('RTD_API_SECRET');

  if (!expected) {
    throw new Error('Unauthorized: missing RTD_API_SECRET script property');
  }

  if (provided == null || provided === '') {
    throw new Error('Unauthorized: missing provided secret');
  }

  if (String(provided).trim() !== String(expected).trim()) {
    throw new Error(
      'Unauthorized: secret mismatch. receivedLength=' +
      String(provided).trim().length +
      ', expectedLength=' +
      String(expected).trim().length
    );
  }
}

function routeAction_(action, payload) {
  switch (action) {
    case 'getSettings':
      return getSettingsMap_();

    case 'updateSettings':
      return updateSettings_(payload.settings);

    case 'listCustomers':
      return getRows_(SHEET.CUSTOMERS);

    case 'getCustomer':
      return {
        customer: findRowById_(SHEET.CUSTOMERS, 'customer_id', payload.customer_id),
      };

    case 'createCustomer':
      return appendCustomer_(payload.customer);

    case 'updateCustomer':
      return updateCustomer_(payload.customer_id, payload.data);

    case 'dashboard':
      return actionDashboard_();

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
      return {
        estimate_number: generateEstimateNumber_(),
      };

    case 'listJobs':
      return getRows_(SHEET.JOBS);

    case 'getJob':
      return {
        job: findRowById_(SHEET.JOBS, 'job_id', payload.job_id),
      };

    case 'createJob':
      return appendJob_(payload.job);

    case 'updateJob':
      return updateJob_(payload.job_id, payload.data);

    default:
      throw new Error('Unknown action: ' + action);
  }
}

/**
 * Health
 */
function actionHealth_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var names = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });

  return {
    tabs: names,
    spreadsheet_title: ss.getName(),
    missing_tabs: REQUIRED_TABS.filter(function (tab) {
      return names.indexOf(tab) === -1;
    }),
  };
}

/**
 * Dashboard
 */
function actionDashboard_() {
  var estimates = safeGetRows_(SHEET.ESTIMATES);
  var jobs = safeGetRows_(SHEET.JOBS);

  estimates.sort(function (a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  var draftEstimates = estimates.filter(function (e) {
    return String(e.status || '').toLowerCase() === 'draft';
  });

  var sentEstimates = estimates.filter(function (e) {
    return String(e.status || '').toLowerCase() === 'sent';
  });

  var approvedEstimates = estimates.filter(function (e) {
    return String(e.status || '').toLowerCase() === 'approved';
  });

  var completedUnpaidJobs = estimates.filter(function (e) {
    return String(e.status || '').toLowerCase() === 'completed' && !e.paid_at;
  });

  var scheduledJobs = jobs.filter(function (j) {
    var status = String(j.job_status || '').toLowerCase();
    return status === 'scheduled' || status === 'in_progress';
  }).length;

  var activeStatuses = {
    sent: true,
    approved: true,
    scheduled: true,
  };

  var totalEstimatedRevenue = estimates.reduce(function (sum, e) {
    var status = String(e.status || '').toLowerCase();
    if (!activeStatuses[status]) return sum;
    return sum + (parseFloat(e.total) || 0);
  }, 0);

  return {
    draftEstimates: draftEstimates,
    sentEstimates: sentEstimates,
    approvedEstimates: approvedEstimates,
    scheduledJobs: scheduledJobs,
    completedUnpaidJobs: completedUnpaidJobs,
    totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
    recentEstimates: estimates.slice(0, 10),
  };
}

/**
 * Sheet helpers
 */
function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

  if (!sheet) {
    throw new Error('Sheet not found: ' + name);
  }

  return sheet;
}

function safeGetRows_(sheetName) {
  try {
    return getRows_(sheetName);
  } catch (err) {
    return [];
  }
}

function getRows_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) return [];

  var headers = values[0].map(function (header) {
    return String(header).trim();
  });

  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    var isEmpty = row.every(function (cell) {
      return cell === '' || cell === null;
    });

    if (isEmpty) continue;

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
    .map(function (header) {
      return String(header).trim();
    });
}

function findRowIndexById_(sheetName, idColumn, idValue) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) return null;

  var headers = values[0].map(function (header) {
    return String(header).trim();
  });

  var idCol = headers.indexOf(idColumn);

  if (idCol === -1) {
    throw new Error('Column not found: ' + idColumn);
  }

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol] || '').trim() === String(idValue).trim()) {
      return {
        rowIndex: i + 1,
        headers: headers,
      };
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

  var row = headers.map(function (header) {
    return obj && obj[header] != null ? String(obj[header]) : '';
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
    .getRange(found.rowIndex, 1, 1, found.headers.length)
    .getValues()[0];

  var updated = found.headers.map(function (header, col) {
    if (patch && patch.hasOwnProperty(header)) {
      return String(patch[header] != null ? patch[header] : '');
    }

    return String(current[col] != null ? current[col] : '');
  });

  sheet
    .getRange(found.rowIndex, 1, 1, found.headers.length)
    .setValues([updated]);
}

function clearRowById_(sheetName, idColumn, idValue) {
  var found = findRowIndexById_(sheetName, idColumn, idValue);

  if (!found) return;

  var empty = found.headers.map(function () {
    return '';
  });

  getSheet_(sheetName)
    .getRange(found.rowIndex, 1, 1, found.headers.length)
    .setValues([empty]);
}

/**
 * Customers
 */
function appendCustomer_(customer) {
  if (!customer || !customer.customer_id) {
    throw new Error('Invalid customer payload');
  }

  appendRowObject_(SHEET.CUSTOMERS, customer);

  return customer;
}

function updateCustomer_(customerId, data) {
  var existing = findRowById_(SHEET.CUSTOMERS, 'customer_id', customerId);

  if (!existing) {
    throw new Error('Not found: customer');
  }

  var patch = {};

  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      patch[key] = data[key];
    }
  }

  patch.updated_at = new Date().toISOString();

  updateRowObject_(SHEET.CUSTOMERS, 'customer_id', customerId, patch);

  return findRowById_(SHEET.CUSTOMERS, 'customer_id', customerId);
}

/**
 * Estimates
 */
function listEstimates_() {
  var rows = getRows_(SHEET.ESTIMATES);

  rows.sort(function (a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return rows;
}

function getEstimate_(estimateId) {
  var estimate = findRowById_(SHEET.ESTIMATES, 'estimate_id', estimateId);

  var lineItems = getRows_(SHEET.LINE_ITEMS)
    .filter(function (item) {
      return item.estimate_id === String(estimateId).trim();
    })
    .sort(function (a, b) {
      return parseInt(a.sort_order || '0', 10) - parseInt(b.sort_order || '0', 10);
    });

  return {
    estimate: estimate,
    lineItems: lineItems,
  };
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

  if (!existing) {
    throw new Error('Not found: estimate');
  }

  updateRowObject_(SHEET.ESTIMATES, 'estimate_id', id, estimate);
  replaceLineItems_(id, lineItems || []);

  return getEstimate_(id);
}

function updateEstimateStatus_(estimateId, status, extra) {
  var existing = findRowById_(SHEET.ESTIMATES, 'estimate_id', estimateId);

  if (!existing) {
    throw new Error('Not found: estimate');
  }

  var now = new Date().toISOString();

  var patch = {
    status: status,
    updated_at: now,
  };

  if (extra) {
    for (var key in extra) {
      if (extra.hasOwnProperty(key)) {
        patch[key] = extra[key];
      }
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
  var all = safeGetRows_(SHEET.LINE_ITEMS);

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
  var estimates = safeGetRows_(SHEET.ESTIMATES);
  var max = 0;

  estimates.forEach(function (estimate) {
    var number = estimate.estimate_number || '';

    if (number.indexOf(prefix) === 0) {
      var part = parseInt(number.slice(prefix.length), 10) || 0;

      if (part > max) {
        max = part;
      }
    }
  });

  return prefix + ('0000' + (max + 1)).slice(-4);
}

/**
 * Jobs
 */
function appendJob_(job) {
  if (!job || !job.job_id) {
    throw new Error('Invalid job payload');
  }

  appendRowObject_(SHEET.JOBS, job);

  return job;
}

function updateJob_(jobId, data) {
  var existing = findRowById_(SHEET.JOBS, 'job_id', jobId);

  if (!existing) {
    throw new Error('Not found: job');
  }

  var patch = {};

  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      patch[key] = data[key];
    }
  }

  patch.updated_at = new Date().toISOString();

  updateRowObject_(SHEET.JOBS, 'job_id', jobId, patch);

  return findRowById_(SHEET.JOBS, 'job_id', jobId);
}

/**
 * Settings
 */
function getSettingsMap_() {
  var rows = safeGetRows_(SHEET.SETTINGS);
  var map = {};

  rows.forEach(function (row) {
    if (row.setting_key) {
      map[row.setting_key] = row.setting_value;
    }
  });

  return map;
}

function updateSettings_(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings payload');
  }

  var existing = safeGetRows_(SHEET.SETTINGS);

  for (var key in settings) {
    if (!settings.hasOwnProperty(key)) continue;

    var value = String(settings[key]);

    var found = null;

    for (var i = 0; i < existing.length; i++) {
      if (existing[i].setting_key === key) {
        found = existing[i];
        break;
      }
    }

    if (found) {
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

/**
 * Response
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetSchema() {
  var schemas = {
    Customers: [
      'customer_id',
      'created_at',
      'updated_at',
      'first_name',
      'last_name',
      'company_name',
      'email',
      'phone',
      'street_address',
      'city',
      'state',
      'zip',
      'notes'
    ],
    Estimates: [
      'estimate_id',
      'estimate_number',
      'created_at',
      'updated_at',
      'estimate_date',
      'customer_id',
      'customer_name',
      'phone',
      'email',
      'property_address',
      'property_city',
      'property_state',
      'property_zip',
      'status',
      'representative_name',
      'subtotal',
      'tax_rate',
      'tax_amount',
      'total',
      'internal_notes',
      'customer_notes',
      'sent_at',
      'approved_at',
      'scheduled_at',
      'completed_at',
      'paid_at'
    ],
    Estimate_Line_Items: [
      'line_item_id',
      'estimate_id',
      'sort_order',
      'service_category',
      'service_description',
      'tree_species',
      'location_on_property',
      'quantity',
      'unit',
      'unit_price',
      'line_total',
      'taxable',
      'crew_notes'
    ],
    Jobs: [
      'job_id',
      'estimate_id',
      'customer_name',
      'property_address',
      'scheduled_date',
      'crew_assigned',
      'job_status',
      'completion_notes',
      'created_at',
      'updated_at'
    ],
    Settings: [
      'setting_key',
      'setting_value'
    ]
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(schemas).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    var headers = schemas[sheetName];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });

  var settingsSheet = ss.getSheetByName('Settings');

  var settingsRows = [
    ['business_name', 'R.T. Davies Tree Experts'],
    ['business_address', '2101 Bridge Avenue, Point Pleasant, NJ 08742'],
    ['business_phone', '732-899-0328'],
    ['default_tax_rate', '0.06625'],
    ['default_terms', 'Payment in full upon completion of work unless otherwise specified.'],
    ['service_categories', 'Tree Removal|Stump Grinding|Limb Removal|Tree Pruning|Shrub Pruning|Fertilization|Deep Root Feeding|Spraying|Insect Management|Consulting|Tree Planting|Yearly Maintenance Program|Other']
  ];

  settingsSheet.getRange(2, 1, settingsRows.length, 2).setValues(settingsRows);

  return 'RT Davies sheet schema created successfully';
}