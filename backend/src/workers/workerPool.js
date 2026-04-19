import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config.js';
import { taskQueue } from '../queue/taskQueue.js';
import { query } from '../db.js';
import { sseManager } from '../sse/sseManager.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = join(__dirname, 'taskWorker.js');

class WorkerPool {
  constructor() {
    this.maxWorkers = config.workerCount;
    this.activeWorkers = new Map();
    this.running = false;
  }

  start() {
    this.running = true;
    logger.info({ msg: 'Worker pool started', maxWorkers: this.maxWorkers });
    this._scheduleLoop();
  }

  _scheduleLoop() {
    if (!this.running) return;
    this._tryDispatch();
    setTimeout(() => this._scheduleLoop(), 500);
  }

  _tryDispatch() {
    while (this.activeWorkers.size < this.maxWorkers) {
      const task = taskQueue.dequeue();
      if (!task) break;
      this._runTask(task);
    }
  }

  _runTask(task) {
    const startedAt = new Date();
    const taskId = task.id;

    const settled = { done: false };

    const worker = new Worker(WORKER_SCRIPT, { workerData: { task } });
    this.activeWorkers.set(taskId, worker);

    query(
      `UPDATE tasks SET status='running', started_at=?, worker_id=?, progress=0 WHERE id=?`,
      [startedAt, `worker-${process.pid}-${Date.now()}`, taskId]
    ).catch((e) => logger.error({ msg: 'DB update failed', err: e.message }));

    sseManager.broadcast('task_update', { id: taskId, status: 'running', progress: 0 });

    worker.on('message', async (msg) => {
      if (msg.type === 'progress') {
        if (settled.done) return;
        const [taskRow] = await query(`SELECT status FROM tasks WHERE id=?`, [taskId]);
        if (taskRow?.status !== 'running') return;
        await query(`UPDATE tasks SET progress=? WHERE id=?`, [msg.progress, taskId]);
        sseManager.broadcast('task_update', { id: taskId, status: 'running', progress: msg.progress });
      } else if (msg.type === 'completed') {
        if (settled.done) return;
        settled.done = true;
        this.activeWorkers.delete(taskId);
        const now = new Date();
        const execMs = now - startedAt;
        await query(
          `UPDATE tasks SET status='completed', progress=100, completed_at=?, execution_time_ms=?, error_message=NULL WHERE id=?`,
          [now, execMs, taskId]
        );
        sseManager.broadcast('task_update', { id: taskId, status: 'completed', progress: 100 });
        logger.info({ msg: 'Task completed', taskId, execMs });
      }
    });

    worker.on('error', async (err) => {
      if (settled.done) return;
      settled.done = true;
      this.activeWorkers.delete(taskId);
      logger.error({ msg: 'Worker error', taskId, err: err.message });
      await this._handleFailure(taskId, err.message);
    });

    worker.on('exit', async (code) => {
      if (settled.done) return;
      if (code === 0) { settled.done = true; return; }
      settled.done = true;
      this.activeWorkers.delete(taskId);
      await this._handleFailure(taskId, `Worker exited with code ${code}`);
    });
  }

  async _handleFailure(taskId, errorMessage) {
    const [taskRow] = await query(`SELECT * FROM tasks WHERE id=?`, [taskId]);
    if (!taskRow) return;

    const retryCount = (taskRow.retry_count || 0) + 1;

    if (retryCount >= config.maxRetries) {
      await query(
        `UPDATE tasks SET status='dead_lettered', error_message=?, retry_count=? WHERE id=?`,
        [errorMessage, retryCount, taskId]
      );

      const existing = await query(`SELECT id FROM dead_letter_queue WHERE task_id=?`, [taskId]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO dead_letter_queue (id, task_id, type, priority, payload, client_api_key, retry_count, last_error)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
          [taskId, taskRow.type, taskRow.priority, JSON.stringify(taskRow.payload), taskRow.client_api_key, retryCount, errorMessage]
        );
      } else {
        await query(
          `UPDATE dead_letter_queue SET retry_count=?, last_error=?, dead_lettered_at=NOW() WHERE task_id=?`,
          [retryCount, errorMessage, taskId]
        );
      }

      sseManager.broadcast('task_update', { id: taskId, status: 'dead_lettered' });
      logger.warn({ msg: 'Task dead-lettered', taskId, retryCount, errorMessage });
    } else {
      await query(
        `UPDATE tasks SET status='queued', retry_count=?, error_message=?, progress=0, started_at=NULL WHERE id=?`,
        [retryCount, errorMessage, taskId]
      );
      taskQueue.enqueue({
        id: taskRow.id,
        type: taskRow.type,
        priority: taskRow.priority,
        payload: taskRow.payload,
        client_api_key: taskRow.client_api_key,
        retry_count: retryCount,
      });
      sseManager.broadcast('task_update', { id: taskId, status: 'queued', progress: 0 });
      logger.info({ msg: 'Task requeued for retry', taskId, retryCount });
    }
  }

  async cancelTask(taskId) {
    const worker = this.activeWorkers.get(taskId);

    if (worker) {
      this.activeWorkers.delete(taskId);
      await worker.terminate();
      await this._handleFailure(taskId, 'Task cancelled by user');
    } else {
      taskQueue.remove(taskId);
      await query(
        `UPDATE tasks SET status='cancelled', completed_at=NOW() WHERE id=? AND status IN ('running','queued')`,
        [taskId]
      );
      sseManager.broadcast('task_update', { id: taskId, status: 'cancelled' });
    }
  }

  getStatus() {
    return {
      busy: this.activeWorkers.size,
      idle: Math.max(0, this.maxWorkers - this.activeWorkers.size),
      total: this.maxWorkers,
      queued: taskQueue.size(),
    };
  }
}

export const workerPool = new WorkerPool();