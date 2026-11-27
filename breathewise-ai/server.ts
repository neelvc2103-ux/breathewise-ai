import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { envConfig } from './src/server/config/env';
import { getDatabase } from './src/server/db/database';
import { seedDatabase } from './src/server/db/seed';
import { createApiRouter } from './src/server/routes/api';
import { logger } from './src/server/utils/logger';

export function createApp(customDbPath?: string) {
  const db = getDatabase(customDbPath);
  seedDatabase(db);

  const app = express();
  // Trust the first reverse proxy hop (e.g., Render) without trusting arbitrary client-spoofed headers
  app.set('trust proxy', 1);

  // Security headers (configured to allow AI Studio preview iframe embedding safely)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    }),
  );

  app.use(express.json({ limit: '256kb' }));

  // Mount versioned REST API
  app.use('/api/v1', createApiRouter(db));

  // Centralized error handler (never leaks stack traces to client)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('unhandled_server_error', { message: err.message });
    res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
  });

  return { app, db };
}

async function startServer() {
  const { app } = createApp();

  if (envConfig.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(envConfig.port, '0.0.0.0', () => {
    logger.info('breathewise_server_started', {
      port: envConfig.port,
      nodeEnv: envConfig.nodeEnv,
      demoMode: envConfig.demoMode,
      aiConfigured: Boolean(envConfig.geminiApiKey),
    });
  });
}

// Start HTTP server only when executed directly (allows test runners to import createApp cleanly)
const isDirectExecution = process.argv[1] && process.argv[1].endsWith('server.ts');
if (isDirectExecution) {
  startServer().catch((err) => {
    logger.error('server_boot_failed', { message: (err as Error).message });
    process.exit(1);
  });
}
