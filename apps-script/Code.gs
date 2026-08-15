/* global ContentService, LockService, PropertiesService, Session, SpreadsheetApp, Utilities */

const APP_VERSION = '4.0.0-phase4';
const SESSION_DAYS = 30;
const ALLOWED_USERS = ['david', 'esther'];
const SHEETS = {
  Meta: ['key', 'value'],
  Users: ['id', 'displayName', 'active'],
  Accounts: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'name', 'type', 'initialBalanceCents', 'includeInNetWorth', 'includeInLiquidity', 'archivedAt'],
  Categories: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'name', 'kind', 'icon', 'archivedAt'],
  Transactions: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'kind', 'amountCents', 'concept', 'date', 'accountId', 'categoryId', 'sourceAccountId', 'destinationAccountId', 'note', 'recurringRuleId', 'recurringOccurrenceDate'],
  RecurringRules: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'kind', 'amountCents', 'concept', 'note', 'accountId', 'categoryId', 'frequency', 'startDate', 'endDate', 'active'],
  Budgets: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'],
  Goals: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'],
  GoalAllocations: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'],
  MonthlyClosures: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'],
  SyncOperations: ['operationId', 'processedAt', 'resultJson', 'entityType'],
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hogar Finanzas')
    .addItem('Inicializar o cambiar clave', 'initializeFromPrompt')
    .addItem('Migrar a Fase 4', 'migratePhase4')
    .addToUi();
}

function initializeFromPrompt() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Inicializar Hogar Finanzas', 'Introduce una clave doméstica única de al menos 10 caracteres.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  initializeProject(response.getResponseText());
  ui.alert('Configuración terminada. Ya puedes desplegar la aplicación web.');
}

function doGet() {
  return jsonOutput_({ ok: true, data: { service: 'Hogar Finanzas', version: APP_VERSION } });
}

function doPost(event) {
  try {
    const request = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    if (request.action === 'login') return jsonOutput_({ ok: true, data: login_(request) });
    if (request.action === 'bootstrap') {
      verifyToken_(request.token);
      return jsonOutput_({ ok: true, data: pullChanges_(0) });
    }
    if (request.action === 'sync') return jsonOutput_({ ok: true, data: sync_(request) });
    return jsonOutput_({ ok: false, error: { code: 'unknown_action', message: 'Acción no reconocida.' } });
  } catch (error) {
    return jsonOutput_({ ok: false, error: normalizeError_(error) });
  }
}

/** Execute once from the Apps Script editor after binding the project to a Sheet. */
function initializeProject(householdKey) {
  if (typeof householdKey !== 'string' || householdKey.length < 10) {
    throw new Error('La clave doméstica debe tener al menos 10 caracteres.');
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este script a una hoja de cálculo.');
  Object.keys(SHEETS).forEach(function (name) { ensureSheet_(spreadsheet, name, SHEETS[name]); });
  seedUsers_(spreadsheet);
  setMeta_(spreadsheet, 'schemaVersion', '4');
  if (getMeta_(spreadsheet, 'changeSequence') === null) setMeta_(spreadsheet, 'changeSequence', '0');
  seedCategories_(spreadsheet);

  const properties = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  properties.setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    HOUSEHOLD_SALT: salt,
    HOUSEHOLD_KEY_HASH: digest_(salt + ':' + householdKey),
    TOKEN_SECRET: Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(),
  });
  return { spreadsheetId: spreadsheet.getId(), sheets: Object.keys(SHEETS), users: ALLOWED_USERS };
}

function migratePhase2() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este script a una hoja de cálculo.');
  Object.keys(SHEETS).forEach(function (name) { ensureSheet_(spreadsheet, name, SHEETS[name]); });
  if (getMeta_(spreadsheet, 'changeSequence') === null) setMeta_(spreadsheet, 'changeSequence', '0');
  setMeta_(spreadsheet, 'schemaVersion', '2');
  seedUsers_(spreadsheet);
  seedCategories_(spreadsheet);
  return { schemaVersion: 2, categories: readObjects_(spreadsheet.getSheetByName('Categories'), SHEETS.Categories).length };
}

