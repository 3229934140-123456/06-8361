import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import type { FunnelAnalysis, FunnelAnalysisStep, ChurnUser, BehaviorPath, PathNode, PathLink } from '../types/index.js';

const router = Router();

function getDefaultPeriod(req: Request): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function parseDateRange(req: Request): { start: Date; end: Date } {
  const { startDate, endDate } = req.query;
  if (startDate && endDate) {
    return {
      start: new Date(startDate as string),
      end: new Date(endDate as string),
    };
  }
  return getDefaultPeriod(req);
}

function getFunnelSteps(db: ReturnType<typeof getDatabase>, funnelId: string) {
  return db.prepare(`
    SELECT id, name, event_name, order_index
    FROM funnel_steps
    WHERE funnel_id = ?
    ORDER BY order_index ASC
  `).all(funnelId) as Array<{ id: string; name: string; event_name: string; order_index: number }>;
}

export function calculateFunnelAnalysis(
  db: ReturnType<typeof getDatabase>,
  funnelId: string,
  start: Date,
  end: Date,
  filterColumn?: string,
  filterValue?: string
): FunnelAnalysisStep[] {
  const steps = getFunnelSteps(db, funnelId);
  if (steps.length === 0) return [];

  const filterClause = filterColumn && filterValue
    ? `AND user_id IN (SELECT user_id FROM user_attributes WHERE ${filterColumn} = ?)`
    : '';

  const firstEvent = steps[0].event_name;
  let userQuery = `
    SELECT DISTINCT user_id
    FROM event_logs
    WHERE event_name = ?
    AND event_time BETWEEN ? AND ?
    ${filterClause}
  `;

  const params: (string | number)[] = [firstEvent, start.toISOString(), end.toISOString()];
  if (filterColumn && filterValue) {
    params.push(filterValue);
  }

  const initialUsers = db.prepare(userQuery).all(...params) as Array<{ user_id: string }>;
  const userIds = new Set(initialUsers.map(u => u.user_id));
  const totalUsers = userIds.size;

  const result: FunnelAnalysisStep[] = [];
  let prevCount = totalUsers;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const eventName = step.event_name;

    const stepQuery = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM event_logs
      WHERE event_name = ?
      AND event_time BETWEEN ? AND ?
      AND user_id IN (${Array.from(userIds).map(() => '?').join(',')})
    `;

    const stepParams = [eventName, start.toISOString(), end.toISOString(), ...Array.from(userIds)];
    const { count } = db.prepare(stepQuery).get(...stepParams) as { count: number };

    const dropOffCount = prevCount - count;
    const dropOffRate = prevCount > 0 ? (dropOffCount / prevCount) * 100 : 0;
    const conversionRate = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
    const stepConversionRate = prevCount > 0 ? (count / prevCount) * 100 : 100;

    result.push({
      stepId: step.id,
      stepName: step.name,
      userCount: count,
      conversionRate: Math.round(conversionRate * 100) / 100,
      stepConversionRate: Math.round(stepConversionRate * 100) / 100,
      dropOffCount,
      dropOffRate: Math.round(dropOffRate * 100) / 100,
    });

    const userIdsQuery = `
      SELECT DISTINCT user_id
      FROM event_logs
      WHERE event_name = ?
      AND event_time BETWEEN ? AND ?
      AND user_id IN (${Array.from(userIds).map(() => '?').join(',')})
    `;
    const remainingUsers = db.prepare(userIdsQuery).all(eventName, start.toISOString(), end.toISOString(), ...Array.from(userIds)) as Array<{ user_id: string }>;
    userIds.clear();
    remainingUsers.forEach(u => userIds.add(u.user_id));

    prevCount = count;
  }

  return result;
}

router.get('/funnels/:id/analyze', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const { start, end } = parseDateRange(req);
  const { breakdown, compareStart, compareEnd } = req.query;

  const funnel = db.prepare('SELECT id, name FROM funnels WHERE id = ?').get(id) as { id: string; name: string } | undefined;
  if (!funnel) {
    return res.status(404).json({ error: 'Funnel not found' });
  }

  const steps = calculateFunnelAnalysis(db, id, start, end);
  const totalUsers = steps.length > 0 ? steps[0].userCount : 0;

  const analysis: FunnelAnalysis = {
    funnelId: funnel.id,
    funnelName: funnel.name,
    totalUsers,
    steps,
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };

  if (breakdown) {
    const dimension = breakdown as string;
    const values = db.prepare(`
      SELECT DISTINCT ${dimension} as value
      FROM user_attributes
      ORDER BY value
    `).all() as Array<{ value: string }>;

    const groups = values.map(v => ({
      groupName: v.value,
      steps: calculateFunnelAnalysis(db, id, start, end, dimension, v.value),
    })).filter(g => g.steps.length > 0 && g.steps[0].userCount > 0);

    analysis.breakdown = {
      dimension,
      groups,
    };
  }

  if (compareStart && compareEnd) {
    const compareSteps = calculateFunnelAnalysis(db, id, new Date(compareStart as string), new Date(compareEnd as string));
    analysis.compare = [
      {
        periodLabel: '对比周期',
        steps: compareSteps,
      },
    ];
  }

  res.json(analysis);
});

router.get('/funnels/:id/churn', (req: Request, res: Response) => {
  const { id } = req.params;
  const { stepIndex, page = '1', pageSize = '20' } = req.query;
  const db = getDatabase();
  const { start, end } = parseDateRange(req);

  const steps = getFunnelSteps(db, id);
  if (steps.length === 0) {
    return res.json({ users: [], total: 0 });
  }

  const idx = parseInt(stepIndex as string) || 1;
  if (idx < 1 || idx >= steps.length) {
    return res.status(400).json({ error: 'Invalid step index' });
  }

  const prevStep = steps[idx - 1];
  const currStep = steps[idx];

  const prevUsers = db.prepare(`
    SELECT DISTINCT user_id
    FROM event_logs
    WHERE event_name = ?
    AND event_time BETWEEN ? AND ?
  `).all(prevStep.event_name, start.toISOString(), end.toISOString()) as Array<{ user_id: string }>;

  const currUsers = new Set(
    (db.prepare(`
      SELECT DISTINCT user_id
      FROM event_logs
      WHERE event_name = ?
      AND event_time BETWEEN ? AND ?
    `).all(currStep.event_name, start.toISOString(), end.toISOString()) as Array<{ user_id: string }>).map(u => u.user_id)
  );

  const churnUserIds = prevUsers.filter(u => !currUsers.has(u.user_id)).map(u => u.user_id);
  const total = churnUserIds.length;

  const pageNum = parseInt(page as string);
  const pageSizeNum = parseInt(pageSize as string);
  const startIdx = (pageNum - 1) * pageSizeNum;
  const paginatedIds = churnUserIds.slice(startIdx, startIdx + pageSizeNum);

  const users: ChurnUser[] = [];
  for (const userId of paginatedIds) {
    const lastEvent = db.prepare(`
      SELECT event_name, event_time
      FROM event_logs
      WHERE user_id = ?
      AND event_time BETWEEN ? AND ?
      ORDER BY event_time DESC
      LIMIT 1
    `).get(userId, start.toISOString(), end.toISOString()) as { event_name: string; event_time: string } | undefined;

    const attributes = db.prepare(`
      SELECT channel, city, register_date, user_level
      FROM user_attributes
      WHERE user_id = ?
    `).get(userId) as { channel: string; city: string; register_date: string; user_level: string } | undefined;

    users.push({
      userId,
      lastAction: lastEvent?.event_name || '-',
      lastActionTime: lastEvent?.event_time || '-',
      userAttributes: attributes
        ? {
            channel: attributes.channel,
            city: attributes.city,
            registerDate: attributes.register_date,
            userLevel: attributes.user_level,
          }
        : {},
    });
  }

  res.json({ users, total });
});

router.get('/funnels/:id/paths', (req: Request, res: Response) => {
  const { id } = req.params;
  const { stepIndex } = req.query;
  const db = getDatabase();
  const { start, end } = parseDateRange(req);

  const steps = getFunnelSteps(db, id);
  const idx = parseInt(stepIndex as string) || 1;
  if (idx < 1 || idx >= steps.length) {
    return res.status(400).json({ error: 'Invalid step index' });
  }

  const prevStep = steps[idx - 1];
  const currStep = steps[idx];

  const prevUsers = db.prepare(`
    SELECT DISTINCT user_id
    FROM event_logs
    WHERE event_name = ?
    AND event_time BETWEEN ? AND ?
  `).all(prevStep.event_name, start.toISOString(), end.toISOString()) as Array<{ user_id: string }>;

  const currUsers = new Set(
    (db.prepare(`
      SELECT DISTINCT user_id
      FROM event_logs
      WHERE event_name = ?
      AND event_time BETWEEN ? AND ?
    `).all(currStep.event_name, start.toISOString(), end.toISOString()) as Array<{ user_id: string }>).map(u => u.user_id)
  );

  const churnUserIds = prevUsers.filter(u => !currUsers.has(u.user_id)).map(u => u.user_id);

  const pathMap = new Map<string, Map<string, number>>();
  const nodeMap = new Map<string, number>();

  for (const userId of churnUserIds.slice(0, 200)) {
    const userEvents = db.prepare(`
      SELECT event_name, event_time
      FROM event_logs
      WHERE user_id = ?
      AND event_time BETWEEN ? AND ?
      ORDER BY event_time ASC
    `).all(userId, start.toISOString(), end.toISOString()) as Array<{ event_name: string; event_time: string }>;

    const stepIdx = userEvents.findIndex(e => e.event_name === prevStep.event_name);
    if (stepIdx === -1) continue;

    const beforeEvents = userEvents.slice(Math.max(0, stepIdx - 5), stepIdx + 1);
    
    for (let i = 0; i < beforeEvents.length - 1; i++) {
      const source = beforeEvents[i].event_name;
      const target = beforeEvents[i + 1].event_name;
      
      nodeMap.set(source, (nodeMap.get(source) || 0) + 1);
      nodeMap.set(target, (nodeMap.get(target) || 0) + 1);
      
      const key = `${source}->${target}`;
      if (!pathMap.has(source)) {
        pathMap.set(source, new Map());
      }
      const targetMap = pathMap.get(source)!;
      targetMap.set(target, (targetMap.get(target) || 0) + 1);
    }
  }

  const nodes: PathNode[] = Array.from(nodeMap.entries()).map(([name, value]) => ({
    id: name,
    name,
    value,
  }));

  const links: PathLink[] = [];
  for (const [source, targets] of pathMap) {
    for (const [target, value] of targets) {
      links.push({ source, target, value });
    }
  }

  const behaviorPath: BehaviorPath = { nodes, links };
  res.json(behaviorPath);
});

export default router;
