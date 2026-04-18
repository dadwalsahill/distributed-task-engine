import mysql from 'mysql2/promise';
import { config } from './config.js';
import { logger } from './logger.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
    });
    logger.info({ msg: 'MySQL pool created', host: config.db.host });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}