function migratePhase3() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este script a una hoja de cálculo.');
  Object.keys(SHEETS).forEach(function (name) { ensureSheet_(spreadsheet, name, SHEETS[name]); });
  if (getMeta_(spreadsheet, 'changeSequence') === null) setMeta_(spreadsheet, 'changeSequence', '0');
  setMeta_(spreadsheet, 'schemaVersion', '3');
  seedUsers_(spreadsheet);
  seedCategories_(spreadsheet);
  return { schemaVersion: 3, transactionColumns: SHEETS.Transactions.length };
}

function migratePhase4() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este script a una hoja de cálculo.');
  Object.keys(SHEETS).forEach(function (name) { ensureSheet_(spreadsheet, name, SHEETS[name]); });
  if (getMeta_(spreadsheet, 'changeSequence') === null) setMeta_(spreadsheet, 'changeSequence', '0');
  setMeta_(spreadsheet, 'schemaVersion', '4');
  seedUsers_(spreadsheet);
  seedCategories_(spreadsheet);
  return { schemaVersion: 4, transactionColumns: SHEETS.Transactions.length, recurringRuleColumns: SHEETS.RecurringRules.length };
}

function login_(request) {
  if (ALLOWED_USERS.indexOf(request.userId) === -1) throw apiError_('invalid_user', 'Usuario no permitido.');
  const properties = PropertiesService.getScriptProperties();
  const salt = properties.getProperty('HOUSEHOLD_SALT');
  const expected = properties.getProperty('HOUSEHOLD_KEY_HASH');
  if (!salt || !expected) throw apiError_('not_initialized', 'El servidor todavía no está inicializado.');
  const actual = digest_(salt + ':' + String(request.householdKey || ''));
  if (!constantTimeEqual_(actual, expected)) throw apiError_('invalid_credentials', 'La clave de casa no es correcta.');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  return { token: signToken_({ userId: request.userId, expiresAt: expiresAt }), userId: request.userId, expiresAt: expiresAt };
}

function sync_(request) {
  const session = verifyToken_(request.token);
  const cursor = Number(request.cursor || 0);
  const operations = Array.isArray(request.operations) ? request.operations : [];
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw apiError_('invalid_cursor', 'Cursor no válido.');
  if (operations.length > 100) throw apiError_('batch_too_large', 'El lote supera 100 operaciones.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = openSpreadsheet_();
    const results = operations.map(function (operation) {
      try { return applyOperation_(spreadsheet, operation, session.userId); }
      catch (error) {
        const normalized = normalizeError_(error);
        return { operationId: operation && operation.operationId, ok: false, error: { code: normalized.code, message: normalized.message, permanent: normalized.permanent !== false } };
      }
    });
    const pull = pullChanges_(cursor, spreadsheet);
    return { results: results, changes: pull.changes, cursor: pull.cursor };
  } finally {
    lock.releaseLock();
  }
}

