import cron from 'node-cron';
import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { calculateFunnelAnalysis } from '../routes/analysis.js';
import { sendMonitorAlertEmail } from './emailService.js';
import type { MonitorRule, MonitorAlert } from '../types/index.js';

interface MonitorCheckResult {
  alertId?: string;
  triggered: boolean;
  dropPercentage: number;
  threshold: number;
  currentRate: number;
  previousRate: number;
  emailResult?: { success: boolean; message: string };
  message: string;
}

function getPreviousPeriodDates(frequency: 'daily' | 'hourly'): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date;
  let previousStart: Date;
  let previousEnd: Date;

  if (frequency === 'hourly') {
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    currentStart = new Date(currentEnd.getTime() - 60 * 60 * 1000);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(previousEnd.getTime() - 60 * 60 * 1000 + 1);
  } else {
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    currentStart = new Date(currentEnd.getTime() - 24 * 60 * 60 * 1000 + 1);
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(previousEnd.getTime() - 24 * 60 * 60 * 1000 + 1);
  }

  return { start: currentStart, end: currentEnd, prevStart: previousStart, prevEnd: previousEnd };
}

function getLastAlertRate(monitorId: string): number | null {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT current_rate
    FROM monitor_alerts
    WHERE monitor_id = ?
    ORDER BY triggered_at DESC
    LIMIT 1
  `).get(monitorId) as { current_rate: number } | undefined;
  
  return result ? result.current_rate : null;
}

export async function checkMonitorRule(rule: MonitorRule, forceEmail?: string[]): Promise<MonitorCheckResult> {
  const db = getDatabase();

  const { start, end, prevStart, prevEnd } = getPreviousPeriodDates(rule.frequency);
  
  const currentSteps = calculateFunnelAnalysis(db, rule.funnelId, start, end);
  const previousSteps = calculateFunnelAnalysis(db, rule.funnelId, prevStart, prevEnd);

  const currentStep = currentSteps[rule.stepIndex];
  const previousStep = previousSteps[rule.stepIndex];

  if (!currentStep || !previousStep) {
    return {
      triggered: false,
      dropPercentage: 0,
      threshold: rule.threshold,
      currentRate: currentStep?.stepConversionRate || 0,
      previousRate: previousStep?.stepConversionRate || 0,
      message: '数据不足，无法计算转化率',
    };
  }

  let previousRate = previousStep.stepConversionRate;
  const lastAlertRate = getLastAlertRate(rule.id);
  if (lastAlertRate !== null) {
    previousRate = lastAlertRate;
  }

  const currentRate = currentStep.stepConversionRate;
  const dropPercentage = previousRate - currentRate;
  const triggered = dropPercentage >= rule.threshold;

  const alertId = uuidv4();
  const now = new Date().toISOString();
  const notifyEmails = forceEmail || rule.notifyEmails;

  let emailResult;
  let status: MonitorAlert['status'] = 'pending';
  let message = '';

  if (triggered || forceEmail) {
    try {
      emailResult = await sendMonitorAlertEmail(notifyEmails, {
        funnelName: rule.funnelName,
        stepName: rule.stepName,
        currentRate,
        previousRate,
        dropPercentage,
        threshold: rule.threshold,
        triggeredAt: now,
      });
      status = emailResult.success ? 'sent' : 'failed';
      message = emailResult.message;
    } catch (err) {
      status = 'failed';
      message = (err as Error).message;
      emailResult = { success: false, message };
    }
  }

  if (triggered) {
    db.prepare(`
      INSERT INTO monitor_alerts (
        id, monitor_id, funnel_id, funnel_name, step_index, step_name,
        current_rate, previous_rate, drop_percentage, threshold,
        triggered_at, notified_emails, status, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alertId,
      rule.id,
      rule.funnelId,
      rule.funnelName,
      rule.stepIndex,
      rule.stepName,
      currentRate,
      previousRate,
      dropPercentage,
      rule.threshold,
      now,
      JSON.stringify(notifyEmails),
      status,
      message
    );

    return {
      alertId,
      triggered: true,
      dropPercentage,
      threshold: rule.threshold,
      currentRate,
      previousRate,
      emailResult,
      message: `转化率下降 ${dropPercentage.toFixed(2)}%，超过阈值 ${rule.threshold}%`,
    };
  }

  return {
    triggered: false,
    dropPercentage,
    threshold: rule.threshold,
    currentRate,
    previousRate,
    message: `转化率下降 ${dropPercentage.toFixed(2)}%，在阈值范围内`,
  };
}

