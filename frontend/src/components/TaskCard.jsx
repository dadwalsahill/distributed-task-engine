import { ProgressBar } from './ProgressBar.jsx';
import { taskApi } from '../api/taskApi.js';
import styles from './TaskCard.module.css';

const STATUS_COLOR = {
  queued: 'var(--text-muted)',
  running: 'var(--accent)',
  completed: 'var(--green)',
  failed: 'var(--red)',
  cancelled: 'var(--orange)',
  dead_lettered: 'var(--purple)',
};

const PRIORITY_LABEL = ['', '▁ Low', '▂', '▃ Mid', '▄', '▅ High'];

export function TaskCard({ task, onAction }) {
  const canCancel = task.status === 'queued' || task.status === 'running';
  const canRetry = task.status === 'dead_lettered';

  async function handleCancel() {
    await taskApi.cancel(task.id);
    onAction?.();
  }

  async function handleRetry() {
    await taskApi.retry(task.id);
    onAction?.();
  }

  const elapsed = task.execution_time_ms
    ? `${(task.execution_time_ms / 1000).toFixed(1)}s`
    : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.left}>
          <span className={styles.type}>{task.type}</span>
          <span className={styles.priority}>{PRIORITY_LABEL[task.priority] || task.priority}</span>
        </div>
        <div className={styles.right}>
          <span className={styles.status} style={{ color: STATUS_COLOR[task.status] }}>
            ● {task.status.replace('_', ' ')}
          </span>
          {elapsed && <span className={styles.meta}>{elapsed}</span>}
        </div>
      </div>

      {(task.status === 'running' || task.status === 'completed') && (
        <div className={styles.progress}>
          <ProgressBar progress={task.progress} status={task.status} />
          <span className={styles.progressLabel}>{task.progress}%</span>
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.meta} title={task.id}>
          {task.id?.slice(0, 8)}… · {task.client_api_key?.slice(0, 14)}
        </span>
        <div className={styles.actions}>
          {canCancel && (
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleCancel}>
              Cancel
            </button>
          )}
          {canRetry && (
            <button className={`${styles.btn} ${styles.btnAccent}`} onClick={handleRetry}>
              Retry
            </button>
          )}
        </div>
      </div>

      {task.error_message && (
        <div className={styles.error}>{task.error_message}</div>
      )}
    </div>
  );
}