function applyOperation_(spreadsheet, operation, userId) {
  const entityType = operation && operation.entityType ? operation.entityType : 'transaction';
  validateOperationEnvelope_(operation, entityType);
  const previous = findRowObject_(spreadsheet.getSheetByName('SyncOperations'), 'operationId', operation.operationId);
  if (previous) return JSON.parse(previous.value.resultJson);
  validateOperation_(spreadsheet, operation, userId, entityType);

  const sheetName = entitySheet_(entityType);
  const sheet = spreadsheet.getSheetByName(sheetName);
  const found = findRowObject_(sheet, 'id', operation.recordId);
  let record;
  if (operation.kind === 'create') {
    if (found && entityType === 'transaction' && operation.payload.recurringRuleId && operation.payload.recurringOccurrenceDate) {
      const currentOccurrence = normalizeEntity_(entityType, found.value);
      if (currentOccurrence.deletedAt) throw apiError_('record_deleted', 'La ocurrencia fue eliminada y no puede restaurarse.');
      if (currentOccurrence.recurringRuleId !== operation.payload.recurringRuleId || currentOccurrence.recurringOccurrenceDate !== operation.payload.recurringOccurrenceDate) throw apiError_('record_exists', 'Ya existe otro registro con ese identificador.');
      record = currentOccurrence;
    } else {
      if (found) throw apiError_('record_exists', 'Ya existe un registro con ese identificador.');
      if (entityType === 'transaction' && operation.payload.recurringRuleId) {
        const duplicate = findRecurringOccurrence_(sheet, operation.payload.recurringRuleId, operation.payload.recurringOccurrenceDate);
        if (duplicate) throw apiError_('duplicate_occurrence', 'Esta ocurrencia ya fue registrada.');
      }
      record = serverRecord_(entityType, operation.payload, 1, nextSequence_(spreadsheet), userId, null);
      appendObject_(sheet, SHEETS[sheetName], record);
    }
  } else if (!found) {
    if (operation.kind !== 'delete') throw apiError_('record_missing', 'El registro ya no existe.');
    record = serverRecord_(entityType, operation.payload, 1, nextSequence_(spreadsheet), userId, new Date().toISOString());
    appendObject_(sheet, SHEETS[sheetName], record);
  } else {
    const current = normalizeEntity_(entityType, found.value);
    if (current.deletedAt && operation.kind !== 'delete') throw apiError_('record_deleted', 'El registro fue eliminado y no puede restaurarse.');
    if (current.deletedAt && operation.kind === 'delete') {
      record = current;
    } else {
      const deletedAt = operation.kind === 'delete' ? new Date().toISOString() : null;
      const payload = operation.kind === 'delete' ? current : operation.payload;
      record = serverRecord_(entityType, payload, current.version + 1, nextSequence_(spreadsheet), current.createdBy, deletedAt);
      writeObjectRow_(sheet, found.row, SHEETS[sheetName], record);
    }
  }
  const result = { operationId: operation.operationId, ok: true, entityType: entityType, record: record };
  appendObject_(spreadsheet.getSheetByName('SyncOperations'), SHEETS.SyncOperations, {
    operationId: operation.operationId,
    processedAt: new Date().toISOString(),
    resultJson: JSON.stringify(result),
    entityType: entityType,
  });
  return result;
}

function pullChanges_(cursor, existingSpreadsheet) {
  const spreadsheet = existingSpreadsheet || openSpreadsheet_();
  const changes = ['transaction', 'account', 'category', 'recurringRule'].reduce(function (all, entityType) {
    const sheetName = entitySheet_(entityType);
    const rows = readObjects_(spreadsheet.getSheetByName(sheetName), SHEETS[sheetName]).map(function (row) { return normalizeEntity_(entityType, row); });
    return all.concat(rows.filter(function (record) { return record.changeSequence > cursor; }).map(function (record) { return { entityType: entityType, record: record }; }));
  }, []).sort(function (left, right) { return left.record.changeSequence - right.record.changeSequence; });
  const current = Number(getMeta_(spreadsheet, 'changeSequence') || 0);
  return { changes: changes, cursor: current };
}

function validateOperation_(spreadsheet, operation, userId, entityType) {
  validateOperationEnvelope_(operation, entityType);
  if (operation.kind === 'delete') return;
  const record = operation.payload;
  if (operation.kind === 'create' && record.createdBy !== userId) throw apiError_('invalid_owner', 'El creador no coincide con la sesión.');
  if (entityType === 'transaction') validateTransaction_(spreadsheet, record, !operation.entityType || !Object.prototype.hasOwnProperty.call(record, 'accountId'));
  else if (entityType === 'account') validateAccount_(record);
  else if (entityType === 'category') validateCategory_(record);
  else validateRecurringRule_(spreadsheet, record);
}

