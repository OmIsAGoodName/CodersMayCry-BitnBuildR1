import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let repoRoot = __dirname;
while (repoRoot && !fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')) && repoRoot !== path.dirname(repoRoot)) {
  repoRoot = path.dirname(repoRoot);
}
if (!fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
  repoRoot = path.resolve(__dirname, '../../');
}

const viteConfig = path.join(repoRoot, 'artifacts/orders-app/vite.config.ts');
const ordersDir = path.join(repoRoot, 'artifacts/orders-app');

try {
  execSync(`npx vite build --config "${viteConfig}"`, { cwd: repoRoot, stdio: 'inherit' });
} catch {
  execSync('npx vite build --config vite.config.ts', { cwd: ordersDir, stdio: 'inherit' });
}

const srcDist = path.join(repoRoot, 'artifacts/orders-app/dist/public');
const targets = [
  path.join(repoRoot, 'public'),
  path.join(repoRoot, 'dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
];

if (fs.existsSync(srcDist)) {
  for (const t of targets) {
    fs.cpSync(srcDist, t, { recursive: true });
  }
}
