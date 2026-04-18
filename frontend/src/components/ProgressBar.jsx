import styles from './ProgressBar.module.css';

export function ProgressBar({ progress = 0, status }) {
  const colorClass =
    status === 'completed' ? styles.green :
    status === 'failed' || status === 'dead_lettered' ? styles.red :
    styles.blue;

  return (
    <div className={styles.track}>
      <div
        className={`${styles.fill} ${colorClass}`}
        style={{ width: `${Math.min(100, progress)}%` }}
      />
    </div>
  );
}