function validateOperationEnvelope_(operation, entityType) {
  if (!operation || typeof operation.operationId !== 'string' || !operation.operationId) throw apiError_('invalid_operation', 'Falta operationId.');
  if (['transaction', 'account', 'category', 'recurringRule'].indexOf(entityType) === -1) throw apiError_('invalid_operation', 'Entidad inválida.');
  if (['create', 'update', 'delete'].indexOf(operation.kind) === -1) throw apiError_('invalid_operation', 'Tipo de operación inválido.');
  if (operation.recordId !== (operation.payload && operation.payload.id)) throw apiError_('invalid_record', 'El identificador no coincide.');
}

function validateTransaction_(spreadsheet, record, legacy) {
  if (!record || ['income', 'expense', 'transfer', 'adjustment'].indexOf(record.kind) === -1) throw apiError_('invalid_record', 'Tipo de movimiento inválido.');
  if (!Number.isSafeInteger(record.amountCents) || (record.kind === 'adjustment' ? record.amountCents === 0 : record.amountCents <= 0)) throw apiError_('invalid_amount', 'Importe no válido.');
  if (typeof record.concept !== 'string' || !record.concept.trim() || record.concept.length > 120) throw apiError_('invalid_concept', 'Concepto no válido.');
  if (record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 500)) throw apiError_('invalid_note', 'Nota no válida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) throw apiError_('invalid_date', 'Fecha no válida.');
  if (legacy) return;
  if (record.kind === 'transfer') {
    if (!record.sourceAccountId || !record.destinationAccountId || record.sourceAccountId === record.destinationAccountId) throw apiError_('invalid_accounts', 'Cuentas de transferencia no válidas.');
    requireActive_(spreadsheet, 'Accounts', record.sourceAccountId);
    requireActive_(spreadsheet, 'Accounts', record.destinationAccountId);
  } else {
    if (!record.accountId) throw apiError_('invalid_account', 'Cuenta obligatoria.');
    requireActive_(spreadsheet, 'Accounts', record.accountId);
  }
  if (record.kind === 'income' || record.kind === 'expense') {
    if (!record.categoryId) throw apiError_('invalid_category', 'Categoría obligatoria.');
    const category = requireActive_(spreadsheet, 'Categories', record.categoryId);
    if (String(category.kind) !== record.kind) throw apiError_('invalid_category', 'La categoría no coincide con el movimiento.');
  }
  const hasRule = Boolean(record.recurringRuleId);
  const hasOccurrence = Boolean(record.recurringOccurrenceDate);
  if (hasRule !== hasOccurrence) throw apiError_('invalid_recurrence', 'El vínculo recurrente está incompleto.');
  if (hasRule) {
    if (record.kind !== 'income' && record.kind !== 'expense') throw apiError_('invalid_recurrence', 'Solo ingresos y gastos pueden ser recurrentes.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.recurringOccurrenceDate)) throw apiError_('invalid_recurrence', 'Fecha recurrente no válida.');
    const rule = findRowObject_(spreadsheet.getSheetByName('RecurringRules'), 'id', record.recurringRuleId);
    if (!rule || rule.value.deletedAt) throw apiError_('invalid_recurrence', 'La regla recurrente no existe.');
  }
}

function validateAccount_(record) {
  if (!record || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 80) throw apiError_('invalid_account', 'Nombre de cuenta no válido.');
  if (['checking', 'savings', 'investment', 'cash'].indexOf(record.type) === -1) throw apiError_('invalid_account', 'Tipo de cuenta no válido.');
  if (!Number.isSafeInteger(record.initialBalanceCents)) throw apiError_('invalid_amount', 'Saldo inicial no válido.');
}

function validateCategory_(record) {
  if (!record || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 60) throw apiError_('invalid_category', 'Nombre de categoría no válido.');
  if (['income', 'expense'].indexOf(record.kind) === -1 || typeof record.icon !== 'string' || !record.icon.trim()) throw apiError_('invalid_category', 'Categoría no válida.');
}

function validateRecurringRule_(spreadsheet, record) {
  if (!record || ['income', 'expense'].indexOf(record.kind) === -1) throw apiError_('invalid_recurrence', 'Tipo recurrente no válido.');
  if (!Number.isSafeInteger(record.amountCents) || record.amountCents <= 0) throw apiError_('invalid_amount', 'Importe recurrente no válido.');
  if (typeof record.concept !== 'string' || !record.concept.trim() || record.concept.length > 120) throw apiError_('invalid_concept', 'Concepto recurrente no válido.');
  if (typeof record.note !== 'string' || record.note.length > 500) throw apiError_('invalid_note', 'Nota no válida.');
  if (['monthly', 'quarterly', 'annual'].indexOf(record.frequency) === -1) throw apiError_('invalid_recurrence', 'Frecuencia no válida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.startDate) || (record.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(record.endDate) || record.endDate < record.startDate))) throw apiError_('invalid_date', 'Fechas recurrentes no válidas.');
  const account = record.active ? requireActive_(spreadsheet, 'Accounts', record.accountId) : findRowObject_(spreadsheet.getSheetByName('Accounts'), 'id', record.accountId);
  const category = record.active ? requireActive_(spreadsheet, 'Categories', record.categoryId) : findRowObject_(spreadsheet.getSheetByName('Categories'), 'id', record.categoryId);
  const accountValue = account && account.value ? account.value : account;
  const categoryValue = category && category.value ? category.value : category;
  if (!accountValue || accountValue.deletedAt || !categoryValue || categoryValue.deletedAt || String(categoryValue.kind) !== record.kind) throw apiError_('invalid_category', 'La categoría no coincide con la recurrencia.');
}

function requireActive_(spreadsheet, sheetName, id) {
  const found = findRowObject_(spreadsheet.getSheetByName(sheetName), 'id', id);
  if (!found || found.value.deletedAt || found.value.archivedAt) throw apiError_('inactive_reference', 'La cuenta o categoría no está disponible.');
  return found.value;
}

function serverRecord_(entityType, payload, version, sequence, createdBy, deletedAt) {
  const common = {
    id: payload.id,
    createdAt: payload.createdAt,
    updatedAt: new Date().toISOString(),
    deletedAt: deletedAt,
    createdBy: createdBy,
    version: version,
    changeSequence: sequence,
  };
  if (entityType === 'transaction') return Object.assign(common, {
    kind: payload.kind, amountCents: payload.amountCents, concept: payload.concept.trim(), date: payload.date,
    accountId: payload.accountId || '', categoryId: payload.categoryId || '', sourceAccountId: payload.sourceAccountId || '', destinationAccountId: payload.destinationAccountId || '', note: String(payload.note || '').trim(),
    recurringRuleId: payload.recurringRuleId || '', recurringOccurrenceDate: payload.recurringOccurrenceDate || '',
  });
  if (entityType === 'account') return Object.assign(common, {
    name: payload.name.trim(), type: payload.type, initialBalanceCents: payload.initialBalanceCents,
    includeInNetWorth: Boolean(payload.includeInNetWorth), includeInLiquidity: Boolean(payload.includeInLiquidity), archivedAt: payload.archivedAt || '',
  });
  if (entityType === 'category') return Object.assign(common, { name: payload.name.trim(), kind: payload.kind, icon: payload.icon.trim(), archivedAt: payload.archivedAt || '' });
  return Object.assign(common, { kind: payload.kind, amountCents: payload.amountCents, concept: payload.concept.trim(), note: payload.note.trim(),
    accountId: payload.accountId, categoryId: payload.categoryId, frequency: payload.frequency, startDate: payload.startDate,
    endDate: payload.endDate || '', active: Boolean(payload.active) });
}

function initializeSheetHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  headers.forEach(function (header, index) {
    if (actual[index] && actual[index] !== header) throw new Error('Cabeceras incompatibles en la hoja ' + sheet.getName());
  });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  initializeSheetHeaders_(sheet, headers);
}

function seedUsers_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Users');
  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 2, 3).setValues([['david', 'David', true], ['esther', 'Esther', true]]);
  }
}

