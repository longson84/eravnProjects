// ==========================================
// Project Service - Business Logic Layer
// ==========================================
// Handles business rules, validation, and orchestrates data operations for Projects.

var ProjectService = {
  
  /**
   * Get all active (not deleted) projects
   */
  getAllProjects: function() {
    var all = getAllProjects();
    // Filter out soft-deleted projects
    return all.filter(function(p) { return !p.isDeleted; });
  },

  /**
   * Get a project by ID
   */
  getProjectById: function(id) {
    if (!id) throw new Error('Project ID is required');
    var p = getProjectById(id);
    if (p && p.isDeleted) return null; // Treat deleted project as not found
    return p;
  },

  /**
   * Create a new project with validation and default values
   */
  createProject: function(projectData) {
    // 1. Validation
    if (!projectData.name) throw new Error('Tên dự án là bắt buộc');
    
    if (!projectData.sourceFolderId && !projectData.sourceFolderLink) {
      throw new Error('Source folder là bắt buộc');
    }
    
    if (!projectData.destFolderId && !projectData.destFolderLink) {
      throw new Error('Destination folder là bắt buộc');
    }

    // 2. Data Processing / Business Logic
    // Extract folder IDs from links if needed
    if (projectData.sourceFolderLink && !projectData.sourceFolderId) {
      projectData.sourceFolderId = extractFolderIdFromLink(projectData.sourceFolderLink);
    }
    if (projectData.destFolderLink && !projectData.destFolderId) {
      projectData.destFolderId = extractFolderIdFromLink(projectData.destFolderLink);
    }

    // 3. Set Default Values (Business Rules)
    var newProject = {
      id: generateId(), // Generate ID here or let repo do it, but explicit is better in Service
      name: projectData.name,
      description: projectData.description || '',
      sourceFolderId: projectData.sourceFolderId,
      sourceFolderLink: projectData.sourceFolderLink,
      destFolderId: projectData.destFolderId,
      destFolderLink: projectData.destFolderLink,
      syncStartDate: projectData.syncStartDate || null,
      
      // Initial State
      status: 'active',
      filesCount: 0,
      totalSize: 0,
      lastSyncTimestamp: null,
      lastSyncStatus: null,
      
      // Timestamps
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    // 4. Persist
    return saveProject(newProject);
  },

  /**
   * Update an existing project
   */
  updateProject: function(projectData) {
    if (!projectData.id) throw new Error('Project ID là bắt buộc');

    // Get existing project to ensure it exists and merge if necessary
    // For now, we trust the input but ensure updatedAt is refreshed
    
    // Logic: You might want to prevent updating certain fields like ID or createdAt
    projectData.updatedAt = getCurrentTimestamp();
    
    // In a stricter system, we might fetch -> merge -> save.
    // Here we pass through to Repo for PATCH behavior, assuming Repo handles merge or overwrite.
    // Based on existing Repo logic: it sends a PATCH to Firestore.
    
    return saveProject(projectData);
  },

  /**
   * Delete a project
   */
  deleteProject: function(id) {
    if (!id) throw new Error('Project ID là bắt buộc');
    return deleteProject(id);
  }
};

/**
 * Helper to extract ID from Drive Link (moved from Code.gs or kept as util)
 * Assuming this logic was inline or in Utils.gs. If it was inline in Code.gs, we define it here or use Utils.
 * Checking codebase, it seems to be used in Code.gs. We should ensure it's available.
 */
function extractFolderIdFromLink(link) {
  // Simple regex extraction - logic copied/moved from Code.gs
  try {
    var match = link.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  } catch (e) {
    return null;
  }
}
