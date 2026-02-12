// ==========================================
// App Context - Global State Management
// ==========================================

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, AppAction, AppSettings, Project } from '@/types/types';
import { gasService } from '@/services/gasService';
// we are not using mock data anymore
// import { mockSettings } from '@/data/mockData'; 

const initialState: AppState = {
    projects: [],
    // settings: mockSettings,
    // change this in order to not use mock data
    settings: {
        syncCutoffSeconds: 300,
        defaultScheduleCron: '0 */6 * * *',
        webhookUrl: '',
        firebaseProjectId: '',
        enableNotifications: false,
        maxRetries: 3,
        batchSize: 450,
    },
    isLoading: true,
    error: null,
    theme: (typeof window !== 'undefined' && localStorage.getItem('theme') as AppState['theme']) || 'dark',
};

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_PROJECTS':
            return { ...state, projects: action.payload };
        case 'ADD_PROJECT':
            return { ...state, projects: [...state.projects, action.payload] };
        case 'UPDATE_PROJECT':
            return {
                ...state,
                projects: state.projects.map(p =>
                    p.id === action.payload.id ? action.payload : p
                ),
            };
        case 'DELETE_PROJECT':
            return {
                ...state,
                projects: state.projects.filter(p => p.id !== action.payload),
            };
        case 'SET_SETTINGS':
            return { ...state, settings: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'SET_THEME':
            return { ...state, theme: action.payload };
        default:
            return state;
    }
}

interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    loadProjects: () => Promise<void>;
    loadSettings: () => Promise<void>;
    createProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Apply theme
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (state.theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(state.theme);
        }

        localStorage.setItem('theme', state.theme);
    }, [state.theme]);

    const loadProjects = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const projects = await gasService.getProjects();
            dispatch({ type: 'SET_PROJECTS', payload: projects });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    const loadSettings = async () => {
        try {
            const settings = await gasService.getSettings();
            dispatch({ type: 'SET_SETTINGS', payload: settings });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
        }
    };

    const createProject = async (project: Partial<Project>) => {
        try {
            const newProject = await gasService.createProject(project);
            dispatch({ type: 'ADD_PROJECT', payload: newProject });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
            throw error;
        }
    };

    const updateProject = async (project: Partial<Project>) => {
        try {
            const updated = await gasService.updateProject(project);
            dispatch({ type: 'UPDATE_PROJECT', payload: updated });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
            throw error;
        }
    };

    const deleteProject = async (id: string) => {
        try {
            await gasService.deleteProject(id);
            dispatch({ type: 'DELETE_PROJECT', payload: id });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
            throw error;
        }
    };

    const updateSettings = async (settings: Partial<AppSettings>) => {
        try {
            const updated = await gasService.updateSettings(settings);
            dispatch({ type: 'SET_SETTINGS', payload: updated });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
            throw error;
        }
    };

    const setTheme = (theme: 'light' | 'dark' | 'system') => {
        dispatch({ type: 'SET_THEME', payload: theme });
    };

    // Load initial data
    useEffect(() => {
        loadProjects();
        loadSettings();
    }, []);

    return (
        <AppContext.Provider value={{
            state,
            dispatch,
            loadProjects,
            loadSettings,
            createProject,
            updateProject,
            deleteProject,
            updateSettings,
            setTheme,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}
