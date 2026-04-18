import { useState } from 'react';
import { taskApi } from '../api/taskApi.js';
import styles from './Submit.module.css';

const TASK_TYPES = ['image_processing', 'report_generation', 'data_import', 'email_batch', 'video_transcoding'];
const API_KEYS = ['client-alpha-key-001', 'client-beta-key-002', 'client-gamma-key-003', 'client-delta-key-004'];

export default function Submit() {
  const [form, setForm] = useState({
    type: TASK_TYPES[0],
    priority: 3,
    payload: '{"key": "value"}',
    apiKey: API_KEYS[0],
  });
  const [status, setStatus] = useState(null); // { type: 'success'|'error', msg }
  const [submitting, setSubmitting] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    setStatus(null);
    // Validate JSON payload
    let payload;
    try {
      payload = JSON.parse(form.payload);
    } catch {
      setStatus({ type: 'error', msg: 'Payload must be valid JSON' });
      return;
    }

    setSubmitting(true);
    try {
      // Temporarily set the api key in localStorage
      localStorage.setItem('apiKey', form.apiKey);
      const { data } = await taskApi.submit({
        type: form.type,
        priority: parseInt(form.priority),
        payload,
      });
      setStatus({ type: 'success', msg: `Task submitted! ID: ${data.id}` });
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setStatus({ type: 'error', msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeed() {
    setSeedLoading(true);
    try {
      // Seed via the /api/tasks/seed endpoint
      const res = await fetch('/api/tasks/seed', { method: 'POST' });
      const data = await res.json();
      setStatus({ type: 'success', msg: data.message || 'Seeded successfully!' });
    } catch (e) {
      setStatus({ type: 'error', msg: 'Seed failed: ' + e.message });
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Submit Task</h2>

        <div className={styles.field}>
          <label className={styles.label}>Client API Key</label>
          <select className={styles.select} value={form.apiKey} onChange={(e) => set('apiKey', e.target.value)}>
            {API_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <p className={styles.hint}>Identifies your client for rate limiting (10 tasks/min)</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Task Type</label>
          <select className={styles.select} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Priority</label>
          <div className={styles.priorityRow}>
            {[1,2,3,4,5].map((p) => (
              <button
                key={p}
                className={`${styles.priorityBtn} ${form.priority == p ? styles.priorityActive : ''}`}
                onClick={() => set('priority', p)}
              >
                {p}
              </button>
            ))}
            <span className={styles.priorityHint}>
              {form.priority <= 2 ? 'Low' : form.priority === 3 ? 'Medium' : 'High'}
            </span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Payload (JSON)</label>
          <textarea
            className={styles.textarea}
            rows={5}
            value={form.payload}
            onChange={(e) => set('payload', e.target.value)}
            spellCheck={false}
          />
        </div>

        {status && (
          <div className={`${styles.alert} ${status.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {status.msg}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : '⚡ Submit Task'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.heading}>Load Test</h2>
        <p className={styles.hint}>Seed 60 randomised tasks across all clients and priorities to see the system under load.</p>
        <button className={styles.seedBtn} onClick={handleSeed} disabled={seedLoading}>
          {seedLoading ? 'Seeding…' : '🌱 Seed 60 Tasks'}
        </button>
      </div>
    </div>
  );
}