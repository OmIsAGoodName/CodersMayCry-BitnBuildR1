import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find repo root (which contains pnpm-workspace.yaml or artifacts/orders-app)
let repoRoot = __dirname;
while (repoRoot && !fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')) && repoRoot !== path.dirname(repoRoot)) {
  repoRoot = path.dirname(repoRoot);
}
if (!fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
  repoRoot = process.cwd();
}

console.log('🚀 Building Vendora from repo root:', repoRoot);

const viteConfig = path.join(repoRoot, 'artifacts/orders-app/vite.config.ts');
const ordersDir = path.join(repoRoot, 'artifacts/orders-app');

let built = false;
try {
  console.log('Executing: npx vite build --config', viteConfig);
  execSync(`npx vite build --config "${viteConfig}"`, { cwd: repoRoot, stdio: 'inherit' });
  built = true;
} catch (e) {
  console.warn('Vite build from root encountered an issue, trying direct directory build...');
}

if (!built) {
  try {
    execSync('npx vite build --config vite.config.ts', { cwd: ordersDir, stdio: 'inherit' });
    built = true;
  } catch (e) {
    console.error('All build executions failed:', e.message);
    process.exit(1);
  }
}

// Synchronize build output to public, dist, and current working directory
const srcDist = path.join(repoRoot, 'artifacts/orders-app/dist/public');
const targets = new Set([
  path.join(repoRoot, 'public'),
  path.join(repoRoot, 'dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(ordersDir, 'public'),
  path.join(ordersDir, 'dist'),
]);

if (fs.existsSync(srcDist)) {
  for (const t of targets) {
    fs.cpSync(srcDist, t, { recursive: true });
  }
  console.log('✅ Synchronized build artifacts to all target public and dist directories');
} else {
  console.error('❌ Build output directory not found at:', srcDist);
  process.exit(1);
}
