// ==========================================
// GAS Service - google.script.run Wrapper
// ==========================================
// Wraps google.script.run calls in Promises.
// Falls back to mock data in local development.

import type { Project, SyncSession, FileLog, AppSettings, ProjectHeartbeat } from '@/types/types';
import {
    mockProjects,
    mockSyncSessions,
    mockFileLogs,
    mockSettings,
} from '@/data/mockData';

/** Check if running inside GAS environment */
const isGasEnvironment = (): boolean => {
    return typeof (window as any).google !== 'undefined' &&
        typeof (window as any).google.script !== 'undefined';
};

/** Generic GAS runner that wraps google.script.run in a Promise */
function gasRun<T>(functionName: string, ...args: any[]): Promise<T> {
    if (!isGasEnvironment()) {
        console.warn(`[DEV] GAS not available. Using mock for: ${functionName}`);
        return getMockResponse<T>(functionName, ...args);
    }

    return new Promise((resolve, reject) => {
        (window as any).google.script.run
            .withSuccessHandler((result: T) => resolve(result))
            .withFailureHandler((error: Error) => reject(error))
        [functionName](...args);
    });
}

/** Mock response handler for local development */
async function getMockResponse<T>(functionName: string, ...args: any[]): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    const handlers: Record<string, () => any> = {
        getProjects: () => mockProjects,
        getProject: () => mockProjects.find(p => p.id === args[0]) || null,
        createProject: () => ({ ...args[0], id: `proj-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        updateProject: () => ({ ...args[0], updatedAt: new Date().toISOString() }),
        deleteProject: () => ({ success: true }),
        runSyncAll: () => ({ success: true, message: 'Sync all started' }),
        runSyncProject: () => ({ success: true, message: `Sync started for project ${args[0]}` }),
        getSettings: () => mockSettings,
        updateSettings: () => ({ ...mockSettings, ...args[0] }),
        getSyncSessions: () => mockSyncSessions,
        getSessionsByProject: () => mockSyncSessions.filter(s => s.projectId === args[0]),
        getFileLogs: () => mockFileLogs.filter(f => f.sessionId === args[0]),
        getProjectHeartbeats: () => mockProjects.map(p => ({
            projectId: p.id,
            lastCheckTimestamp: new Date().toISOString(),
            lastStatus: p.lastSyncStatus || 'success',
        })),
    };

    const handler = handlers[functionName];
    if (handler) {
        return handler() as T;
    }

    console.error(`[DEV] No mock handler for: ${functionName}`);
    throw new Error(`Unknown function: ${functionName}`);
}

// ==========================================
// Exported API Functions
// ==========================================

export const gasService = {
    // Projects
    getProjects: () => gasRun<Project[]>('getProjects'),
    getProject: (id: string) => gasRun<Project | null>('getProject', id),
    createProject: (project: Partial<Project>) => gasRun<Project>('createProject', project),
    updateProject: (project: Partial<Project>) => gasRun<Project>('updateProject', project),
    deleteProject: (id: string) => gasRun<{ success: boolean }>('deleteProject', id),

    // Sync
    runSyncAll: () => gasRun<{ success: boolean; message: string }>('runSyncAll'),
    runSyncProject: (projectId: string) => gasRun<{ success: boolean; message: string }>('runSyncProject', projectId),

    // Settings
    getSettings: () => gasRun<AppSettings>('getSettings'),
    updateSettings: (settings: Partial<AppSettings>) => gasRun<AppSettings>('updateSettings', settings),

    // Logs
    getSyncSessions: (limit?: number) => gasRun<SyncSession[]>('getSyncSessions', limit),
    getSessionsByProject: (projectId: string) => gasRun<SyncSession[]>('getSessionsByProject', projectId),
    getFileLogs: (sessionId: string) => gasRun<FileLog[]>('getFileLogs', sessionId),

    // Heartbeat
    getProjectHeartbeats: () => gasRun<ProjectHeartbeat[]>('getProjectHeartbeats'),
};
