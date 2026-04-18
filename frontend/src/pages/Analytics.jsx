import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { taskApi } from '../api/taskApi.js';
import styles from './Analytics.module.css';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data: d } = await taskApi.analytics();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className={styles.loading}>Loading analytics…</p>;
  if (!data) return <p className={styles.loading}>No data available yet. Submit some tasks first.</p>;

  const { avgByType = [], throughput = [], failureRate = [], waitDist = [] } = data;

  const avgMs = avgByType.map((r) => ({
    type: r.type.replace('_', ' '),
    avg_s: parseFloat((r.avg_ms / 1000).toFixed(1)),
    count: r.count,
  }));

  const failureData = failureRate.map((r) => ({
    type: r.type.replace('_', ' '),
    failures: parseInt(r.failures),
    total: parseInt(r.total),
    rate: r.total > 0 ? ((r.failures / r.total) * 100).toFixed(1) : '0',
  }));

  const throughputData = throughput.map((r) => ({
    time: r.minute?.slice(11, 16) || '',
    completed: parseInt(r.completed),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.grid}>

        <div className={styles.chart}>
          <h3 className={styles.title}>Avg Execution Time by Type (seconds)</h3>
          {avgMs.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={avgMs} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="type" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="avg_s" fill="var(--accent)" radius={[4,4,0,0]} name="Avg (s)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chart}>
          <h3 className={styles.title}>Throughput — Tasks Completed per Minute</h3>
          {throughputData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={throughputData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Line type="monotone" dataKey="completed" stroke="var(--green)" strokeWidth={2} dot={false} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chart}>
          <h3 className={styles.title}>Failure Rate by Task Type</h3>
          {failureData.length === 0 ? <Empty /> : (
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span>Type</span><span>Failures</span><span>Total</span><span>Rate</span>
              </div>
              {failureData.map((r) => (
                <div key={r.type} className={styles.tableRow}>
                  <span>{r.type}</span>
                  <span style={{ color: r.failures > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{r.failures}</span>
                  <span>{r.total}</span>
                  <span style={{ color: parseFloat(r.rate) > 20 ? 'var(--red)' : 'var(--green)' }}>{r.rate}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.chart}>
          <h3 className={styles.title}>Queue Wait Time Distribution</h3>
          {waitDist.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={waitDist} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}
                />
                <Bar dataKey="count" fill="var(--purple)" radius={[4,4,0,0]} name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      <button className={styles.refreshBtn} onClick={load}>↺ Refresh</button>
    </div>
  );
}

function Empty() {
  return <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No data yet</p>;
}