/**
 * 开局 inflight / play-ui 单侧 gate
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasSessionAutoStartCompleted,
  resetSessionAutoStartGate,
  runSessionAutoStartOnce,
} from '../src/lib/galgame/sessionStartInflight.ts';
import {
  ensurePlayUiHydratedOnce,
  hasPlayUiHydrated,
  resetPlayUiHydrationGate,
} from '../src/lib/galgame/playUiHydrationGate.ts';

test('runSessionAutoStartOnce_同一session只执行一次', async () => {
  resetSessionAutoStartGate();
  let n = 0;
  const task = async () => {
    n += 1;
    await new Promise((r) => setTimeout(r, 10));
  };
  await Promise.all([
    runSessionAutoStartOnce('s1', task),
    runSessionAutoStartOnce('s1', task),
  ]);
  await runSessionAutoStartOnce('s1', task);
  assert.equal(n, 1);
  assert.equal(hasSessionAutoStartCompleted('s1'), true);
});

test('ensurePlayUiHydratedOnce_同一session只hydrate一次', async () => {
  resetPlayUiHydrationGate();
  let n = 0;
  const hydrate = async () => {
    n += 1;
  };
  await Promise.all([
    ensurePlayUiHydratedOnce('s1', hydrate),
    ensurePlayUiHydratedOnce('s1', hydrate),
  ]);
  await ensurePlayUiHydratedOnce('s1', hydrate);
  assert.equal(n, 1);
  assert.equal(hasPlayUiHydrated('s1'), true);
});
