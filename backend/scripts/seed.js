// Run with: node scripts/seed.js
// Seeds 50+ tasks with varied types, priorities, and API keys

import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'taskengine',
  user: process.env.DB_USER || 'taskuser',
  password: process.env.DB_PASSWORD || 'taskpassword',
};

const TASK_TYPES = [
  'image_processing',
  'report_generation',
  'data_import',
  'email_batch',
  'video_transcoding',
];

const API_KEYS = [
  'client-alpha-key-001',
  'client-beta-key-002',
  'client-gamma-key-003',
  'client-delta-key-004',
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  const conn = await mysql.createConnection(DB);
  console.log('Connected to DB. Seeding 60 tasks...');

  for (let i = 0; i < 60; i++) {
    const id = uuidv4();
    const type = TASK_TYPES[randomBetween(0, TASK_TYPES.length - 1)];
    const priority = randomBetween(1, 5);
    const apiKey = API_KEYS[randomBetween(0, API_KEYS.length - 1)];
    const payload = JSON.stringify({ jobIndex: i, batchSize: randomBetween(10, 500) });

    await conn.execute(
      `INSERT INTO tasks (id, type, priority, payload, status, client_api_key)
       VALUES (?, ?, ?, ?, 'queued', ?)`,
      [id, type, priority, payload, apiKey]
    );
  }

  console.log('Done! 60 tasks seeded.');
  await conn.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });