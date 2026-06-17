import type {
  Funnel,
  FunnelAnalysis,
  ChurnUser,
  BehaviorPath,
  Report,
  MonitorRule,
  MonitorAlert,
  MonitorCheckResult,
  EventInfo,
  AttributeDimension,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const funnelApi = {
  getAll: () => request<Funnel[]>('/funnels'),
  getById: (id: string) => request<Funnel>(`/funnels/${id}`),
  create: (data: { name: string; description: string; steps: { name: string; eventName: string }[] }) =>
    request<Funnel>('/funnels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name: string; description: string; steps: { name: string; eventName: string }[] }) =>
    request<Funnel>(`/funnels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<{ success: boolean }>(`/funnels/${id}`, { method: 'DELETE' }),
};

export const analysisApi = {
  analyze: (
    funnelId: string,
    params: {
      startDate?: string;
      endDate?: string;
      breakdown?: string;
      compareStart?: string;
      compareEnd?: string;
    } = {}
  ) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.breakdown) searchParams.append('breakdown', params.breakdown);
    if (params.compareStart) searchParams.append('compareStart', params.compareStart);
    if (params.compareEnd) searchParams.append('compareEnd', params.compareEnd);
    return request<FunnelAnalysis>(`/funnels/${funnelId}/analyze?${searchParams.toString()}`);
  },

  getChurnUsers: (
    funnelId: string,
    stepIndex: number,
    params: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.append('stepIndex', String(stepIndex));
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize));
    return request<{ users: ChurnUser[]; total: number }>(`/funnels/${funnelId}/churn?${searchParams.toString()}`);
  },

  getBehaviorPaths: (
    funnelId: string,
    stepIndex: number,
    params: { startDate?: string; endDate?: string } = {}
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.append('stepIndex', String(stepIndex));
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    return request<BehaviorPath>(`/funnels/${funnelId}/paths?${searchParams.toString()}`);
  },
};

export const metaApi = {
  getEvents: () => request<EventInfo[]>('/events'),
  getAttributes: () => request<AttributeDimension[]>('/user-attributes'),
};

export const reportApi = {
  getAll: () => request<Report[]>('/reports'),
  getById: (id: string) => request<Report>(`/reports/${id}`),
  create: (data: {
    title: string;
    funnelId: string;
    funnelName: string;
    description: string;
    analysisData: FunnelAnalysis;
  }) =>
    request<{ id: string; message: string }>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  share: (id: string) =>
    request<{ shareToken: string; shareUrl: string }>(`/reports/${id}/share`, {
      method: 'POST',
    }),
  delete: (id: string) => request<{ success: boolean }>(`/reports/${id}`, { method: 'DELETE' }),
};

export const monitorApi = {
  getAll: () => request<MonitorRule[]>('/monitors'),
  create: (data: Omit<MonitorRule, 'id' | 'createdAt' | 'enabled'>) =>
    request<MonitorRule>('/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<MonitorRule>) =>
    request<MonitorRule>(`/monitors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<{ success: boolean }>(`/monitors/${id}`, { method: 'DELETE' }),
  toggle: (id: string) =>
    request<{ enabled: boolean }>(`/monitors/${id}/toggle`, { method: 'POST' }),
  check: (id: string, forceEmail?: string[]) =>
    request<MonitorCheckResult>(`/monitors/${id}/check`, {
      method: 'POST',
      body: JSON.stringify({ forceEmail }),
    }),
  checkAll: () =>
    request<{ total: number; triggered: number; results: MonitorCheckResult[] }>('/monitors/check-all', {
      method: 'POST',
    }),
  getAlerts: (limit?: number) =>
    request<MonitorAlert[]>(`/monitors/alerts${limit ? `?limit=${limit}` : ''}`),
  getAlertsByMonitor: (monitorId: string, limit?: number) =>
    request<MonitorAlert[]>(`/monitors/${monitorId}/alerts${limit ? `?limit=${limit}` : ''}`),
  testEmail: (to: string) =>
    request<{ success: boolean; message: string }>('/monitors/test-email', {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
  testConnection: () =>
    request<{ success: boolean; message: string }>('/monitors/test-connection', {
      method: 'POST',
    }),
};
