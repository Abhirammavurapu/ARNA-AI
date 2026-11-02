
import dns from 'node:dns';
import http from 'node:http';

import env, { validateEnv } from './config/env.js';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';

// Use public DNS resolvers for MongoDB SRV lookups.
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function main() {
  try {
    await connectDatabase();
    console.log(`[${env.appName}] MongoDB connected successfully`);
  } catch (err) {
    console.error(
      `[${env.appName}] MongoDB connection failed: ${err.message}`
    );
  }

  const problems = validateEnv();

  if (problems.length) {
    console.warn(
      `[${env.appName}] Configuration warnings (set these in server/.env):`
    );
    problems.forEach((problem) => console.warn(`  - ${problem}`));
  } else {
    console.log(
      `[${env.appName}] AI provider: ${env.ai.provider} (${env.ai[env.ai.provider].model})`
    );
  }

  const app = createApp();
  const server = http.createServer(app);

  server.requestTimeout = 0;
  server.headersTimeout = 65000;

  server.listen(env.port, () => {
    console.log(
      `[${env.appName}] API listening on port ${env.port} (${env.nodeEnv})`
    );
  });

  const shutdown = (signal) => {
    console.log(`[${env.appName}] ${signal} received, shutting down`);

    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
