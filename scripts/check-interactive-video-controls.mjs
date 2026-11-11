import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const sourcePath = path.resolve('src/utils/interactiveVideoControls.ts');
const playerPath = path.resolve('src/page/InteractiveVideo.tsx');
const playerCssPath = path.resolve('src/page/InteractiveVideo.module.css');
const source = fs.readFileSync(sourcePath, 'utf8');
const playerSource = fs.readFileSync(playerPath, 'utf8');
const playerCss = fs.readFileSync(playerCssPath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: sourcePath,
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  console,
};
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(output, sandbox, { filename: sourcePath });

const {
  PLAYBACK_RATE_OPTIONS,
  canShowSkipControl,
  getNextPlaybackRate,
  normalizePlaybackRate,
} = sandbox.module.exports;

assert.deepEqual(JSON.parse(JSON.stringify(PLAYBACK_RATE_OPTIONS)), [1, 1.25, 1.5, 2]);
assert.equal(normalizePlaybackRate(1.25), 1.25);
assert.equal(normalizePlaybackRate(1.33), 1);
assert.equal(getNextPlaybackRate(1), 1.25);
assert.equal(getNextPlaybackRate(1.25), 1.5);
assert.equal(getNextPlaybackRate(1.5), 2);
assert.equal(getNextPlaybackRate(2), 1);
assert.equal(canShowSkipControl('fresh'), false);
assert.equal(canShowSkipControl('replay'), true);

assert.match(playerSource, /const \[isVariableBoardOpen, setIsVariableBoardOpen\] = useState\(false\);/);
assert.match(playerSource, /const variableBoardPortal = isVariableBoardOpen/);
assert.match(playerSource, /className=\{styles\.variableBoardOverlay\}/);
assert.doesNotMatch(
  playerSource,
  /const handleOpenVariableBoard = \(\) => \{\s*setMobileToolsTab\('variables'\);\s*setIsMobileToolsOpen\(true\);/m,
);
assert.match(playerCss, /\.variableBoardOverlay\s*\{/);
assert.match(playerCss, /\.variableBoardModal\s*\{/);
assert.match(playerCss, /\.cinematicVideoPage\s+\.videoSceneTitle\s*\{[^}]*display:\s*none;/s);

console.log('check-interactive-video-controls.mjs passed');
