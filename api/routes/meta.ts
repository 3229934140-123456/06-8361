import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import type { EventInfo, AttributeDimension } from '../types/index.js';

const router = Router();

router.get('/events', (_req: Request, res: Response) => {
  const db = getDatabase();
  
  const events = db.prepare(`
    SELECT event_name as name, COUNT(*) as count
    FROM event_logs
    GROUP BY event_name
    ORDER BY count DESC
  `).all() as EventInfo[];
  
  res.json(events);
});

router.get('/user-attributes', (_req: Request, res: Response) => {
  const db = getDatabase();
  
  const dimensions: AttributeDimension[] = [];
  
  const channelValues = db.prepare(`
    SELECT DISTINCT channel as value
    FROM user_attributes
    ORDER BY value
  `).all() as Array<{ value: string }>;
  
  dimensions.push({
    name: 'channel',
    values: channelValues.map(v => v.value),
  });
  
  const cityValues = db.prepare(`
    SELECT DISTINCT city as value
    FROM user_attributes
    ORDER BY value
  `).all() as Array<{ value: string }>;
  
  dimensions.push({
    name: 'city',
    values: cityValues.map(v => v.value),
  });
  
  const levelValues = db.prepare(`
    SELECT DISTINCT user_level as value
    FROM user_attributes
    ORDER BY value
  `).all() as Array<{ value: string }>;
  
  dimensions.push({
    name: 'user_level',
    values: levelValues.map(v => v.value),
  });
  
  res.json(dimensions);
});

export default router;
