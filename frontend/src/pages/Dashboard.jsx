import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../api/taskApi.js';
import { useSSE } from '../hooks/useSSE.js';
import { TaskCard } from '../components/TaskCard.jsx';
import { WorkerStatus } from '../components/WorkerStatus.jsx';
import styles from './Dashboard.module.css';


const STATUSES = ['running', 'queued', 'completed', 'failed', 'dead_lettered', 'cancelled'];

const STATUS_LABELS = {
    running: '▶ Running',
    queued: '⏳ Queued',
    completed: '✓ Completed',
    failed: '✗ Failed',
    dead_lettered: '☠ Dead Letter',
    cancelled: '⊘ Cancelled',
};

export default function Dashboard() {
    const [tasks, setTasks] = useState([]);
    const [workerStatus, setWorkerStatus] = useState(null);
    const [filter, setFilter] = useState({ status: '', type: '', priority: '' });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 50;

    const fetchTasks = useCallback(async () => {
        try {
            const params = { page, limit: LIMIT };
            if (filter.status) params.status = filter.status;
            if (filter.type) params.type = filter.type;
            if (filter.priority) params.priority = filter.priority;
            const { data } = await taskApi.list(params);
            console.log("TASK API RESPONSE:", data);

            // handle both formats (array or paginated response)
            if (Array.isArray(data)) {
                setTasks(data);
                setTotal(data.length);
            } else {
                setTasks(data.tasks || []);
                setTotal(data.total || 0);
            }
            setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
setTotal(data?.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filter, page]);

    const fetchWorkers = useCallback(async () => {
        try {
            const { data } = await taskApi.workerStatus();
            setWorkerStatus(data);
        } catch (e) { }
    }, []);

    useEffect(() => {
        fetchTasks();
        fetchWorkers();
        const iv = setInterval(fetchWorkers, 2000);
        return () => clearInterval(iv);
    }, [fetchTasks, fetchWorkers]);

    // SSE: patch tasks in-place when updates arrive
    // useSSE already handles the ref internally, so this inline fn is safe
    useSSE(useCallback((event, data) => {
        if (event === 'task_update') {
            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === data.id);
                if (idx === -1) {
                    // Unknown task arrived — schedule a refetch (don't call directly inside setState)
                    setTimeout(fetchTasks, 0);
                    return prev;
                }
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...data };
                return updated;
            });
        }
    }, [fetchTasks]));

    // Group tasks by status
    const grouped = {};
    STATUSES.forEach((s) => { grouped[s] = []; });
    tasks.forEach((t) => {
  if (t?.status && grouped[t.status]) {
    grouped[t.status].push(t);
  }
});

    const activeStatuses = filter.status
        ? [filter.status]
        : STATUSES.filter((s) => (grouped[s] || []).length > 0);

    return (
        <div className={styles.page}>
            <div className={styles.top}>
                <WorkerStatus status={workerStatus} />
                <div className={styles.filters}>
                    <select
                        className={styles.select}
                        value={filter.status}
                        onChange={(e) => { setFilter((f) => ({ ...f, status: e.target.value })); setPage(1); }}
                    >
                        <option value="">All Statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                        className={styles.select}
                        value={filter.priority}
                        onChange={(e) => { setFilter((f) => ({ ...f, priority: e.target.value })); setPage(1); }}
                    >
                        <option value="">All Priorities</option>
                        {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Priority {p}</option>)}
                    </select>
                    <input
                        className={styles.input}
                        placeholder="Filter by type…"
                        value={filter.type}
                        onChange={(e) => { setFilter((f) => ({ ...f, type: e.target.value })); setPage(1); }}
                    />
                    <button className={styles.refreshBtn} onClick={fetchTasks}>↺ Refresh</button>
                </div>
            </div>

            {loading ? (
                <p className={styles.loading}>Loading tasks…</p>
            ) : (
                <div className={styles.columns}>
                    {activeStatuses.map((status) => (
                        <section key={status} className={styles.column}>
                            <div className={styles.colHeader}>
                                <span className={styles.colTitle}>{STATUS_LABELS[status]}</span>
                                <span className={styles.colCount}>{grouped[status].length}</span>
                            </div>
                            <div className={styles.cardList}>
                                {grouped[status].length === 0 ? (
                                    <p className={styles.empty}>No tasks</p>
                                ) : (
                                    grouped[status].map((task) => (
                                        <TaskCard key={task.id} task={task} onAction={fetchTasks} />
                                    ))
                                )}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {total > LIMIT && (
                <div className={styles.pagination}>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className={styles.pageBtn}>← Prev</button>
                    <span className={styles.pageInfo}>Page {page} · {total} total</span>
                    <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} className={styles.pageBtn}>Next →</button>
                </div>
            )}
        </div>
    );
}
