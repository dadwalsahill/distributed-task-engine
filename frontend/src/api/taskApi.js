import axios from 'axios';

const BASE = '/api';

// Default API key for dev — in production this would come from auth
const DEFAULT_API_KEY = 'client-alpha-key-001';

const http = axios.create({ baseURL: BASE });

http.interceptors.request.use((cfg) => {
  cfg.headers['x-api-key'] = localStorage.getItem('apiKey') || DEFAULT_API_KEY;
  return cfg;
});

export const taskApi = {
  // Tasks
  list: (params = {}) => http.get('/tasks', { params }),
  get: (id) => http.get(`/tasks/${id}`),
  submit: (data) => http.post('/tasks', data),
  cancel: (id) => http.post(`/tasks/${id}/cancel`),
  retry: (id) => http.post(`/tasks/${id}/retry`),

  // Workers
  workerStatus: () => http.get('/workers/status'),

  // Analytics
  analytics: () => http.get('/tasks/analytics/summary'),

  // Seed endpoint (calls seed from backend script via a simple route)
  seed: () => http.post('/tasks/seed'),
};