import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { getPool } from './db.js';
import { workerPool } from './workers/workerPool.js';
import taskRoutes from './routes/tasks.js';
import workerRoutes from './routes/workers.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info({ msg: 'Incoming request', method: req.method, path: req.path });
  next();
});


app.use('/api/tasks', taskRoutes);
app.use('/api/workers', workerRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Wait for DB then start
async function bootstrap() {
  let retries = 15;
  while (retries > 0) {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      logger.info({ msg: 'Database connected' });
      break;
    } catch (e) {
      retries--;
      logger.warn({ msg: 'DB not ready, retrying...', retriesLeft: retries });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (retries === 0) {
    logger.error({ msg: 'Could not connect to DB, exiting' });
    process.exit(1);
  }

  workerPool.start();

  app.listen(config.port, () => {
    logger.info({ msg: 'Server started', port: config.port });
  });
}

bootstrap();