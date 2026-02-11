// ==========================================
// eravnProjects - Firestore Repository Layer
// ==========================================
// Handles all CRUD operations with Firestore via REST API

/**
 * Get Firestore base URL for the configured project
 */
function getFirestoreUrl() {
  var settings = getSettingsFromCache_();
  var projectId = settings.firebaseProjectId || CONFIG.FIRESTORE_PROJECT_ID;
  return CONFIG.FIRESTORE_BASE_URL + projectId + '/databases/(default)/documents/';
}

/**
 * Make authenticated request to Firestore REST API
 */
function firestoreRequest_(method, path, payload) {
  var url = getFirestoreUrl() + path;
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    muteHttpExceptions: true,
  };
  if (payload) options.payload = JSON.stringify(payload);

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code >= 400) {
    Logger.log('Firestore error [' + code + ']: ' + response.getContentText());
    throw new Error('Firestore request failed with code ' + code);
  }

  return JSON.parse(response.getContentText());
}

// ==========================================
// Projects Collection
// ==========================================

function getAllProjects() {
  var result = firestoreRequest_('GET', 'projects');
  if (!result.documents) return [];
  return result.documents.map(docToProject_);
}

function getProjectById(projectId) {
  var result = firestoreRequest_('GET', 'projects/' + projectId);
  return docToProject_(result);
}

function saveProject(project) {
  var doc = projectToDoc_(project);
  firestoreRequest_('PATCH', 'projects/' + project.id, doc);
  return project;
}

function createProjectInDb(project) {
  project.id = project.id || generateId();
  project.createdAt = getCurrentTimestamp();
  project.updatedAt = getCurrentTimestamp();
  project.status = project.status || 'active';
  project.filesCount = 0;
  project.lastSyncTimestamp = null;
  project.lastSyncStatus = null;

  var doc = projectToDoc_(project);
  firestoreRequest_('PATCH', 'projects/' + project.id, doc);
  return project;
}

function deleteProjectFromDb(projectId) {
  firestoreRequest_('DELETE', 'projects/' + projectId);
  return { success: true };
}

// ==========================================
// Sync Sessions Collection
// ==========================================

function saveSyncSession(session) {
  var doc = sessionToDoc_(session);
  firestoreRequest_('PATCH', 'syncSessions/' + session.id, doc);
  return session;
}

function getSyncSessionsByProject(projectId) {
  var result = firestoreRequest_('GET',
    ':runQuery',
    { structuredQuery: { from: [{ collectionId: 'syncSessions' }], where: { fieldFilter: { field: { fieldPath: 'projectId' }, op: 'EQUAL', value: { stringValue: projectId } } }, orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }], limit: 50 } }
  );
  return result.filter(function(r) { return r.document; }).map(function(r) { return docToSession_(r.document); });
}

function getRecentSyncSessions(limit) {
  limit = limit || 20;
  var result = firestoreRequest_('GET',
    ':runQuery',
    { structuredQuery: { from: [{ collectionId: 'syncSessions' }], orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }], limit: limit } }
  );
  return result.filter(function(r) { return r.document; }).map(function(r) { return docToSession_(r.document); });
}

// ==========================================
// File Logs - Batch Write
// ==========================================

function batchSaveFileLogs(sessionId, fileLogs) {
  // Firestore batch write - max 500 per batch
  var writes = fileLogs.map(function(log) {
    log.id = log.id || generateId();
    log.sessionId = sessionId;
    return {
      update: {
        name: getFirestoreUrl() + 'fileLogs/' + log.id,
        fields: fileLogToFields_(log),
      },
    };
  });

  // Split into batches of CONFIG.BATCH_SIZE
  for (var i = 0; i < writes.length; i += CONFIG.BATCH_SIZE) {
    var batch = writes.slice(i, i + CONFIG.BATCH_SIZE);
    firestoreRequest_('POST', ':batchWrite', { writes: batch });
  }
}

function getFileLogsBySession(sessionId) {
  var result = firestoreRequest_('GET',
    ':runQuery',
    { structuredQuery: { from: [{ collectionId: 'fileLogs' }], where: { fieldFilter: { field: { fieldPath: 'sessionId' }, op: 'EQUAL', value: { stringValue: sessionId } } } } }
  );
  return result.filter(function(r) { return r.document; }).map(function(r) { return docToFileLog_(r.document); });
}

// ==========================================
// Settings
// ==========================================

function getSettingsFromDb() {
  try {
    var result = firestoreRequest_('GET', 'settings/global');
    return docToSettings_(result);
  } catch (e) {
    return getDefaultSettings_();
  }
}

function saveSettingsToDb(settings) {
  var doc = settingsToDoc_(settings);
  firestoreRequest_('PATCH', 'settings/global', doc);
  return settings;
}

// ==========================================
// Document Converters (Firestore format <-> JS object)
// ==========================================

function docToProject_(doc) {
  var f = doc.fields || {};
  return {
    id: extractDocId_(doc.name),
    name: fv_(f.name),
    description: fv_(f.description) || '',
    sourceFolderId: fv_(f.sourceFolderId),
    sourceFolderLink: fv_(f.sourceFolderLink),
    destFolderId: fv_(f.destFolderId),
    destFolderLink: fv_(f.destFolderLink),
    status: fv_(f.status) || 'active',
    lastSyncTimestamp: fv_(f.lastSyncTimestamp) || null,
    lastSyncStatus: fv_(f.lastSyncStatus) || null,
    filesCount: Number(fv_(f.filesCount)) || 0,
    createdAt: fv_(f.createdAt),
    updatedAt: fv_(f.updatedAt),
  };
}

