// Identifies the native part of the app (android/ + Capacitor plugins). A web
// bundle is only installed over the air on an APK with the same id.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const plugins = Object.entries(pkg.dependencies)
  .filter(([name]) => name.startsWith('@capacitor/') || name.startsWith('@capgo/'))
  .sort()
  .map(([name, version]) => `${name}@${version}`);
const parts = [execSync('git rev-parse HEAD:android').toString().trim(), readFileSync('capacitor.config.ts', 'utf8'), ...plugins];
console.log(createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 12));
