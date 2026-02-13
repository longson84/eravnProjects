/**
 * Sync Log Service
 * Handles retrieving and managing sync logs from Firestore.
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
    var db = FirestoreService.getFirestore();
    var collection = db.collection('sync_sessions');
    
    // 1. Base Query: Filter by date first (most efficient)
    var query = collection;
    if (filters.days && filters.days > 0) {
      var cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.days);
      query = query.where('timestamp', '>=', cutoffDate.toISOString());
    }
    
    // Note: Firestore limits composite queries. We'll do status/search filtering in memory
    // if complex index is not set up, or strictly here if possible.
    // For simplicity and safety with search, we fetch by date then filter.
    
    var documents = query.orderBy('timestamp', 'desc').limit(100).get(); // Limit 100 recent sessions
    var logs = [];

    if (documents) {
        documents.forEach(function(doc) {
        var data = doc.data();
        data.id = doc.id;
        
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
        
        // Flatten to Log Entry
        logs.push({
            sessionId: data.id,
            projectId: data.projectId,
            projectName: data.projectName,
            runId: data.runId,
            startTime: data.timestamp,
            endTime: data.timestamp, // In real app, might calculate from duration
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
    // In our current data model, file logs are likely in a sub-collection or separate collection
    // Assuming 'file_logs' collection linked by sessionId
    var db = FirestoreService.getFirestore();
    var logs = db.collection('file_logs')
      .where('sessionId', '==', sessionId)
      .limit(500) // Safety limit
      .get();
      
    var results = [];
    if (logs) {
        logs.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            results.push(data);
        });
    }
    return results;
  },

  /**
   * Retry a failed sync project
   */
  retrySyncProject: function(sessionId, projectId) {
    var db = FirestoreService.getFirestore();
    var sessionRef = db.collection('sync_sessions').doc(sessionId);
    var sessionDoc = sessionRef.get();
    
    if (!sessionDoc.exists) {
      throw new Error('Session not found');
    }
    
    var sessionData = sessionDoc.data();
    if (sessionData.retried) {
      return false; // Already retried
    }
    
    // Mark old session as retried
    sessionRef.update({ retried: true });
    
    // Trigger new sync
    // This calls the internal SyncService
    try {
      // Assuming SyncService.syncProjectInternal exists and accepts options
      var newRunId = 'retry-' + new Date().getTime();
      SyncService.syncProject(projectId, {
        triggeredBy: 'retry',
        retryOf: sessionId,
        runId: newRunId
      });
      return true;
    } catch (e) {
      console.error('Retry failed: ' + e);
      // Revert retried status if fail
      sessionRef.update({ retried: false });
      throw e;
    }
  }
};
