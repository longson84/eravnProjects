export interface Project {
    id: string;
    name: string;
    description: string;
    sourceFolderId: string;
    sourceFolderLink: string;
    destFolderId: string;
    destFolderLink: string;
    status: 'active' | 'inactive' | 'error';
    lastSyncTimestamp: string | null;
    lastSyncStatus: 'success' | 'interrupted' | 'error' | null;
    filesCount: number;
    totalSize: number;
    createdAt: string;
    updatedAt: string;
}

export interface SyncSession {
    id: string;
    projectId: string;
    projectName: string;
    runId: string;
    timestamp: string;
    executionDurationSeconds: number;
    status: 'success' | 'error' | 'interrupted';
    filesCount: number;
    totalSizeSynced: number;
    errorMessage?: string;
}

export interface FileLog {
    id: string;
    sessionId: string;
    fileName: string;
    sourceLink: string;
    destLink: string;
    sourcePath: string;
    createdDate: string;
    modifiedDate: string;
    fileSize: number;
}

export interface AppSettings {
    syncCutoffSeconds: number;
    defaultScheduleCron: string;
    webhookUrl: string;
    firebaseProjectId: string;
    enableNotifications: boolean;
    maxRetries: number;
    batchSize: number;
}

export interface ProjectHeartbeat {
    projectId: string;
    lastCheckTimestamp: string;
    lastStatus: string;
}

export interface DashboardStats {
    totalProjects: number;
    activeProjects: number;
    filesSyncedToday: number;
    filesSyncedThisWeek: number;
    successRate: number;
    errorCount: number;
    avgDurationSeconds: number;
    totalSyncSessions: number;
}

export interface SyncChartData {
    date: string;
    filesCount: number;
    duration: number;
}

export interface StorageChartData {
    projectName: string;
    totalSize: number;
}

export interface ActivityEvent {
    id: string;
    type: 'sync_complete' | 'sync_error' | 'project_created' | 'project_updated' | 'settings_changed';
    message: string;
    timestamp: string;
    projectName?: string;
}

// This will define the structure for the bundled dashboard data
export interface DashboardData {
    projectSummary: {
        totalProjects: number;
        activeProjects: number;
    };
    syncProgress: {
        today: SyncProgressStats;
        last7Days: SyncProgressStats;
    };
    syncChart: SyncChartData[];
    recentSyncs: SyncSession[];
}

export interface SyncProgressStats {
    files: number;
    size: number;
    projects: number;
    duration: number;
    sessions: number;
}
