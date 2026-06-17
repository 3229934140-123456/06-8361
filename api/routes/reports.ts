import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import type { Report } from '../types/index.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDatabase();
  
  const reports = db.prepare(`
    SELECT id, title, funnel_id, funnel_name, description, share_token, created_at, created_by
    FROM reports
    ORDER BY created_at DESC
  `).all() as Array<{
    id: string;
    title: string;
    funnel_id: string;
    funnel_name: string;
    description: string;
    share_token: string | null;
    created_at: string;
    created_by: string;
  }>;
  
  const result: Omit<Report, 'analysisData'>[] = reports.map(r => ({
    id: r.id,
    title: r.title,
    funnelId: r.funnel_id,
    funnelName: r.funnel_name,
    description: r.description,
    shareToken: r.share_token || undefined,
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));
  
  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const row = db.prepare(`
    SELECT id, title, funnel_id, funnel_name, description, analysis_data, share_token, created_at, created_by
    FROM reports
    WHERE id = ?
  `).get(id) as {
    id: string;
    title: string;
    funnel_id: string;
    funnel_name: string;
    description: string;
    analysis_data: string;
    share_token: string | null;
    created_at: string;
    created_by: string;
  } | undefined;
  
  if (!row) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const report: Report = {
    id: row.id,
    title: row.title,
    funnelId: row.funnel_id,
    funnelName: row.funnel_name,
    description: row.description,
    analysisData: JSON.parse(row.analysis_data),
    shareToken: row.share_token || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
  
  res.json(report);
});

router.post('/', (req: Request, res: Response) => {
  const { title, funnelId, funnelName, description, analysisData } = req.body;
  const db = getDatabase();
  
  if (!title || !funnelId || !analysisData) {
    return res.status(400).json({ error: 'Title, funnelId and analysisData are required' });
  }
  
  const reportId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO reports (id, title, funnel_id, funnel_name, description, analysis_data, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(reportId, title, funnelId, funnelName || '', description || '', JSON.stringify(analysisData), now, 'admin');
  
  res.status(201).json({ id: reportId, message: 'Report created successfully' });
});

router.post('/:id/share', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  const shareToken = uuidv4();
  
  db.prepare(`
    UPDATE reports SET share_token = ? WHERE id = ?
  `).run(shareToken, id);
  
  const shareUrl = `/reports/${id}?share=${shareToken}`;
  
  res.json({ shareToken, shareUrl });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const result = db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  res.json({ success: true });
});

export default router;
