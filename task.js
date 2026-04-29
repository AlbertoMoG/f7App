/**
 * Lightweight task runner: node task.js <command>
 * Run from project root.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

function loadEnvLocal() {
  const filePath = path.join(root, '.env.local');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function assertEnvLocal() {
  const env = loadEnvLocal();
  if (!env) {
    console.error('Missing .env.local. Copy .env.example and fill required variables.');
    process.exit(1);
  }
  const missing = REQUIRED_ENV.filter((k) => !env[k] || String(env[k]).trim() === '');
  if (missing.length) {
    console.error('Incomplete .env.local. Missing or empty:');
    missing.forEach((k) => console.error(`  - ${k}`));
    process.exit(1);
  }
}

function runNpm(script, extraArgs = []) {
  const isWin = process.platform === 'win32';
  const r = spawnSync('npm', ['run', script, ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
  });
  process.exit(r.status ?? 1);
}

function runNpmAsync(script, extraArgs = []) {
  const isWin = process.platform === 'win32';
  const child = spawn('npm', ['run', script, ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

function help() {
  console.log(`
Usage: node task.js <command>

  dev          Validate .env.local then start Vite (npm run dev)
  setup-win    Install Windows optional native deps (npm run setup:win)
  lint         Typecheck (npm run lint)
  test-rules   Firestore rules tests with Emulator (npm run test:rules)
  deploy-rules Deploy rules to Firebase (npm run deploy:rules)
  build        Production build
  preview      Preview production build
  clean        Remove dist/ folder (cross-platform)
  help         Show this message
`);
}

const cmd = process.argv[2] ?? 'help';

switch (cmd) {
  case 'dev':
    assertEnvLocal();
    runNpmAsync('dev');
    break;
  case 'setup-win':
    runNpm('setup:win');
    break;
  case 'lint':
    runNpm('lint');
    break;
  case 'test-rules':
    runNpm('test:rules');
    break;
  case 'deploy-rules':
    runNpm('deploy:rules');
    break;
  case 'build':
    assertEnvLocal();
    runNpm('build');
    break;
  case 'preview':
    runNpm('preview');
    break;
  case 'clean': {
    const dist = path.join(root, 'dist');
    if (fs.existsSync(dist)) {
      fs.rmSync(dist, { recursive: true, force: true });
      console.log('Removed dist/');
    } else {
      console.log('No dist/ to remove.');
    }
    break;
  }
  case 'help':
  default:
    help();
    process.exit(cmd === 'help' || cmd === undefined ? 0 : 1);
}
