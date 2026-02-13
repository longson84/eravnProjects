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
            totalSize: data.totalSizeSynced,
            error: data.errorMessage,
            retried: data.retried || false,
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
      
      // Mark old session as retried
      updateSyncSession(sessionId, { retried: true });
      
      // Trigger new sync
      // Using SyncService.syncProjectById as identified in the codebase
      if (typeof SyncService !== 'undefined' && SyncService.syncProjectById) {
         SyncService.syncProjectById(projectId);
      } else {
         throw new Error('SyncService not available for retry');
      }
     
      return true;
    } catch (e) {
      Logger.log('Retry failed: ' + e);
      // Revert retried status if fail
      try {
        updateSyncSession(sessionId, { retried: false });
      } catch (err) {
        Logger.log('Failed to revert session status: ' + err);
      }
      throw e;
    }
  }
};
