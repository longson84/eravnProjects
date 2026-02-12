// ==========================================
// eravnProjects - Type Definitions
// ==========================================

/** Project configuration for a sync pair */
export interface Project {
    id: string;
    name: string;
    description: string;
    sourceFolderId: string;
    sourceFolderLink: string;
    destFolderId: string;
    destFolderLink: string;
    status: 'active' | 'paused' | 'error';
    lastSyncTimestamp: string | null;
    lastSyncStatus: 'success' | 'interrupted' | 'error' | null;
    filesCount: number;
    createdAt: string;
    updatedAt: string;
}

/** Sync session log (parent record) */
export interface SyncSession {
    id: string;
    projectId: string;
    projectName: string;
    runId: string;
    timestamp: string;
    executionDurationSeconds: number;
    status: 'success' | 'interrupted' | 'error';
    filesCount: number;
    errorMessage?: string;
}

/** Heartbeat status from PropertiesService (quota-free health check) */
export interface ProjectHeartbeat {
    projectId: string;
    lastCheckTimestamp: string;
    lastStatus: string;
}

/** File sync log (child of SyncSession) */
export interface FileLog {
    id: string;
    sessionId: string;
    fileName: string;
    sourceLink: string;
    destLink: string;
    sourcePath: string;
    createdDate: string;
    modifiedDate: string;
    fileSize?: number;
}

/** Global app settings */
export interface AppSettings {
    syncCutoffSeconds: number;
    defaultScheduleCron: string;
    webhookUrl: string;
    firebaseProjectId: string;
    enableNotifications: boolean;
    maxRetries: number;
    batchSize: number;
}

/** Dashboard statistics */
export interface DashboardStats {
    totalProjects: number;
    activeProjects: number;
    filesSyncedToday: number;
    filesSyncedThisWeek: number;
    totalSyncSessions: number;
    successRate: number;
    avgDurationSeconds: number;
    errorCount: number;
}

/** Chart data point for sync performance */
export interface SyncChartData {
    date: string;
    filesCount: number;
    duration: number;
    errors: number;
}

/** Chart data point for project storage */
export interface StorageChartData {
    projectName: string;
    filesCount: number;
    totalSize: number;
}

/** Recent activity event */
export interface ActivityEvent {
    id: string;
    type: 'sync_complete' | 'sync_error' | 'project_created' | 'project_updated' | 'settings_changed';
    message: string;
    timestamp: string;
    projectName?: string;
    details?: string;
}

/** App-level state */
export interface AppState {
    projects: Project[];
    settings: AppSettings;
    isLoading: boolean;
    error: string | null;
    theme: 'light' | 'dark' | 'system';
}

/** App-level actions */
export type AppAction =
    | { type: 'SET_PROJECTS'; payload: Project[] }
    | { type: 'ADD_PROJECT'; payload: Project }
    | { type: 'UPDATE_PROJECT'; payload: Project }
    | { type: 'DELETE_PROJECT'; payload: string }
    | { type: 'SET_SETTINGS'; payload: AppSettings }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' };
