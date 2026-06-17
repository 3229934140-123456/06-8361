export interface FunnelStep {
  id: string;
  name: string;
  eventName: string;
  orderIndex: number;
}

export interface Funnel {
  id: string;
  name: string;
  description: string;
  steps: FunnelStep[];
  createdAt: string;
  updatedAt: string;
}

export interface FunnelAnalysisStep {
  stepId: string;
  stepName: string;
  userCount: number;
  conversionRate: number;
  stepConversionRate: number;
  dropOffCount: number;
  dropOffRate: number;
}

export interface FunnelAnalysis {
  funnelId: string;
  funnelName: string;
  totalUsers: number;
  steps: FunnelAnalysisStep[];
  period: {
    start: string;
    end: string;
  };
  breakdown?: {
    dimension: string;
    groups: {
      groupName: string;
      steps: FunnelAnalysisStep[];
    }[];
  };
  compare?: {
    periodLabel: string;
    steps: FunnelAnalysisStep[];
  }[];
}

export interface ChurnUser {
  userId: string;
  lastAction: string;
  lastActionTime: string;
  userAttributes: Record<string, string>;
}

export interface PathNode {
  id: string;
  name: string;
  value: number;
}

export interface PathLink {
  source: string;
  target: string;
  value: number;
}

export interface BehaviorPath {
  nodes: PathNode[];
  links: PathLink[];
}

export interface Report {
  id: string;
  title: string;
  funnelId: string;
  funnelName: string;
  description: string;
  analysisData: FunnelAnalysis;
  shareToken?: string;
  createdAt: string;
  createdBy: string;
}

export interface MonitorRule {
  id: string;
  funnelId: string;
  funnelName: string;
  stepIndex: number;
  stepName: string;
  threshold: number;
  frequency: 'daily' | 'hourly';
  enabled: boolean;
  notifyEmails: string[];
  createdAt: string;
}

export interface MonitorAlert {
  id: string;
  monitorId: string;
  funnelId: string;
  funnelName: string;
  stepIndex: number;
  stepName: string;
  currentRate: number;
  previousRate: number;
  dropPercentage: number;
  threshold: number;
  triggeredAt: string;
  notifiedEmails: string[];
  status: 'pending' | 'sent' | 'failed';
  message?: string;
}

export interface EventInfo {
  name: string;
  count: number;
}

export interface AttributeDimension {
  name: string;
  values: string[];
}
