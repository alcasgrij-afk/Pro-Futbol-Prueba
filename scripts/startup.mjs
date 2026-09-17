#!/usr/bin/env node
/**
 * Startup orchestration and health verification for Profutbol Antigua.
 * Ensures services start in the correct order with proper health checks.
 *
 * Usage:
 *   node scripts/startup.mjs        # Run all checks and start services
 *   node scripts/startup.mjs verify # Only verify services are healthy
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

function error(msg) {
  log(`❌ ${msg}`, 'red');
}

function success(msg) {
  log(`✅ ${msg}`, 'green');
}

function info(msg) {
  log(`ℹ️  ${msg}`, 'cyan');
}

function warn(msg) {
  log(`⚠️  ${msg}`, 'yellow');
}

/**
 * Check if a TCP port is available (nothing listening on it).
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Wait for a TCP port to be listening (with timeout and retries).
 */
async function waitForPort(port, name, timeoutMs = 30000) {
  const startTime = Date.now();
  const interval = 500;

  while (Date.now() - startTime < timeoutMs) {
    const available = await isPortAvailable(port);
    if (!available) {
      // Port is in use = service is listening
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`${name} did not start within ${timeoutMs}ms (port ${port} not listening)`);
}

/**
 * HTTP health check with retries.
 */
async function httpHealthCheck(url, name, timeoutMs = 30000) {
  const startTime = Date.now();
  const interval = 1000;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // Connection refused or timeout = keep trying
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`${name} health check failed at ${url} (timeout ${timeoutMs}ms)`);
}

/**
 * Phase 1: Check if ports 3000 and 3001 are free.
 */
async function checkPorts() {
  info('Phase 1: Checking ports...');

  const port3000Available = await isPortAvailable(3000);
  const port3001Available = await isPortAvailable(3001);

  if (!port3000Available) {
    error('Port 3000 is already in use. Kill the process with:');
    console.log('  netstat -ano | findstr ":3000"');
    console.log('  taskkill /F /PID <PID>');
    throw new Error('Port 3000 conflict');
  }

  if (!port3001Available) {
    error('Port 3001 is already in use. Kill the process with:');
    console.log('  netstat -ano | findstr ":3001"');
    console.log('  taskkill /F /PID <PID>');
    throw new Error('Port 3001 conflict');
  }

  success('Ports 3000 and 3001 are available');
}

/**
 * Phase 2: Start Docker containers (Postgres + Redis) and wait for them to be healthy.
 */
async function startDocker() {
  info('Phase 2: Starting Docker containers...');

  try {
    await execAsync('docker compose up -d', { cwd: process.cwd() });
    success('Docker containers started');
  } catch (err) {
    error('Failed to start Docker containers');
    throw err;
  }

  // Wait for Postgres (port 5432)
  info('Waiting for PostgreSQL...');
  await waitForPort(5432, 'PostgreSQL', 30000);
  success('PostgreSQL is ready');

  // Wait for Redis (port 6379)
  info('Waiting for Redis...');
  await waitForPort(6379, 'Redis', 30000);
  success('Redis is ready');

  // Give containers extra 2s to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Phase 3: Run Prisma migrations and seed.
 */
async function setupDatabase() {
  info('Phase 3: Setting up database...');

  try {
    // Prisma migrate (idempotent)
    info('Running Prisma migrations...');
    await execAsync('npm run prisma:migrate -- --name startup_init', { cwd: process.cwd() });
    success('Database migrations applied');

    // Prisma seed
    info('Seeding database...');
    await execAsync('npm run prisma:seed', { cwd: process.cwd() });
    success('Database seeded');
  } catch (err) {
    error('Failed to setup database');
    throw err;
  }
}

/**
 * Phase 4: Verify services are healthy (for verify-only mode).
 */
async function verifyServices() {
  info('Phase 4: Verifying services...');

  // Check Postgres
  const pg5432 = await isPortAvailable(5432);
  if (pg5432) {
    error('PostgreSQL is not running (port 5432 not listening)');
    throw new Error('PostgreSQL not ready');
  }
  success('PostgreSQL is running');

  // Check Redis
  const redis6379 = await isPortAvailable(6379);
  if (redis6379) {
    error('Redis is not running (port 6379 not listening)');
    throw new Error('Redis not ready');
  }
  success('Redis is running');

  // Check API (if it's running)
  const api3001 = await isPortAvailable(3001);
  if (!api3001) {
    try {
      await httpHealthCheck('http://localhost:3001/health', 'NestJS API', 5000);
      success('API is healthy');
    } catch (err) {
      warn('API is listening but health check failed');
    }
  } else {
    info('API not running (expected if you haven\'t run `npm run dev` yet)');
  }

  // Check Web (if it's running)
  const web3000 = await isPortAvailable(3000);
  if (!web3000) {
    try {
      const response = await fetch('http://localhost:3000', { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        success('Web is serving');
      }
    } catch (err) {
      warn('Web is listening but not responding');
    }
  } else {
    info('Web not running (expected if you haven\'t run `npm run dev` yet)');
  }
}

/**
 * Main orchestration.
 */
async function main() {
  const mode = process.argv[2];

  try {
    if (mode === 'verify') {
      // Verify-only mode: just check services
      await verifyServices();
      success('All services verified');
      return;
    }

    // Full startup mode
    info('Starting Profutbol Antigua stack...');

    await checkPorts();
    await startDocker();
    await setupDatabase();
    await verifyServices();

    success('Stack is ready! Run `npm run dev` to start the development servers.');
    info('Web will be at http://localhost:3000');
    info('API will be at http://localhost:3001');

  } catch (err) {
    error(`Startup failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