function projectToDoc_(p) {
  return { fields: {
    name: { stringValue: p.name },
    description: { stringValue: p.description || '' },
    sourceFolderId: { stringValue: p.sourceFolderId },
    sourceFolderLink: { stringValue: p.sourceFolderLink },
    destFolderId: { stringValue: p.destFolderId },
    destFolderLink: { stringValue: p.destFolderLink },
    status: { stringValue: p.status },
    lastSyncTimestamp: p.lastSyncTimestamp ? { stringValue: p.lastSyncTimestamp } : { nullValue: null },
    lastSyncStatus: p.lastSyncStatus ? { stringValue: p.lastSyncStatus } : { nullValue: null },
    filesCount: { integerValue: String(p.filesCount || 0) },
    createdAt: { stringValue: p.createdAt },
    updatedAt: { stringValue: p.updatedAt || getCurrentTimestamp() },
  }};
}

function docToSession_(doc) {
  var f = doc.fields || {};
  return {
    id: extractDocId_(doc.name),
    projectId: fv_(f.projectId),
    projectName: fv_(f.projectName),
    runId: fv_(f.runId),
    timestamp: fv_(f.timestamp),
    executionDurationSeconds: Number(fv_(f.executionDurationSeconds)) || 0,
    status: fv_(f.status),
    filesCount: Number(fv_(f.filesCount)) || 0,
    errorMessage: fv_(f.errorMessage) || undefined,
  };
}

function sessionToDoc_(s) {
  var fields = {
    projectId: { stringValue: s.projectId },
    projectName: { stringValue: s.projectName },
    runId: { stringValue: s.runId },
    timestamp: { stringValue: s.timestamp },
    executionDurationSeconds: { integerValue: String(s.executionDurationSeconds) },
    status: { stringValue: s.status },
    filesCount: { integerValue: String(s.filesCount) },
  };
  if (s.errorMessage) fields.errorMessage = { stringValue: s.errorMessage };
  return { fields: fields };
}

function fileLogToFields_(log) {
  return {
    sessionId: { stringValue: log.sessionId },
    fileName: { stringValue: log.fileName },
    sourceLink: { stringValue: log.sourceLink },
    destLink: { stringValue: log.destLink },
    sourcePath: { stringValue: log.sourcePath || '' },
    createdDate: { stringValue: log.createdDate },
    modifiedDate: { stringValue: log.modifiedDate },
    fileSize: { integerValue: String(log.fileSize || 0) },
  };
}

function docToFileLog_(doc) {
  var f = doc.fields || {};
  return {
    id: extractDocId_(doc.name),
    sessionId: fv_(f.sessionId),
    fileName: fv_(f.fileName),
    sourceLink: fv_(f.sourceLink),
    destLink: fv_(f.destLink),
    sourcePath: fv_(f.sourcePath) || '',
    createdDate: fv_(f.createdDate),
    modifiedDate: fv_(f.modifiedDate),
    fileSize: Number(fv_(f.fileSize)) || 0,
  };
}

function docToSettings_(doc) {
  var f = doc.fields || {};
  return {
    syncCutoffSeconds: Number(fv_(f.syncCutoffSeconds)) || 300,
    defaultScheduleCron: fv_(f.defaultScheduleCron) || '0 */6 * * *',
    webhookUrl: fv_(f.webhookUrl) || '',
    firebaseProjectId: fv_(f.firebaseProjectId) || '',
    enableNotifications: fv_(f.enableNotifications) === 'true' || fv_(f.enableNotifications) === true,
    maxRetries: Number(fv_(f.maxRetries)) || 3,
    batchSize: Number(fv_(f.batchSize)) || 50,
  };
}

function settingsToDoc_(s) {
  return { fields: {
    syncCutoffSeconds: { integerValue: String(s.syncCutoffSeconds) },
    defaultScheduleCron: { stringValue: s.defaultScheduleCron },
    webhookUrl: { stringValue: s.webhookUrl || '' },
    firebaseProjectId: { stringValue: s.firebaseProjectId || '' },
    enableNotifications: { booleanValue: !!s.enableNotifications },
    maxRetries: { integerValue: String(s.maxRetries) },
    batchSize: { integerValue: String(s.batchSize) },
  }};
}

// Helpers
function fv_(field) {
  if (!field) return null;
  return field.stringValue || field.integerValue || field.booleanValue || field.nullValue || null;
}

function extractDocId_(name) {
  if (!name) return '';
  var parts = name.split('/');
  return parts[parts.length - 1];
}

function getDefaultSettings_() {
  return {
    syncCutoffSeconds: CONFIG.DEFAULT_CUTOFF_SECONDS,
    defaultScheduleCron: '0 */6 * * *',
    webhookUrl: '',
    firebaseProjectId: '',
    enableNotifications: true,
    maxRetries: CONFIG.MAX_RETRIES,
    batchSize: CONFIG.BATCH_SIZE,
  };
}

// Cache settings in script properties for performance
var settingsCache_ = null;
function getSettingsFromCache_() {
  if (settingsCache_) return settingsCache_;
  try {
    settingsCache_ = getSettingsFromDb();
  } catch (e) {
    settingsCache_ = getDefaultSettings_();
  }
  return settingsCache_;
}
