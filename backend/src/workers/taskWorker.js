// This file runs inside a worker thread.
// It receives a task via workerData and posts progress updates back.
import { workerData, parentPort } from 'worker_threads';

const { task } = workerData;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // Random duration 5-30 seconds
  const durationMs = (5 + Math.random() * 25) * 1000;
  const intervalMs = 2000; // progress update every 2s
  const steps = Math.ceil(durationMs / intervalMs);
  let elapsed = 0;

  parentPort.postMessage({ type: 'started', taskId: task.id });

  for (let i = 0; i < steps; i++) {
    await sleep(intervalMs);
    elapsed += intervalMs;
    const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));

    parentPort.postMessage({ type: 'progress', taskId: task.id, progress });

    if (progress >= 100) break;
  }

  parentPort.postMessage({ type: 'completed', taskId: task.id });
}

run().catch((err) => {
  parentPort.postMessage({ type: 'failed', taskId: task.id, error: err.message });
});