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
  var projects = ProjectService.getAllProjects();
  var settings = getSettingsFromCache_();
  var results = [];

  // Sort by last sync timestamp ASC (null = never synced = highest priority)
  projects.sort(function(a, b) {
    if (!a.lastSyncTimestamp) return -1;
    if (!b.lastSyncTimestamp) return 1;
    return new Date(a.lastSyncTimestamp).getTime() - new Date(b.lastSyncTimestamp).getTime();
  });

  // Filter active projects only
  var activeProjects = projects.filter(function(p) {
    return p.status === 'active' && !p.isDeleted;
  });

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
      ProjectService.updateProject(project);
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
function syncProjectById(projectId, options) {
  var project = ProjectService.getProjectById(projectId);
  if (!project) throw new Error('Project not found: ' + projectId);

  var runId = 'run-' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  var settings = getSettingsFromCache_();
  var result = syncSingleProject_(project, runId, settings, options);

  if (settings.enableNotifications && settings.webhookUrl) {
    sendSyncSummary([result], runId);
  }

  return { success: true, runId: runId, message: 'Synced ' + result.filesCount + ' files' };
}

/**
 * Core sync logic for a single project
 * Implements Time-Snapshot Sync with recursive folder scanning
 */
function syncSingleProject_(project, runId, settings, options) {
  options = options || {};
  var startTime = new Date().getTime();
  var cutoffMs = (settings.syncCutoffSeconds || CONFIG.DEFAULT_CUTOFF_SECONDS) * 1000;
  
  // Calculate effective sync start time (MAX of lastSync and syncStartDate)
  var lastSyncTime = project.lastSyncTimestamp ? new Date(project.lastSyncTimestamp).getTime() : 0;
  var syncStartTime = project.syncStartDate ? new Date(project.syncStartDate).getTime() : 0;
  var effectiveTime = Math.max(lastSyncTime, syncStartTime);
  
  var sinceTimestamp = effectiveTime > 0 ? new Date(effectiveTime).toISOString() : '1970-01-01T00:00:00Z';

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
    triggeredBy: options.triggeredBy || 'manual',
    retryOf: options.retryOf || null
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

      // Check for existing files with same name in destination to prevent duplicates
      var existingFiles = findFilesByName(file.name, destFolderId);
      var destFileName = file.name;

      if (existingFiles.length > 0) {
        // Sort existing by modifiedTime desc (newest first)
        existingFiles.sort(function(a, b) {
          return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
        });

        var latestExisting = existingFiles[0];
        var sourceTime = new Date(file.modifiedTime).getTime();
        var destTime = new Date(latestExisting.modifiedTime).getTime();

        // Strategy: Versioning with Timestamp Suffix
        // If source is strictly newer than destination, we copy the new file BUT rename it.
        // We do NOT delete the old file.
        // Format: OriginalName_vYYMMDDHHmm.ext
        
        if (sourceTime > destTime) {
          // Append timestamp to filename
          var timestamp = formatTimestampForFilename(new Date());
          var nameParts = file.name.lastIndexOf('.');
          
          if (nameParts !== -1) {
             var name = file.name.substring(0, nameParts);
             var ext = file.name.substring(nameParts);
             destFileName = name + '_v' + timestamp + ext;
          } else {
             destFileName = file.name + '_v' + timestamp;
          }
          
          Logger.log('Newer version detected. Saving as: ' + destFileName);
        } else {
          // Source is older or same age -> Skip
          continue;
        }
      }

      // Copy file
      var copiedFile = copyFileToDest(file.id, destFolderId, destFileName);
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
    Logger.log('Saving ' + fileLogsBatch.length + ' file logs for session ' + session.id);
    try {
      batchSaveFileLogs(session.id, fileLogsBatch);
      Logger.log('File logs saved successfully.');
    } catch (e) {
      Logger.log('FAILED to save file logs: ' + e.message);
    }
  } else {
    Logger.log('No files synced, skipping log save.');
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
  
  try {
    Logger.log('Updating project metadata: ' + project.name + ' Status: ' + project.lastSyncStatus + ' Time: ' + project.lastSyncTimestamp);
    ProjectService.updateProject(project);
  } catch (e) {
    Logger.log('Failed to update project metadata for ' + project.name + ': ' + e.message);
    // Don't throw, let the function return the session result
  }

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
