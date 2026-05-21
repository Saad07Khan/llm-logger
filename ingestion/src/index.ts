import express from 'express';
import cors from 'cors';
import { tryValidate } from './validator';
import { enrich } from './processor';
import { persistInferenceLog, prisma } from './storage';
import { startWorker } from './worker';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'unreachable',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/logs', async (req, res) => {
  const result = tryValidate(req.body);
  if (!result.ok) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: result.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  try {
    const enriched = enrich(result.value);
    const id = await persistInferenceLog(enriched);
    return res.status(201).json({ id, status: 'persisted' });
  } catch (err) {
    console.error('[api/logs] persist failed:', err);
    return res.status(500).json({
      error: 'Persist failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[express] error:', err);
  res.status(500).json({ error: err.message ?? 'Internal error' });
});

const worker = startWorker();

const server = app.listen(PORT, () => {
  console.log(`[ingestion] listening on http://0.0.0.0:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[ingestion] received ${signal}, shutting down`);
  try {
    await worker.close();
  } catch (err) {
    console.error('[ingestion] worker close error:', err);
  }
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
