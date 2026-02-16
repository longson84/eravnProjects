// ==========================================
// eravnProject n - Sync Service (Core Logic Layer)
// ==========================================
// Time-Snapshot Sync algorithm with recursive scan and queue management

/**
 * Run sync for all active projects (queue-based)
 * Priority: 
 * 1. Interrupted/Error projects (newest first)
 * 2. Success/Warning projects (oldest first)
 */
function syncAllProjects() {
  var runId = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMdd-HHmmss');
  var settings = getSettingsFromCache_();
  
  // Respect auto schedule switch: only run when enabled
  if (settings && settings.enableAutoSchedule === false) {
    Logger.log('Auto schedule is disabled. Skipping syncAllProjects run.');
    return { success: false, runId: runId, sessionsCount: 0, message: 'Auto schedule disabled' };
  }

  var projects = ProjectService.getAllProjects();
  var results = [];

  // Filter active projects only
  var activeProjects = projects.filter(function(p) {
    return p.status === 'active' && !p.isDeleted;
  });

  // Sort Logic
  activeProjects.sort(function(a, b) {
    var aIsFailed = (a.lastSyncStatus === 'error' || a.lastSyncStatus === 'interrupted');
    var bIsFailed = (b.lastSyncStatus === 'error' || b.lastSyncStatus === 'interrupted');

    // Priority 1: Failed projects first
    if (aIsFailed && !bIsFailed) return -1;
    if (!aIsFailed && bIsFailed) return 1;

    // Priority 2: Oldest timestamp first
    // If timestamp is null (never synced), treat as very old (high priority)
    var timeA = a.lastSyncTimestamp ? new Date(a.lastSyncTimestamp).getTime() : 0;
    var timeB = b.lastSyncTimestamp ? new Date(b.lastSyncTimestamp).getTime() : 0;

    // Priority 2: Xử lý logic bên trong từng nhóm
    if (aIsFailed && bIsFailed) {
      // Nếu CẢ HAI đều lỗi: Ưu tiên ông GẦN NHẤT (Mới nhất - Newest first)
      return timeB - timeA; 
    } else {
      // Nếu CẢ HAI đều bình thường: Ưu tiên ông CŨ NHẤT (Oldest first)
      return timeA - timeB;
    }
  });

  for (var i = 0; i < activeProjects.length; i++) {
    var project = activeProjects[i];
    try {
      var result = syncSingleProject_(project, runId, settings, { triggeredBy: 'schedule' });
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

  var runId = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMdd-HHmmss');
  var settings = getSettingsFromCache_();
  var result = syncSingleProject_(project, runId, settings, options);

  if (settings.enableNotifications && settings.webhookUrl) {
    sendSyncSummary([result], runId);
  }

  return { 
    success: true, 
    runId: runId, 
    message: 'Synced ' + result.filesCount + ' files',
    stats: {
      filesCount: result.filesCount,
      totalSizeSynced: result.totalSizeSynced,
      failedCount: result.failedFilesCount || 0,
      status: result.status
    }
  };
}

/**
 * Core sync logic for a single project
 * Implements Time-Snapshot Sync with recursive folder scanning
 * Updated for new "Continue" logic and Cutoff handling
 */
function syncSingleProject_(project, runId, settings, options) {
  options = options || {};
  var startTime = new Date().getTime();
  var cutoffMs = (settings.syncCutoffSeconds || CONFIG.DEFAULT_CUTOFF_SECONDS) * 1000;
  var sessionTimestamp = getCurrentTimestamp();
  
  // Step 1: Base timestamp & last status từ metadata project (không query sessions)
  var syncStartTime = project.syncStartDate ? new Date(project.syncStartDate).getTime() : 0;
  var lastSyncTime = project.lastSyncTimestamp ? new Date(project.lastSyncTimestamp).getTime() : 0;
  var lastSyncStatus = project.lastSyncStatus || null;
  var baseTimestamp = Math.max(lastSyncTime, syncStartTime);

  var isContinueMode = false;
  var pendingSessions = [];
  var successFilesMap = {}; // Map<fileName, fileLog>
  var effectiveTimestamp = 0;
  
  // Determine Mode (Step 2.1 vs 2.2)
  if (lastSyncStatus === 'error' || lastSyncStatus === 'interrupted') {
      // Step 2.2: Continue Mode
      isContinueMode = true;
      pendingSessions = getPendingSyncSessions(project.id);
      
      if (pendingSessions.length > 0) {
          // Get success files from pending sessions
          // Iterate and fetch logs from all pending sessions to avoid re-syncing successful files
          for (var i = 0; i < pendingSessions.length; i++) {
              var sId = pendingSessions[i].id;
              var logs = getFileLogsBySession(sId);
              // LS: for within for loop may slowdown the process
              // However we assume there are not too many sync sessions to be continued
              for (var j = 0; j < logs.length; j++) {
                  if (logs[j].status === 'success') {
                      // We map by fileName. Assumption: fileName is unique in the folder structure context?
                      // Wait, processFiles uses recursive path. Map key should probably include path or just handle flat for now.
                      // The spec says "check if file is in list".
                      // Ideally we should key by 'sourcePath' or 'fileName' if flat.
                      // Let's use fileName for now as per current logic structure, but aware of collision risk in diff folders.
                      // Better: key by 'sourcePath' if available, or just fileName.
                      // successFilesMap[logs[j].fileName] = logs[j];
                      // This is the best one
                      successFilesMap[logs[j].sourcePath] = logs[j];
                  }
              }
          }
          
          // For Continue mode, we always start scanning from baseTimestamp
          effectiveTimestamp = baseTimestamp;
      } else {
          // Fallback if no pending found
          isContinueMode = false;
      }
  } 
  
  if (!isContinueMode) {
      // Step 2.1: Normal Mode
      effectiveTimestamp = baseTimestamp;
  }

  var sinceTimestamp = effectiveTimestamp > 0 ? new Date(effectiveTimestamp).toISOString() : '1970-01-01T00:00:00Z';

  var session = {
    id: generateId(),
    projectId: project.id,
    projectName: project.name,
    runId: runId,
    timestamp: sessionTimestamp,
    executionDurationSeconds: 0,
    status: 'success',
    current: 'success', 
    filesCount: 0,
    failedFilesCount: 0, 
    totalSizeSynced: 0, 
    triggeredBy: options.triggeredBy || 'manual',
    retryOf: null,
    continueId: null
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
      session.current = 'interrupted';
      session.errorMessage = 'Cutoff timeout: đã vượt quá ' + settings.syncCutoffSeconds + ' giây. Safe exit.';
      Logger.log('Cutoff reached for project: ' + project.name);
      return;
    }

    // List modified files in this folder
    var files = listModifiedFiles(sourceFolderId, sinceTimestamp);
    
    // Process files
    processFiles(files, destFolderId, pathPrefix);

    // Recurse into subfolders
    var subFolders = listSubFolders(sourceFolderId);
    for (var j = 0; j < subFolders.length; j++) {
      if (isInterrupted) return;

      var subFolder = subFolders[j];
      var destSubFolder = findOrCreateFolder(subFolder.name, destFolderId);
      syncFolder(subFolder.id, destSubFolder.id, pathPrefix + subFolder.name + '/');
    }
  }

  // Helper to process a batch of files
  function processFiles(files, destFolderId, pathPrefix) {
    for (var i = 0; i < files.length; i++) {
      if (isInterrupted) return;

      // Check cutoff after each file
      if (new Date().getTime() - startTime > cutoffMs) {
        isInterrupted = true;
        session.status = 'interrupted';
        session.current = 'interrupted';
        session.errorMessage = 'Cutoff timeout: đã vượt quá ' + settings.syncCutoffSeconds + ' giây. Safe exit.';
        return;
      }

      var file = files[i];
      var fileLogEntry = {
        fileName: file.name,
        sourceLink: 'https://drive.google.com/file/d/' + file.id + '/view',
        destLink: '',
        sourcePath: pathPrefix + file.name,
        createdDate: file.createdTime || getCurrentTimestamp(),
        modifiedDate: file.modifiedTime || getCurrentTimestamp(),
        fileSize: 0,
        status: 'success',
        errorMessage: ''
      };

      try {
        // Skip folders (handled recursively)
        if (file.mimeType === CONFIG.FOLDER_MIME_TYPE) continue;

        // Logic Check for Continue Mode
        var shouldCopy = true;
        // Check by sourcePath (full path from root of source folder)
        var currentSourcePath = pathPrefix + file.name;
        var prevSuccessLog = successFilesMap[currentSourcePath]; 

        if (isContinueMode && prevSuccessLog) {
            // File was synced successfully in a previous interrupted session
            var prevModTime = new Date(prevSuccessLog.modifiedDate).getTime();
            var currModTime = new Date(file.modifiedTime).getTime();
            
            if (currModTime <= prevModTime) {
                // File hasn't changed since last successful sync
                shouldCopy = false;
            }
        }

        if (!shouldCopy) continue;

        // Rename Logic: OriginalName_vYYMMDD_HHmm.ext
        var destFileName = file.name;
        // Always check existence to avoid overwrite and apply versioning
        var existingFiles = findFilesByName(file.name, destFolderId);
        if (existingFiles.length > 0) {
            var timestamp = formatTimestampForFilename(new Date()); // yyMMdd_HHmm
            var nameParts = file.name.lastIndexOf('.');
            if (nameParts !== -1) {
                var name = file.name.substring(0, nameParts);
                var ext = file.name.substring(nameParts);
                destFileName = name + '_v' + timestamp + ext;
            } else {
                destFileName = file.name + '_v' + timestamp;
            }
        }

        // Copy file
        var copiedFile = copyFileToDest(file.id, destFolderId, destFileName);
        var fileSize = Number(file.size) || 0;

        fileLogEntry.destLink = copiedFile.webViewLink || 'https://drive.google.com/file/d/' + copiedFile.id + '/view';
        fileLogEntry.fileSize = fileSize;
        
        session.filesCount++;
        session.totalSizeSynced += fileSize;

      } catch (e) {
        Logger.log('Error syncing file ' + file.name + ': ' + e.message);
        fileLogEntry.status = 'error';
        fileLogEntry.errorMessage = e.message;
        session.failedFilesCount++;
        
        if (e.message.indexOf('File not found') !== -1 || e.message.indexOf('404') !== -1) {
             fileLogEntry.status = 'skipped';
             fileLogEntry.errorMessage = 'Source file not found (deleted)';
        } else {
             session.status = 'warning'; 
             // If we have a warning, current status is still success unless it's a critical error?
             // Spec says "error (hoặc warning khi có lỗi nhẹ hơn)".
             // Let's keep status as 'success' (if just warning) or change to 'warning'.
             if (session.status === 'success') session.status = 'warning';
        }
      }
      
      fileLogsBatch.push(fileLogEntry);
    }
  }

  // EXECUTION
  try {
      syncFolder(project.sourceFolderId, project.destFolderId, '/');
  } catch (e) {
    Logger.log('Sync execution FAILED: ' + e.message);
    session.status = 'error';
    session.current = 'error';
    session.errorMessage = e.message;
  }

  // Calculate duration
  session.executionDurationSeconds = Math.round((new Date().getTime() - startTime) / 1000);

  // Save session
  if (session.filesCount > 0 || session.status !== 'success' || session.failedFilesCount > 0) {
    saveSyncSession(session);
  }

  saveProjectHeartbeat_(project.id, session.status);

  // Batch save logs
  if (fileLogsBatch.length > 0) {
    try {
      batchSaveFileLogs(session.id, fileLogsBatch);
    } catch (e) {
      Logger.log('FAILED to save file logs: ' + e.message);
    }
  }

  // Post-Processing for Continue Mode
  if (isContinueMode && pendingSessions.length > 0) {
      for (var i = 0; i < pendingSessions.length; i++) {
          var pSession = pendingSessions[i];
          var updates = { current: session.status };
          // Update continueId for the latest pending session (index 0)
          if (i === 0) {
              updates.continueId = session.runId;
          }
          try {
             updateSyncSession(pSession.id, updates);
          } catch(e) {
             Logger.log('Failed to update pending session ' + pSession.id);
          }
      }
  }

  // Update project metadata
  // Spec: lastSyncTimestamp is session.timestamp (Start Time)
  project.lastSyncTimestamp = session.timestamp; 
  project.lastSyncStatus = session.status;
  project.filesCount = (project.filesCount || 0) + session.filesCount;
  project.totalSize = (project.totalSize || 0) + session.totalSizeSynced;
  project.updatedAt = getCurrentTimestamp();
  
  if (project.status === 'error' && session.status !== 'error') {
    project.status = 'active';
  }
  
  try {
    ProjectService.updateProject(project);
  } catch (e) {
    Logger.log('Failed to update project metadata: ' + e.message);
  }

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
