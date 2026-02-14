/**
 * Sync Log Service
 * Handles retrieving and managing sync logs from Firestore via Repository.
 */

// Global exports for Frontend
function getSyncLogs(filters) {
  return SyncLogService.getSyncLogs(filters);
}

function getSyncLogDetails(sessionId, projectId) {
  return SyncLogService.getSyncLogDetails(sessionId, projectId);
}

function retrySync(sessionId, projectId) {
  return SyncLogService.retrySyncProject(sessionId, projectId);
}

var SyncLogService = {
  /**
   * Get sync logs with filters
   * @param {Object} filters { days: number, status?: string, search?: string }
   */
  getSyncLogs: function(filters) {
    var options = {
      limit: 100
    };

    // 1. Calculate Start Date
    if (filters.days && filters.days > 0) {
      var cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.days);
      options.startDate = cutoffDate;
    }
    
    // 2. Fetch from Repository
    // This uses the new getSyncSessions method in FirestoreRepository
    var sessions = getSyncSessions(options);
    var logs = [];

    // 3. Filter in memory (Status & Search) and Map to View Model
    if (sessions && sessions.length > 0) {
      sessions.forEach(function(data) {
        
        // Apply Status Filter
        if (filters.status && filters.status !== 'all' && data.status !== filters.status) {
            return;
        }
        
        // Apply Search Filter
        if (filters.search) {
            var term = filters.search.toLowerCase();
            var match = (data.projectName || '').toLowerCase().indexOf(term) > -1 || 
                        (data.runId || '').toLowerCase().indexOf(term) > -1;
            if (!match) return;
        }
        
        // Map to Log Entry
        logs.push({
            sessionId: data.id,
            projectId: data.projectId,
            projectName: data.projectName,
            runId: data.runId,
            startTime: data.timestamp,
            endTime: data.timestamp, 
            duration: data.executionDurationSeconds,
            status: data.status,
            filesCount: data.filesCount,
            failedCount: data.failedFilesCount || 0, // Added failed count
            totalSize: data.totalSizeSynced,
            error: data.errorMessage,
            retried: data.retried || false,
            retriedBy: data.retriedBy || null, // Added retriedBy ID
            retryOf: data.retryOf || null,
            triggeredBy: data.triggeredBy || 'manual'
        });
      });
    }
    
    return logs;
  },

  /**
   * Get detailed file logs for a session
   */
  getSyncLogDetails: function(sessionId, projectId) {
    // Calls Repository directly
    return getFileLogsBySession(sessionId);
  },

  /**
   * Retry a failed sync project
   */
  retrySyncProject: function(sessionId, projectId) {
    try {
      var session = getSyncSessionById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (session.retried) {
        return false; // Already retried
      }
      
      // NEW LOGIC: Fetch failed files from this session
      var failedFileIds = [];
      try {
        var fileLogs = getFileLogsBySession(sessionId);
        if (fileLogs && fileLogs.length > 0) {
           failedFileIds = fileLogs.filter(function(log) {
             return log.status === 'error';
           }).map(function(log) {
             // Extract File ID from sourceLink
             // Link format: https://drive.google.com/file/d/FILE_ID/view
             var match = log.sourceLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
             return match ? match[1] : null;
           }).filter(function(id) { return id !== null; });
        }
      } catch (err) {
        Logger.log('Error fetching failed files for retry: ' + err);
      }
      
      var syncOptions = {
         triggeredBy: 'retry',
         retryOf: sessionId
      };
      
      // If we found specific failed files, pass them to the sync service
      if (failedFileIds.length > 0) {
         syncOptions.retryFileIds = failedFileIds;
         Logger.log('Retrying ' + failedFileIds.length + ' specific failed files.');
      } else {
         Logger.log('No specific failed files found (or full retry needed). Running standard sync.');
      }

      var result;
      // Trigger new sync
      if (typeof syncProjectById === 'function') {
         result = syncProjectById(projectId, syncOptions);
      } else if (typeof SyncService !== 'undefined' && SyncService.syncProjectById) {
         result = SyncService.syncProjectById(projectId, syncOptions);
      } else {
         // Direct call fallback if in same scope
         try {
            result = syncProjectById(projectId, syncOptions);
         } catch (e) {
            throw new Error('SyncService not available: ' + e.message);
         }
      }
     
      // Mark old session as retried and link to new session
      var updateData = { retried: true };
      if (result && result.runId) {
          updateData.retriedBy = result.runId;
      }
      updateSyncSession(sessionId, updateData);

      return true;
    } catch (e) {
      Logger.log('Retry failed: ' + e);
      throw e;
    }
  }
};
