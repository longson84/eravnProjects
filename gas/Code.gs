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
  return getAllProjects();
}

function getProject(projectId) {
  return getProjectById(projectId);
}

function createProject(projectData) {
  // Validate required fields
  if (!projectData.name) throw new Error('Tên dự án là bắt buộc');
  if (!projectData.sourceFolderId && !projectData.sourceFolderLink) {
    throw new Error('Source folder là bắt buộc');
  }
  if (!projectData.destFolderId && !projectData.destFolderLink) {
    throw new Error('Destination folder là bắt buộc');
  }

  // Extract folder IDs from links if needed
  if (projectData.sourceFolderLink && !projectData.sourceFolderId) {
    projectData.sourceFolderId = extractFolderIdFromLink(projectData.sourceFolderLink);
  }
  if (projectData.destFolderLink && !projectData.destFolderId) {
    projectData.destFolderId = extractFolderIdFromLink(projectData.destFolderLink);
  }

  return createProjectInDb(projectData);
}

function updateProject(projectData) {
  if (!projectData.id) throw new Error('Project ID là bắt buộc');
  projectData.updatedAt = getCurrentTimestamp();
  return saveProject(projectData);
}

function deleteProject(projectId) {
  return deleteProjectFromDb(projectId);
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
