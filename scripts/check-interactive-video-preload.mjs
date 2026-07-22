import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const sourcePath = path.resolve('src/utils/interactiveVideoPreload.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  },
  fileName: sourcePath
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  console,
  setTimeout,
  clearTimeout,
};
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(output, sandbox, { filename: sourcePath });

const {
  buildVideoPreloadPlan,
  selectRunnablePreloads,
} = sandbox.module.exports;

const plan = buildVideoPreloadPlan({
  currentUrl: '/video/intro-a.mp4',
  sequenceUrls: ['/video/intro-a.mp4', '/video/intro-b.mp4', '/video/intro-c.mp4'],
  sequenceIndex: 0,
  branchUrls: ['/video/right.mp4', '/video/intro-b.mp4', '/video/left.mp4'],
  nextLayerBranchUrls: ['/video/deep.mp4'],
  replayUrls: ['/video/replay.mp4'],
});

assert.deepEqual(
  JSON.parse(JSON.stringify(plan.map((task) => [task.url, task.priority]))),
  [
    ['/video/intro-a.mp4', 'current'],
    ['/video/intro-b.mp4', 'sequence-next'],
    ['/video/right.mp4', 'branch'],
    ['/video/left.mp4', 'branch'],
    ['/video/deep.mp4', 'next-layer'],
    ['/video/replay.mp4', 'replay'],
  ],
);

assert.deepEqual(
  JSON.parse(JSON.stringify(selectRunnablePreloads(plan, { playbackAtRisk: true, maxBackgroundJobs: 2 }).map((task) => task.url))),
  ['/video/intro-a.mp4'],
);

assert.deepEqual(
  JSON.parse(JSON.stringify(selectRunnablePreloads(plan, { playbackAtRisk: false, maxBackgroundJobs: 2 }).map((task) => task.url))),
  ['/video/intro-a.mp4', '/video/intro-b.mp4', '/video/right.mp4'],
);

console.log('check-interactive-video-preload.mjs passed');
