import { create } from 'zustand';
import type { Funnel, FunnelAnalysis, Report, MonitorRule, EventInfo, AttributeDimension } from '../types';
import { funnelApi, analysisApi, metaApi, reportApi, monitorApi } from '../services/api';

interface AppState {
  funnels: Funnel[];
  currentFunnel: Funnel | null;
  funnelAnalysis: FunnelAnalysis | null;
  reports: Report[];
  monitors: MonitorRule[];
  events: EventInfo[];
  attributes: AttributeDimension[];
  loading: boolean;
  error: string | null;
  
  loadFunnels: () => Promise<void>;
  loadFunnelById: (id: string) => Promise<void>;
  createFunnel: (data: { name: string; description: string; steps: { name: string; eventName: string }[] }) => Promise<Funnel>;
  deleteFunnel: (id: string) => Promise<void>;
  
  loadAnalysis: (
    funnelId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      breakdown?: string;
      compareStart?: string;
      compareEnd?: string;
    }
  ) => Promise<void>;
  
  loadReports: () => Promise<void>;
  createReport: (data: {
    title: string;
    funnelId: string;
    funnelName: string;
    description: string;
    analysisData: FunnelAnalysis;
  }) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  
  loadMonitors: () => Promise<void>;
  createMonitor: (data: Omit<MonitorRule, 'id' | 'createdAt' | 'enabled'>) => Promise<void>;
  toggleMonitor: (id: string) => Promise<void>;
  deleteMonitor: (id: string) => Promise<void>;
  
  loadMeta: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  funnels: [],
  currentFunnel: null,
  funnelAnalysis: null,
  reports: [],
  monitors: [],
  events: [],
  attributes: [],
  loading: false,
  error: null,

  loadFunnels: async () => {
    set({ loading: true, error: null });
    try {
      const funnels = await funnelApi.getAll();
      set({ funnels, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadFunnelById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const funnel = await funnelApi.getById(id);
      set({ currentFunnel: funnel, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createFunnel: async (data) => {
    set({ loading: true, error: null });
    try {
      const newFunnel = await funnelApi.create(data);
      set((state) => ({ funnels: [newFunnel, ...state.funnels], loading: false }));
      return newFunnel;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteFunnel: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await funnelApi.delete(id);
      set((state) => ({
        funnels: state.funnels.filter((f) => f.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadAnalysis: async (funnelId, params) => {
    set({ loading: true, error: null });
    try {
      const analysis = await analysisApi.analyze(funnelId, params);
      set({ funnelAnalysis: analysis, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadReports: async () => {
    set({ loading: true, error: null });
    try {
      const reports = await reportApi.getAll();
      set({ reports, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createReport: async (data) => {
    set({ loading: true, error: null });
    try {
      await reportApi.create(data);
      await get().loadReports();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteReport: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await reportApi.delete(id);
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadMonitors: async () => {
    set({ loading: true, error: null });
    try {
      const monitors = await monitorApi.getAll();
      set({ monitors, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createMonitor: async (data) => {
    set({ loading: true, error: null });
    try {
      await monitorApi.create(data);
      await get().loadMonitors();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  toggleMonitor: async (id: string) => {
    try {
      const result = await monitorApi.toggle(id);
      set((state) => ({
        monitors: state.monitors.map((m) =>
          m.id === id ? { ...m, enabled: result.enabled } : m
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteMonitor: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await monitorApi.delete(id);
      set((state) => ({
        monitors: state.monitors.filter((m) => m.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadMeta: async () => {
    try {
      const [events, attributes] = await Promise.all([
        metaApi.getEvents(),
        metaApi.getAttributes(),
      ]);
      set({ events, attributes });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
