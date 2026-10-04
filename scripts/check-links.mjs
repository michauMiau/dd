#!/usr/bin/env node
/**
 * Verify that the landing page's relative links resolve to files in the repo,
 * and that a page's own asset references exist.
 *
 * Scoped to index.html and kzones/ on purpose. The older directories in this
 * repo contain absolute https://michaumiau.github.io links that cannot be
 * checked without the network, and dead links there are pre-existing and not
 * what this gate is for.
 *
 * Usage: node scripts/check-links.mjs
 * Exit: 0 all checked links resolve, 1 otherwise.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = ['index.html', 'kzones/index.html'];
const skipExternal = true;

let failures = 0;
let checked = 0;

for (const page of PAGES) {
  const pagePath = join(root, page);
  const src = readFileSync(pagePath, 'utf8');
  const dir = dirname(pagePath);

  // href="..." and src="..." that are on the page
  const refs = [
    ...src.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g),
    ...src.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);

  for (const ref of refs) {
    if (!ref || ref.startsWith('#')) continue;
    if (/^[a-z]+:/i.test(ref)) {
      if (skipExternal) continue;
      continue;
    }

    // split off any #fragment or ?query
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;

    checked++;
    // a trailing slash means "serve the directory's index.html"
    const target = clean.endsWith('/') ? join(dir, clean, 'index.html') : join(dir, clean);

    if (!existsSync(target)) {
      failures++;
      console.error(`BROKEN  ${page} -> ${ref}   (expected ${target.replace(root + '/', '')})`);
      continue;
    }
    if (statSync(target).size === 0) {
      failures++;
      console.error(`EMPTY   ${page} -> ${ref}`);
      continue;
    }
    console.log(`ok      ${page} -> ${ref}`);
  }
}

console.log(`\n${checked} relative reference(s) checked.`);
if (failures) {
  console.error(`${failures} broken reference(s).`);
  process.exit(1);
}
console.log('link check passed');