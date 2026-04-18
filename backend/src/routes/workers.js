import { Router } from 'express';
import { workerPool } from '../workers/workerPool.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json(workerPool.getStatus());
});

export default router;