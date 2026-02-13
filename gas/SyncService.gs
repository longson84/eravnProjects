// ==========================================
// eravnProject n - Sync Service (Core Logic Layer)
// ==========================================
// Time-Snapshot Sync algorithm with recursive scan and queue management

/**
 * Run sync for all active projects (queue-based)
 * Projects sorted by last_sync_timestamp ASC (oldest first)
 */
function syncAllProjects() {
  var runId = 'run-' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  var projects = getAllProjects();
  var settings = getSettingsFromCache_();
  var results = [];

  // Sort by last sync timestamp ASC (null = never synced = highest priority)
  projects.sort(function(a, b) {
    if (!a.lastSyncTimestamp) return -1;
    if (!b.lastSyncTimestamp) return 1;
    return new Date(a.lastSyncTimestamp).getTime() - new Date(b.lastSyncTimestamp).getTime();
  });

  // Filter active projects only
  var activeProjects = projects.filter(function(p) { return p.status === 'active'; });

  for (var i = 0; i < activeProjects.length; i++) {
    var project = activeProjects[i];
    try {
      var result = syncSingleProject_(project, runId, settings);
      results.push(result);
    } catch (e) {
      // Error of one project doesn't kill the entire queue
      Logger.log('Error syncing project ' + project.name + ': ' + e.message);
      var errorSession = createErrorSession_(project, runId, e.message);
      results.push(errorSession);

      // Update project status
      project.status = 'error';
      project.lastSyncStatus = 'error';
      project.updatedAt = getCurrentTimestamp();
      saveProject(project);
    }
  }

  // Send summary notification
  if (settings.enableNotifications && settings.webhookUrl) {
    sendSyncSummary(results, runId);
  }

  return { success: true, runId: runId, sessionsCount: results.length };
}

/**
 * Run sync for a single project
 */
function syncProjectById(projectId) {
  var project = getProjectById(projectId);
  if (!project) throw new Error('Project not found: ' + projectId);

  var runId = 'run-' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  var settings = getSettingsFromCache_();
  var result = syncSingleProject_(project, runId, settings);

  if (settings.enableNotifications && settings.webhookUrl) {
    sendSyncSummary([result], runId);
  }

  return { success: true, runId: runId, message: 'Synced ' + result.filesCount + ' files' };
}

/**
 * Core sync logic for a single project
 * Implements Time-Snapshot Sync with recursive folder scanning
 */
function syncSingleProject_(project, runId, settings) {
  var startTime = new Date().getTime();
  var cutoffMs = (settings.syncCutoffSeconds || CONFIG.DEFAULT_CUTOFF_SECONDS) * 1000;
  var sinceTimestamp = project.lastSyncTimestamp || '1970-01-01T00:00:00Z';

  var session = {
    id: generateId(),
    projectId: project.id,
    projectName: project.name,
    runId: runId,
    timestamp: getCurrentTimestamp(),
    executionDurationSeconds: 0,
    status: 'success',
    filesCount: 0,
    totalSizeSynced: 0, // Add new field
  };

  var fileLogsBatch = [];
  var isInterrupted = false;

  // Recursive sync function
  function syncFolder(sourceFolderId, destFolderId, pathPrefix) {
    if (isInterrupted) return;

    // Check cutoff time
    if (new Date().getTime() - startTime > cutoffMs) {
      isInterrupted = true;
      session.status = 'interrupted';
      session.errorMessage = 'Cutoff timeout: đã vượt quá ' + settings.syncCutoffSeconds + ' giây. Safe exit.';
      Logger.log('Cutoff reached for project: ' + project.name);
      return;
    }

    // List modified files in this folder
    var files = listModifiedFiles(sourceFolderId, sinceTimestamp);

    for (var i = 0; i < files.length; i++) {
      if (isInterrupted) return;

      // Check cutoff after each file
      if (new Date().getTime() - startTime > cutoffMs) {
        isInterrupted = true;
        session.status = 'interrupted';
        session.errorMessage = 'Cutoff timeout: đã vượt quá ' + settings.syncCutoffSeconds + ' giây. Safe exit.';
        return;
      }

      var file = files[i];

      // Skip folders (handled recursively below)
      if (file.mimeType === CONFIG.FOLDER_MIME_TYPE) continue;

      // Copy file
      var copiedFile = copyFileToDest(file.id, destFolderId, file.name);
      var fileSize = Number(file.size) || 0;

      fileLogsBatch.push({
        fileName: file.name,
        sourceLink: 'https://drive.google.com/file/d/' + file.id + '/view',
        destLink: copiedFile.webViewLink || 'https://drive.google.com/file/d/' + copiedFile.id + '/view',
        sourcePath: pathPrefix + file.name,
        createdDate: file.createdTime || getCurrentTimestamp(),
        modifiedDate: file.modifiedTime || getCurrentTimestamp(),
        fileSize: fileSize,
      });

      session.filesCount++;
      session.totalSizeSynced += fileSize;
    }

    // Recurse into subfolders
    var subFolders = listSubFolders(sourceFolderId);
    for (var j = 0; j < subFolders.length; j++) {
      if (isInterrupted) return;

      var subFolder = subFolders[j];
      var destSubFolder = findOrCreateFolder(subFolder.name, destFolderId);
      syncFolder(subFolder.id, destSubFolder.id, pathPrefix + subFolder.name + '/');
    }
  }

  // Execute sync
  syncFolder(project.sourceFolderId, project.destFolderId, '/');

  // Calculate duration
  session.executionDurationSeconds = Math.round((new Date().getTime() - startTime) / 1000);

  // Save session to Firestore ONLY when meaningful (has files, error, or interrupted)
  if (session.filesCount > 0 || session.status !== 'success') {
    saveSyncSession(session);
  }

  // Always save heartbeat to PropertiesService (free, no quota cost)
  saveProjectHeartbeat_(project.id, session.status);

  // Batch save file logs
  if (fileLogsBatch.length > 0) {
    batchSaveFileLogs(session.id, fileLogsBatch);
  }

  // Update project metadata
  project.lastSyncTimestamp = getCurrentTimestamp();
  project.lastSyncStatus = session.status;
  project.filesCount = (project.filesCount || 0) + session.filesCount;
  project.totalSize = (project.totalSize || 0) + session.totalSizeSynced; // Add total size
  project.updatedAt = getCurrentTimestamp();
  if (project.status === 'error' && session.status !== 'error') {
    project.status = 'active';
  }
  saveProject(project);

  Logger.log('Synced ' + session.filesCount + ' files for ' + project.name + ' in ' + session.executionDurationSeconds + 's [' + session.status + ']');

  return session;
}

/**
 * Create an error session record
 */
function createErrorSession_(project, runId, errorMsg) {
  var session = {
    id: generateId(),
    projectId: project.id,
    projectName: project.name,
    runId: runId,
    timestamp: getCurrentTimestamp(),
    executionDurationSeconds: 0,
    status: 'error',
    filesCount: 0,
    errorMessage: errorMsg,
  };
  saveSyncSession(session);
  return session;
}
