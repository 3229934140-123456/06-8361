import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import type { MonitorRule } from '../types/index.js';

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

export default router;
