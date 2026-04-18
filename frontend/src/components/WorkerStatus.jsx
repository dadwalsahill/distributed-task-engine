import styles from './WorkerStatus.module.css';

export function WorkerStatus({ status }) {
  if (!status) return null;
  const { busy, idle, total, queued } = status;

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Worker Pool</h3>
      <div className={styles.grid}>
        <Stat label="Busy" value={busy} color="var(--yellow)" />
        <Stat label="Idle" value={idle} color="var(--green)" />
        <Stat label="Total" value={total} color="var(--accent)" />
        <Stat label="Queued" value={queued} color="var(--purple)" />
      </div>
      <div className={styles.barWrap}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`${styles.workerSlot} ${i < busy ? styles.busySlot : styles.idleSlot}`}
            title={i < busy ? 'Busy' : 'Idle'}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} style={{ color }}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}