import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { taskQueue } from '../queue/taskQueue.js';
import { workerPool } from '../workers/workerPool.js';
import { sseManager } from '../sse/sseManager.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { logger } from '../logger.js';

const router = Router();

// ── SSE endpoint ─────────────────────────────────────────────────────────────
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = uuidv4();
  sseManager.add(clientId, res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  // Heartbeat every 20s to keep connection alive
  const hb = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_) { }
  }, 20_000);

  req.on('close', () => {
    clearInterval(hb);
    sseManager.remove(clientId);
  });
});

// ── Submit task ───────────────────────────────────────────────────────────────
router.post('/', rateLimitMiddleware, async (req, res) => {
  try {
    const { type, priority, payload } = req.body;

    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!priority || priority < 1 || priority > 5) {
      return res.status(400).json({ error: 'priority must be 1-5' });
    }

    const id = uuidv4();
    const clientApiKey = req.clientApiKey;
    const now = new Date();

    await query(
      `INSERT INTO tasks (id, type, priority, payload, status, client_api_key, created_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
      [id, type, priority, JSON.stringify(payload || {}), clientApiKey, now]
    );

    const task = { id, type, priority, payload: payload || {}, client_api_key: clientApiKey, retry_count: 0 };
    taskQueue.enqueue(task);

    sseManager.broadcast('task_update', { id, status: 'queued', progress: 0 });
    logger.info({ msg: 'Task submitted', taskId: id, type, priority, clientApiKey });

    res.status(201).json({ id, status: 'queued' });
  } catch (e) {
    logger.error({ msg: 'Submit task error', err: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});



// ── Cancel task ───────────────────────────────────────────────────────────────
router.post('/:id/cancel', async (req, res) => {
  try {
    await workerPool.cancelTask(req.params.id);
    res.json({ success: true });
  } catch (e) {
    logger.error({ msg: 'Cancel task error', err: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Retry dead-lettered task ──────────────────────────────────────────────────
router.post('/:id/retry', async (req, res) => {
  try {
    const [task] = await query(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'dead_lettered') {
      return res.status(400).json({ error: 'Only dead-lettered tasks can be retried' });
    }

    await query(
      `UPDATE tasks SET status='queued', retry_count=0, progress=0, error_message=NULL, started_at=NULL, completed_at=NULL WHERE id=?`,
      [task.id]
    );

    taskQueue.enqueue({
      id: task.id,
      type: task.type,
      priority: task.priority,
      payload: task.payload,
      client_api_key: task.client_api_key,
      retry_count: 0,
    });

    sseManager.broadcast('task_update', { id: task.id, status: 'queued', progress: 0 });
    res.json({ success: true });
  } catch (e) {
    logger.error({ msg: 'Retry task error', err: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Inline seed endpoint ──────────────────────────────────────────────────────
router.post('/seed', async (req, res) => {
  const TASK_TYPES = ['image_processing', 'report_generation', 'data_import', 'email_batch', 'video_transcoding'];
  const API_KEYS = ['client-alpha-key-001', 'client-beta-key-002', 'client-gamma-key-003', 'client-delta-key-004'];
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  try {
    for (let i = 0; i < 60; i++) {
      const id = uuidv4();
      const type = TASK_TYPES[rand(0, TASK_TYPES.length - 1)];
      const priority = rand(1, 5);
      const apiKey = API_KEYS[rand(0, API_KEYS.length - 1)];
      const payload = JSON.stringify({ jobIndex: i, batchSize: rand(10, 500) });

      await query(
        `INSERT INTO tasks (id, type, priority, payload, status, client_api_key)
         VALUES (?, ?, ?, ?, 'queued', ?)`,
        [id, type, priority, payload, apiKey]
      );
      taskQueue.enqueue({ id, type, priority, payload: { jobIndex: i }, client_api_key: apiKey, retry_count: 0 });
    }
    sseManager.broadcast('task_update', { type: 'seed_complete' });
    logger.info({ msg: 'Seed complete', count: 60 });
    res.json({ message: 'Seeded 60 tasks successfully' });
  } catch (e) {
    logger.error({ msg: 'Seed error', err: e.message });
    res.status(500).json({ error: 'Seed failed' });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/summary', async (req, res) => {
  try {
    const avgByType = await query(
      `SELECT type, AVG(execution_time_ms) as avg_ms, COUNT(*) as count
       FROM tasks WHERE status='completed' GROUP BY type`
    );

    const throughput = await query(
      `SELECT DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i:00') as minute,
              COUNT(*) as completed
       FROM tasks
       WHERE status='completed' AND completed_at >= NOW() - INTERVAL 30 MINUTE
       GROUP BY minute ORDER BY minute ASC`
    );

    const failureRate = await query(
      `SELECT type,
              SUM(CASE WHEN status IN ('failed','dead_lettered') THEN 1 ELSE 0 END) as failures,
              COUNT(*) as total
       FROM tasks GROUP BY type`
    );

    const waitDist = await query(
      `SELECT
         CASE
           WHEN wait_time_ms < 5000 THEN '<5s'
           WHEN wait_time_ms < 15000 THEN '5-15s'
           WHEN wait_time_ms < 30000 THEN '15-30s'
           ELSE '>30s'
         END as bucket,
         COUNT(*) as count
       FROM tasks WHERE wait_time_ms IS NOT NULL GROUP BY bucket`
    );

    res.json({ avgByType, throughput, failureRate, waitDist });
  } catch (e) {
    logger.error({ msg: 'Analytics error', err: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get single task ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [task] = await query(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List / filter tasks ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      status,
      priority,
      type,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (priority) { conditions.push('priority = ?'); params.push(priority); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to) { conditions.push('created_at <= ?'); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const safeLimit = parseInt(limit) || 20;
const safeOffset = parseInt(offset) || 0;

const tasks = await query(
  `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
  params
);

    const countResult = await query(
      `SELECT COUNT(*) as total FROM tasks ${where}`,
      params
    );

    const total = countResult?.[0]?.total || 0;

    res.json({
      tasks: Array.isArray(tasks) ? tasks : [],
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (e) {
    logger.error({ msg: 'List tasks error', err: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;