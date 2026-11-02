import { Router } from 'express';
import env, { aiConfigured } from '../config/env.js';

const router = Router();

// Infrastructure status used by the client to show a setup state when no AI key is configured.
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: `${env.appName} API`,
    environment: env.nodeEnv,
    aiProvider: env.ai.provider,
    aiConfigured: aiConfigured(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

export default router;
