/**
 * Router basename 须跟随 Vite BASE_URL，避免 /funloom-test 黑屏。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('App_使用getAppBasePath作为basename', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /getAppBasePath/);
  assert.match(app, /basename=\{routerBasename\}/);
  assert.doesNotMatch(app, /basename=['"]\/funloom['"]/);
});

test('appBasePath_从BASE_URL推导', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/appBasePath.ts'), 'utf8');
  assert.match(src, /import\.meta\.env\.BASE_URL/);
  assert.match(src, /export function getAppBasePath/);
  assert.match(src, /export function appPath/);
});

test('main_navigateToHome用appPath', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  assert.match(main, /appPath\(['"]home['"]\)/);
  assert.doesNotMatch(main, /origin \+ '\/funloom\/home'/);
});
