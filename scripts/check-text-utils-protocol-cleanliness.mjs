import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const sourcePath = path.resolve('src/utils/textUtils.ts');
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
  console
};
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(output, sandbox, { filename: sourcePath });

const {
  cleanHistoryMessage,
  parseHistoryToSteps,
  processGameTags,
  sanitizeVisualDisplayText
} = sandbox.module.exports;

const dirtyHistory = `Story text.
[END_CHOICE
Options:
1. A`;

assert.equal(sanitizeVisualDisplayText('[END_CHOICE'), '');
assert.doesNotMatch(processGameTags(dirtyHistory), /END_CHOICE/i);
assert.doesNotMatch(cleanHistoryMessage(dirtyHistory).cleanedText, /END_CHOICE/i);

const parsedSteps = parseHistoryToSteps(`[NARRATION: Story]
[CHOICE: Next]
[OPTION: A]
[OPTION: B]
[END_CHOICE]
[END_CHOICE`);
assert.ok(parsedSteps.length > 0);
assert.doesNotMatch(JSON.stringify(parsedSteps), /END_CHOICE/i);

console.log('check-text-utils-protocol-cleanliness.mjs passed');