function seedCategories_(spreadsheet) {
  const defaults = {
    expense: ['Vivienda', 'Alimentación', 'Restaurantes', 'Transporte', 'Coche', 'Niños', 'Salud', 'Educación', 'Ocio', 'Viajes', 'Suscripciones', 'Seguros', 'Impuestos', 'Compras', 'Mascotas', 'Regalos', 'Otros'],
    income: ['Nómina', 'Empresa', 'Extraordinarios', 'Reembolsos', 'Otros ingresos'],
  };
  const sheet = spreadsheet.getSheetByName('Categories');
  const existing = readObjects_(sheet, SHEETS.Categories);
  Object.keys(defaults).forEach(function (kind) {
    defaults[kind].forEach(function (name) {
      const found = existing.some(function (item) { return String(item.kind) === kind && String(item.name).toLowerCase() === name.toLowerCase(); });
      if (found) return;
      const now = new Date().toISOString();
      appendObject_(sheet, SHEETS.Categories, { id: Utilities.getUuid(), createdAt: now, updatedAt: now, deletedAt: '', createdBy: 'david',
        version: 1, changeSequence: nextSequence_(spreadsheet), name: name, kind: kind, icon: '●', archivedAt: '' });
    });
  });
}

function readObjects_(sheet, headers) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(function (values) {
    const object = {};
    headers.forEach(function (header, index) { object[header] = values[index]; });
    return object;
  });
}

