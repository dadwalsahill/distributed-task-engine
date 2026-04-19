import { config } from '../config.js';

// In-memory sliding window counter per API key
const windows = new Map();

export function rateLimitMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  if (!windows.has(apiKey)) {
    windows.set(apiKey, []);
  }

  // Drop timestamps older than 1 minute
  const timestamps = windows
    .get(apiKey)
    .filter((t) => now - t < windowMs);

  if (timestamps.length >= config.rateLimitPerMinute) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Max ${config.rateLimitPerMinute} tasks per minute per API key`,
    });
  }

  timestamps.push(now);
  windows.set(apiKey, timestamps);
  req.clientApiKey = apiKey;
  next();
}