export async function checkAllMonitors(): Promise<MonitorCheckResult[]> {
  const db = getDatabase();
  
  const rules = db.prepare(`
    SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
    FROM monitor_rules
    WHERE enabled = 1
  `).all() as Array<{
    id: string;
    funnel_id: string;
    funnel_name: string;
    step_index: number;
    step_name: string;
    threshold: number;
    frequency: string;
    enabled: number;
    notify_emails: string;
    created_at: string;
  }>;

  const results: MonitorCheckResult[] = [];
  
  for (const row of rules) {
    const rule: MonitorRule = {
      id: row.id,
      funnelId: row.funnel_id,
      funnelName: row.funnel_name,
      stepIndex: row.step_index,
      stepName: row.step_name,
      threshold: row.threshold,
      frequency: row.frequency as 'daily' | 'hourly',
      enabled: row.enabled === 1,
      notifyEmails: JSON.parse(row.notify_emails),
      createdAt: row.created_at,
    };

    try {
      const result = await checkMonitorRule(rule);
      results.push(result);
    } catch (error) {
      console.error(`Error checking monitor ${rule.id}:`, error);
      results.push({
        triggered: false,
        dropPercentage: 0,
        threshold: rule.threshold,
        currentRate: 0,
        previousRate: 0,
        message: `检测失败: ${(error as Error).message}`,
      });
    }
  }

  return results;
}

export function getAlerts(monitorId?: string, limit: number = 50): MonitorAlert[] {
  const db = getDatabase();
  
  let query = `
    SELECT id, monitor_id, funnel_id, funnel_name, step_index, step_name,
           current_rate, previous_rate, drop_percentage, threshold,
           triggered_at, notified_emails, status, message
    FROM monitor_alerts
  `;
  
  const params: (string | number)[] = [];
  
  if (monitorId) {
    query += ' WHERE monitor_id = ?';
    params.push(monitorId);
  }
  
  query += ' ORDER BY triggered_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    monitor_id: string;
    funnel_id: string;
    funnel_name: string;
    step_index: number;
    step_name: string;
    current_rate: number;
    previous_rate: number;
    drop_percentage: number;
    threshold: number;
    triggered_at: string;
    notified_emails: string;
    status: string;
    message: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    monitorId: row.monitor_id,
    funnelId: row.funnel_id,
    funnelName: row.funnel_name,
    stepIndex: row.step_index,
    stepName: row.step_name,
    currentRate: row.current_rate,
    previousRate: row.previous_rate,
    dropPercentage: row.drop_percentage,
    threshold: row.threshold,
    triggeredAt: row.triggered_at,
    notifiedEmails: JSON.parse(row.notified_emails),
    status: row.status as MonitorAlert['status'],
    message: row.message || undefined,
  }));
}

let dailyTask: ReturnType<typeof cron.schedule> | null = null;
let hourlyTask: ReturnType<typeof cron.schedule> | null = null;

export function startMonitorScheduler() {
  if (dailyTask) dailyTask.stop();
  if (hourlyTask) hourlyTask.stop();

  dailyTask = cron.schedule('0 0 9 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running daily monitor check...`);
    const results = await checkAllMonitors();
    const triggered = results.filter(r => r.triggered);
    console.log(`Daily check complete: ${results.length} monitors checked, ${triggered.length} alerts triggered`);
  }, {
    timezone: 'Asia/Shanghai',
  });

  hourlyTask = cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running hourly monitor check...`);
    const db = getDatabase();
    const hourlyRules = db.prepare(`
      SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
      FROM monitor_rules
      WHERE enabled = 1 AND frequency = 'hourly'
    `).all() as Array<any>;

    for (const row of hourlyRules) {
      const rule: MonitorRule = {
        id: row.id,
        funnelId: row.funnel_id,
        funnelName: row.funnel_name,
        stepIndex: row.step_index,
        stepName: row.step_name,
        threshold: row.threshold,
        frequency: row.frequency as 'daily' | 'hourly',
        enabled: row.enabled === 1,
        notifyEmails: JSON.parse(row.notify_emails),
        createdAt: row.created_at,
      };

      try {
        await checkMonitorRule(rule);
      } catch (error) {
        console.error(`Error in hourly check for monitor ${rule.id}:`, error);
      }
    }
    console.log('Hourly check complete');
  }, {
    timezone: 'Asia/Shanghai',
  });

  console.log('Monitor scheduler started');
  console.log('  - Daily check: 09:00 Asia/Shanghai');
  console.log('  - Hourly check: Every hour for hourly frequency rules');
}

export function stopMonitorScheduler() {
  if (dailyTask) {
    dailyTask.stop();
    dailyTask = null;
  }
  if (hourlyTask) {
    hourlyTask.stop();
    hourlyTask = null;
  }
  console.log('Monitor scheduler stopped');
}