function findRowObject_(sheet, key, value) {
  const headers = SHEETS[sheet.getName()];
  const rows = readObjects_(sheet, headers);
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][key]) === String(value)) return { row: index + 2, value: rows[index] };
  }
  return null;
}

function findRecurringOccurrence_(sheet, ruleId, date) {
  const rows = readObjects_(sheet, SHEETS.Transactions);
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index].recurringRuleId) === String(ruleId) && normalizeDateCell_(rows[index].recurringOccurrenceDate) === String(date)) return rows[index];
  }
  return null;
}

function appendObject_(sheet, headers, object) {
  sheet.appendRow(headers.map(function (header) { return sheetValue_(object[header]); }));
}

function writeObjectRow_(sheet, row, headers, object) {
  sheet.getRange(row, 1, 1, headers.length).setValues([headers.map(function (header) { return sheetValue_(object[header]); })]);
}

function sheetValue_(value) { return value === null || value === undefined ? '' : value; }

function normalizeTransaction_(row) {
  return {
    id: String(row.id), createdAt: normalizeTimestampCell_(row.createdAt), updatedAt: normalizeTimestampCell_(row.updatedAt),
    deletedAt: row.deletedAt ? normalizeTimestampCell_(row.deletedAt) : null, createdBy: String(row.createdBy),
    version: Number(row.version), changeSequence: Number(row.changeSequence), kind: String(row.kind),
    amountCents: Number(row.amountCents), concept: String(row.concept), date: normalizeDateCell_(row.date),
    accountId: row.accountId ? String(row.accountId) : null, categoryId: row.categoryId ? String(row.categoryId) : null,
    sourceAccountId: row.sourceAccountId ? String(row.sourceAccountId) : null, destinationAccountId: row.destinationAccountId ? String(row.destinationAccountId) : null, note: row.note ? String(row.note) : '',
    recurringRuleId: row.recurringRuleId ? String(row.recurringRuleId) : null, recurringOccurrenceDate: row.recurringOccurrenceDate ? normalizeDateCell_(row.recurringOccurrenceDate) : null,
  };
}

function normalizeAccount_(row) {
  return {
    id: String(row.id), createdAt: normalizeTimestampCell_(row.createdAt), updatedAt: normalizeTimestampCell_(row.updatedAt),
    deletedAt: row.deletedAt ? normalizeTimestampCell_(row.deletedAt) : null, createdBy: String(row.createdBy), version: Number(row.version), changeSequence: Number(row.changeSequence),
    name: String(row.name), type: String(row.type), initialBalanceCents: Number(row.initialBalanceCents), includeInNetWorth: toBoolean_(row.includeInNetWorth),
    includeInLiquidity: toBoolean_(row.includeInLiquidity), archivedAt: row.archivedAt ? normalizeTimestampCell_(row.archivedAt) : null,
  };
}

