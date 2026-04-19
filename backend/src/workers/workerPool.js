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
    this.activeWorkers = new Map(); // taskId -> Worker
    this.running = false;
  }

  start() {
    this.running = true;
    logger.info({ msg: 'Worker pool started', maxWorkers: this.maxWorkers });
    this._scheduleLoop();
  }

  // Main scheduling loop — runs continuously
  _scheduleLoop() {
     console.log("SCHEDULER RUNNING");
    if (!this.running) return;
    this._tryDispatch();
    setTimeout(() => this._scheduleLoop(), 500);
  }

  _tryDispatch() {
    if (this.activeWorkers.size >= this.maxWorkers) return;

    const task = taskQueue.dequeue();
    if (!task) return;

    this._runTask(task);
  }

  _runTask(task) {
    const startedAt = new Date();
    let finished = false;
    const worker = new Worker(WORKER_SCRIPT, { workerData: { task } });
    this.activeWorkers.set(task.id, worker);

    // Mark task as running in DB
    query(
      `UPDATE tasks SET status='running', started_at=?, worker_id=?, progress=0 WHERE id=?`,
      [startedAt, `worker-${process.pid}-${Date.now()}`, task.id]
    ).catch((e) => logger.error({ msg: 'DB update failed', err: e.message }));

    sseManager.broadcast('task_update', {
      id: task.id,
      status: 'running',
      progress: 0,
    });

    worker.on('message', async (msg) => {
      try {
        if (msg.type === 'progress') {
          const [taskRow] = await query(`SELECT status FROM tasks WHERE id=?`, [task.id]);

          if (taskRow?.status !== 'running') return;
          sseManager.broadcast('task_update', {
            id: task.id,
            status: 'running',
            progress: msg.progress,
          });
        } else if (msg.type === 'completed') {
          const now = new Date();
          const execMs = now - startedAt;
          finished = true;
          await query(
            `UPDATE tasks SET status='completed', progress=100, completed_at=?, execution_time_ms=? WHERE id=?`,
            [now, execMs, task.id]
          );
          sseManager.broadcast('task_update', {
            id: task.id,
            status: 'completed',
            progress: 100,
          });
          this.activeWorkers.delete(task.id);
          logger.info({ msg: 'Task completed', taskId: task.id, execMs });
        }
      } catch (e) {
        logger.error({ msg: 'Message handler error', err: e.message });
      }
    });

    worker.on('error', async (err) => {
      logger.error({ msg: 'Worker error', taskId: task.id, err: err.message });
      this.activeWorkers.delete(task.id);
      await this._handleFailure(task, err.message);
    });

    worker.on('exit', async (code) => {
      if (!finished && code !== 0) {
        // Unexpected crash
        this.activeWorkers.delete(task.id);
        await this._handleFailure(task, `Worker exited with code ${code}`);
      }
    });
  }

  async _handleFailure(task, errorMessage) {
    const retryCount = (task.retry_count || 0) + 1;

    if (retryCount >= config.maxRetries) {
      // Move to dead letter queue
      await query(
        `UPDATE tasks SET status='dead_lettered', error_message=?, retry_count=? WHERE id=?`,
        [errorMessage, retryCount, task.id]
      );
      await query(
        `INSERT INTO dead_letter_queue (id, task_id, type, priority, payload, client_api_key, retry_count, last_error)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.type,
          task.priority,
          JSON.stringify(task.payload),
          task.client_api_key,
          retryCount,
          errorMessage,
        ]
      );
      sseManager.broadcast('task_update', {
        id: task.id,
        status: 'dead_lettered',
      });
      logger.warn({
        msg: 'Task dead-lettered',
        taskId: task.id,
        retryCount,
        errorMessage,
      });
    } else {
      // Re-queue for retry
      await query(
        `UPDATE tasks SET status='queued', retry_count=?, error_message=?, progress=0, started_at=NULL WHERE id=?`,
        [retryCount, errorMessage, task.id]
      );
      taskQueue.enqueue({ ...task, retry_count: retryCount });
      sseManager.broadcast('task_update', { id: task.id, status: 'queued', progress: 0 });
      logger.info({
        msg: 'Task requeued for retry',
        taskId: task.id,
        retryCount,
      });
    }
  }

  // Called when a cancel request comes in
  async cancelTask(taskId) {
    const worker = this.activeWorkers.get(taskId);
    if (worker) {
      await worker.terminate();
      this.activeWorkers.delete(taskId);
    } else {
      taskQueue.remove(taskId);
    }
    await query(
      `UPDATE tasks SET status='cancelled', completed_at=NOW() WHERE id=? AND status IN ('running','queued')`,
      [taskId]
    );
    sseManager.broadcast('task_update', { id: taskId, status: 'cancelled' });
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