/**
 * Netlify function bundling marks @homeslate/* as external and loads them with
 * require() at runtime. Published packages are ESM-only (exports.import), so
 * Node throws ERR_PACKAGE_PATH_NOT_EXPORTED without a require/default entry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scopeDir = path.join(root, 'node_modules', '@homeslate');

if (!fs.existsSync(scopeDir)) {
  process.exit(0);
}

function patchExportEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const target = entry.import ?? entry.default;
  if (typeof target !== 'string') return false;
  let changed = false;
  if (!entry.require) {
    entry.require = target;
    changed = true;
  }
  if (!entry.default) {
    entry.default = target;
    changed = true;
  }
  return changed;
}

let patched = 0;

for (const pkgName of fs.readdirSync(scopeDir)) {
  const pkgJsonPath = path.join(scopeDir, pkgName, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  let changed = false;

  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (key.startsWith('.')) {
        if (patchExportEntry(value)) changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    patched += 1;
  }
}

if (patched > 0) {
  console.log(`[patch-homeslate-cjs-exports] patched ${patched} @homeslate package(s)`);
}
