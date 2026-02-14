// ==========================================
// eravnProjects - API/Controller Layer
// ==========================================
// Entry point and public functions for google.script.run

/**
 * Web App entry point - serves the React UI
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('eravnProjects - Sync Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==========================================
// Project API
// ==========================================

function getProjects() {
  var projects = ProjectService.getAllProjects();
  var stats = ProjectService.getProjectStatsMap();
  
  return projects.map(function(p) {
    if (stats[p.id]) {
      p.stats = stats[p.id];
    } else {
      p.stats = { todayFiles: 0, last7DaysFiles: 0 };
    }
    return p;
  });
}

function getProject(projectId) {
  return ProjectService.getProjectById(projectId);
}

function createProject(projectData) {
  return ProjectService.createProject(projectData);
}

function updateProject(projectData) {
  return ProjectService.updateProject(projectData);
}

function deleteProject(projectId) {
  return ProjectService.deleteProject(projectId);
}

// ==========================================
// Sync API
// ==========================================

function runSyncAll() {
  return syncAllProjects();
}

function runSyncProject(projectId) {
  return syncProjectById(projectId);
}

// ==========================================
// Settings API
// ==========================================

function getSettings() {
  return getSettingsFromDb();
}

function updateSettings(settingsData) {
  return saveSettingsToDb(settingsData);
}

// ==========================================
// Logs API
// ==========================================

function getSyncSessions(limit) {
  return getRecentSyncSessions(limit);
}

function getSessionsByProject(projectId) {
  return getSyncSessionsByProject(projectId);
}

function getFileLogs(sessionId) {
  return getFileLogsBySession(sessionId);
}

// ==========================================
// Heartbeat API
// ==========================================

function getProjectHeartbeats() {
  return getAllProjectHeartbeats();
}

// ==========================================
// System API
// ==========================================

function resetDatabase() {
  return resetDatabase_();
}