function normalizeCategory_(row) {
  return {
    id: String(row.id), createdAt: normalizeTimestampCell_(row.createdAt), updatedAt: normalizeTimestampCell_(row.updatedAt),
    deletedAt: row.deletedAt ? normalizeTimestampCell_(row.deletedAt) : null, createdBy: String(row.createdBy), version: Number(row.version), changeSequence: Number(row.changeSequence),
    name: String(row.name), kind: String(row.kind), icon: String(row.icon), archivedAt: row.archivedAt ? normalizeTimestampCell_(row.archivedAt) : null,
  };
}

function normalizeRecurringRule_(row) {
  return {
    id: String(row.id), createdAt: normalizeTimestampCell_(row.createdAt), updatedAt: normalizeTimestampCell_(row.updatedAt),
    deletedAt: row.deletedAt ? normalizeTimestampCell_(row.deletedAt) : null, createdBy: String(row.createdBy), version: Number(row.version), changeSequence: Number(row.changeSequence),
    kind: String(row.kind), amountCents: Number(row.amountCents), concept: String(row.concept), note: row.note ? String(row.note) : '',
    accountId: String(row.accountId), categoryId: String(row.categoryId), frequency: String(row.frequency), startDate: normalizeDateCell_(row.startDate),
    endDate: row.endDate ? normalizeDateCell_(row.endDate) : null, active: toBoolean_(row.active),
  };
}

function normalizeEntity_(entityType, row) { return entityType === 'transaction' ? normalizeTransaction_(row) : entityType === 'account' ? normalizeAccount_(row) : entityType === 'category' ? normalizeCategory_(row) : normalizeRecurringRule_(row); }
function entitySheet_(entityType) { return entityType === 'transaction' ? 'Transactions' : entityType === 'account' ? 'Accounts' : entityType === 'category' ? 'Categories' : 'RecurringRules'; }
function toBoolean_(value) { return value === true || String(value).toLowerCase() === 'true'; }

function normalizeTimestampCell_(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function normalizeDateCell_(value) {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return text;
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function openSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError_('not_initialized', 'El servidor todavía no está inicializado.');
  return SpreadsheetApp.openById(id);
}

function nextSequence_(spreadsheet) {
  const next = Number(getMeta_(spreadsheet, 'changeSequence') || 0) + 1;
  setMeta_(spreadsheet, 'changeSequence', String(next));
  return next;
}

function getMeta_(spreadsheet, key) {
  const found = findRowObject_(spreadsheet.getSheetByName('Meta'), 'key', key);
  return found ? String(found.value.value) : null;
}

function setMeta_(spreadsheet, key, value) {
  const sheet = spreadsheet.getSheetByName('Meta');
  const found = findRowObject_(sheet, 'key', key);
  const object = { key: key, value: value };
  if (found) writeObjectRow_(sheet, found.row, SHEETS.Meta, object); else appendObject_(sheet, SHEETS.Meta, object);
}

function signToken_(payload) {
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8).replace(/=+$/, '');
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded, secret)).replace(/=+$/, '');
  return encoded + '.' + signature;
}

function verifyToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw apiError_('invalid_token', 'Sesión no válida.');
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret)).replace(/=+$/, '');
  if (!constantTimeEqual_(parts[1], expected)) throw apiError_('invalid_token', 'Sesión no válida.');
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (ALLOWED_USERS.indexOf(payload.userId) === -1 || new Date(payload.expiresAt).getTime() <= Date.now()) throw apiError_('expired_token', 'La sesión ha caducado.');
  return payload;
}

function digest_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)).replace(/=+$/, '');
}

function constantTimeEqual_(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function jsonOutput_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(code, message) {
  const error = new Error(message);
  error.code = code;
  error.permanent = true;
  return error;
}

function normalizeError_(error) {
  return { code: error.code || 'server_error', message: error.message || 'Error interno.', permanent: error.permanent !== false };
}
