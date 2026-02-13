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
    lastSyncStatus: 'success' | 'interrupted' | 'error' | 'pending' | null;
    filesCount: number;
    totalSize: number; // Total size of all files synced for this project
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
    totalSizeSynced: number; // Size of files synced in this session
    errorMessage?: string;
    retryOf?: string;        // ID of the original session if this is a retry
    retried?: boolean;       // Whether this session has been retried
}

/** Flattened log entry for UI display (Project-centric) */
export interface SyncLogEntry {
    sessionId: string;
    projectId: string;
    projectName: string;
    runId: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: 'success' | 'interrupted' | 'error';
    filesCount: number;
    totalSize: number;
    error?: string;
    retried?: boolean;
    retryOf?: string;
    triggeredBy?: 'manual' | 'scheduled' | 'retry' | 'webhook';
}

/** Filter criteria for fetching sync logs */
export interface SyncLogFilters {
    days: number;
    status: string;
    search: string;
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

// ==========================================
// Dashboard Specific Types
// ==========================================

/** Statistics for a specific period (e.g., today, last 7 days) */
export interface SyncProgressStats {
    files: number;
    size: number;
    duration: number;
    sessions: number;
}

/** Chart data point for sync performance over time */
export interface SyncChartData {
    date: string;
    filesCount: number;
    duration: number;
}

/** The main data structure for the entire dashboard */
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
