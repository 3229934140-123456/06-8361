import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { checkMonitorRule, getAlerts, checkAllMonitors } from '../services/monitorService.js';
import { testEmailConnection, sendMonitorAlertEmail } from '../services/emailService.js';
import type { MonitorRule, MonitorAlert } from '../types/index.js';

const router = Router();

function mapMonitorFromDb(row: {
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
}): MonitorRule {
  return {
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
}

router.get('/', (_req: Request, res: Response) => {
  const db = getDatabase();
  
  const rows = db.prepare(`
    SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
    FROM monitor_rules
    ORDER BY created_at DESC
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
  
  const rules: MonitorRule[] = rows.map(mapMonitorFromDb);
  res.json(rules);
});

router.post('/', (req: Request, res: Response) => {
  const { funnelId, funnelName, stepIndex, stepName, threshold, frequency, notifyEmails } = req.body;
  const db = getDatabase();
  
  if (!funnelId || stepIndex === undefined || threshold === undefined || !notifyEmails) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const ruleId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO monitor_rules (id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(ruleId, funnelId, funnelName || '', stepIndex, stepName || '', threshold, frequency || 'daily', JSON.stringify(notifyEmails), now);
  
  const newRule = db.prepare(`
    SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
    FROM monitor_rules
    WHERE id = ?
  `).get(ruleId) as {
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
  };
  
  res.status(201).json(mapMonitorFromDb(newRule));
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { threshold, frequency, enabled, notifyEmails } = req.body;
  const db = getDatabase();
  
  const existing = db.prepare('SELECT id FROM monitor_rules WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Monitor rule not found' });
  }
  
  const updates: string[] = [];
  const params: (string | number)[] = [];
  
  if (threshold !== undefined) {
    updates.push('threshold = ?');
    params.push(threshold);
  }
  if (frequency !== undefined) {
    updates.push('frequency = ?');
    params.push(frequency);
  }
  if (enabled !== undefined) {
    updates.push('enabled = ?');
    params.push(enabled ? 1 : 0);
  }
  if (notifyEmails !== undefined) {
    updates.push('notify_emails = ?');
    params.push(JSON.stringify(notifyEmails));
  }
  
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE monitor_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  
  const updated = db.prepare(`
    SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
    FROM monitor_rules
    WHERE id = ?
  `).get(id) as {
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
  };
  
  res.json(mapMonitorFromDb(updated));
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const result = db.prepare('DELETE FROM monitor_rules WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Monitor rule not found' });
  }
  
  res.json({ success: true });
});

router.post('/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const rule = db.prepare('SELECT enabled FROM monitor_rules WHERE id = ?').get(id) as { enabled: number } | undefined;
  if (!rule) {
    return res.status(404).json({ error: 'Monitor rule not found' });
  }
  
  const newEnabled = rule.enabled === 1 ? 0 : 1;
  db.prepare('UPDATE monitor_rules SET enabled = ? WHERE id = ?').run(newEnabled, id);
  
  res.json({ enabled: newEnabled === 1 });
});

router.post('/check-all', async (_req: Request, res: Response) => {
  try {
    const results = await checkAllMonitors();
    const triggeredCount = results.filter(r => r.triggered).length;
    res.json({
      total: results.length,
      triggered: triggeredCount,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { forceEmail } = req.body as { forceEmail?: string[] };
    const db = getDatabase();
    
    const row = db.prepare(`
      SELECT id, funnel_id, funnel_name, step_index, step_name, threshold, frequency, enabled, notify_emails, created_at
      FROM monitor_rules
      WHERE id = ?
    `).get(id) as {
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
    } | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Monitor rule not found' });
    }

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

    const result = await checkMonitorRule(rule, forceEmail);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/alerts', (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const alerts = getAlerts(undefined, parseInt(limit as string));
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/alerts', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query;
    const alerts = getAlerts(id, parseInt(limit as string));
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/test-email', async (req: Request, res: Response) => {
  try {
    const { to } = req.body as { to: string };
    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const result = await sendMonitorAlertEmail([to], {
      funnelName: '测试漏斗',
      stepName: '测试步骤',
      currentRate: 45.67,
      previousRate: 60.23,
      dropPercentage: 14.56,
      threshold: 10,
      triggeredAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/test-connection', async (_req: Request, res: Response) => {
  try {
    const result = await testEmailConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
