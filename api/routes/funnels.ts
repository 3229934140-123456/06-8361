import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import type { Funnel, FunnelStep } from '../types/index.js';

const router = Router();

function mapFunnelFromDb(row: { id: string; name: string; description: string; created_at: string; updated_at: string }): Omit<Funnel, 'steps'> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStepFromDb(row: { id: string; name: string; event_name: string; order_index: number }): FunnelStep {
  return {
    id: row.id,
    name: row.name,
    eventName: row.event_name,
    orderIndex: row.order_index,
  };
}

router.get('/', (_req: Request, res: Response) => {
  const db = getDatabase();
  
  const funnelRows = db.prepare(`
    SELECT id, name, description, created_at, updated_at 
    FROM funnels 
    ORDER BY created_at DESC
  `).all() as Array<{ id: string; name: string; description: string; created_at: string; updated_at: string }>;
  
  const stepRows = db.prepare(`
    SELECT id, funnel_id, name, event_name, order_index
    FROM funnel_steps
    ORDER BY order_index ASC
  `).all() as Array<{ id: string; funnel_id: string; name: string; event_name: string; order_index: number }>;
  
  const stepsByFunnel = new Map<string, FunnelStep[]>();
  for (const step of stepRows) {
    if (!stepsByFunnel.has(step.funnel_id)) {
      stepsByFunnel.set(step.funnel_id, []);
    }
    stepsByFunnel.get(step.funnel_id)!.push(mapStepFromDb(step));
  }
  
  const funnels: Funnel[] = funnelRows.map(funnel => ({
    ...mapFunnelFromDb(funnel),
    steps: stepsByFunnel.get(funnel.id) || [],
  }));
  
  res.json(funnels);
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const funnelRow = db.prepare(`
    SELECT id, name, description, created_at, updated_at 
    FROM funnels 
    WHERE id = ?
  `).get(id) as { id: string; name: string; description: string; created_at: string; updated_at: string } | undefined;
  
  if (!funnelRow) {
    return res.status(404).json({ error: 'Funnel not found' });
  }
  
  const stepRows = db.prepare(`
    SELECT id, funnel_id, name, event_name, order_index
    FROM funnel_steps
    WHERE funnel_id = ?
    ORDER BY order_index ASC
  `).all(id) as Array<{ id: string; funnel_id: string; name: string; event_name: string; order_index: number }>;
  
  const funnel: Funnel = {
    ...mapFunnelFromDb(funnelRow),
    steps: stepRows.map(mapStepFromDb),
  };
  
  res.json(funnel);
});

router.post('/', (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const db = getDatabase();
  
  if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Name and steps are required' });
  }
  
  const funnelId = uuidv4();
  const now = new Date().toISOString();
  
  const insertFunnel = db.prepare(`
    INSERT INTO funnels (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertStep = db.prepare(`
    INSERT INTO funnel_steps (id, funnel_id, name, event_name, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const tx = db.transaction(() => {
    insertFunnel.run(funnelId, name, description || '', now, now);
    
    steps.forEach((step: { name: string; eventName: string }, index: number) => {
      insertStep.run(uuidv4(), funnelId, step.name, step.eventName, index);
    });
  });
  
  tx();
  
  const newFunnel = db.prepare(`
    SELECT id, name, description, created_at, updated_at 
    FROM funnels 
    WHERE id = ?
  `).get(funnelId) as { id: string; name: string; description: string; created_at: string; updated_at: string };
  
  const newSteps = db.prepare(`
    SELECT id, name, event_name, order_index
    FROM funnel_steps
    WHERE funnel_id = ?
    ORDER BY order_index ASC
  `).all(funnelId) as Array<{ id: string; name: string; event_name: string; order_index: number }>;
  
  res.status(201).json({
    ...mapFunnelFromDb(newFunnel),
    steps: newSteps.map(mapStepFromDb),
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, steps } = req.body;
  const db = getDatabase();
  
  const existing = db.prepare('SELECT id FROM funnels WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Funnel not found' });
  }
  
  const now = new Date().toISOString();
  
  const updateFunnel = db.prepare(`
    UPDATE funnels 
    SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `);
  
  const deleteSteps = db.prepare('DELETE FROM funnel_steps WHERE funnel_id = ?');
  const insertStep = db.prepare(`
    INSERT INTO funnel_steps (id, funnel_id, name, event_name, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const tx = db.transaction(() => {
    updateFunnel.run(name, description || '', now, id);
    
    if (steps && Array.isArray(steps)) {
      deleteSteps.run(id);
      steps.forEach((step: { name: string; eventName: string }, index: number) => {
        insertStep.run(uuidv4(), id, step.name, step.eventName, index);
      });
    }
  });
  
  tx();
  
  const updatedFunnel = db.prepare(`
    SELECT id, name, description, created_at, updated_at 
    FROM funnels 
    WHERE id = ?
  `).get(id) as { id: string; name: string; description: string; created_at: string; updated_at: string };
  
  const updatedSteps = db.prepare(`
    SELECT id, name, event_name, order_index
    FROM funnel_steps
    WHERE funnel_id = ?
    ORDER BY order_index ASC
  `).all(id) as Array<{ id: string; name: string; event_name: string; order_index: number }>;
  
  res.json({
    ...mapFunnelFromDb(updatedFunnel),
    steps: updatedSteps.map(mapStepFromDb),
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  
  const result = db.prepare('DELETE FROM funnels WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Funnel not found' });
  }
  
  res.json({ success: true });
});

export default router;
