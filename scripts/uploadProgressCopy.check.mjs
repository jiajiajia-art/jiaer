/**
 * 文档导入 vs 一句话生成：进度弹窗文案分流
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveUploadProgressTitle,
  resolveUploadJobStatusLabel,
} from '../src/utils/uploadProgressCopy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const t = (key) => key;

test('resolveUploadProgressTitle_一句话任务用ideaProgress', () => {
  assert.equal(
    resolveUploadProgressTitle([{ kind: 'idea' }], t),
    'createGame.ideaProgress',
  );
});

test('resolveUploadProgressTitle_文档任务用uploadProgress', () => {
  assert.equal(
    resolveUploadProgressTitle([{ kind: 'document' }], t),
    'createGame.uploadProgress',
  );
});

test('resolveUploadProgressTitle_混合任务用taskProgress', () => {
  assert.equal(
    resolveUploadProgressTitle([{ kind: 'idea' }, { kind: 'document' }], t),
    'createGame.taskProgress',
  );
});

test('resolveUploadJobStatusLabel_一句话processing为生成中', () => {
  assert.equal(
    resolveUploadJobStatusLabel({ kind: 'idea', status: 'processing' }, t),
    'createGame.statusGenerating',
  );
  assert.equal(
    resolveUploadJobStatusLabel({ kind: 'document', status: 'processing' }, t),
    'createGame.statusParsing',
  );
});

test('resolveUploadJobStatusLabel_一句话uploading为排队中', () => {
  assert.equal(
    resolveUploadJobStatusLabel({ kind: 'idea', status: 'uploading' }, t),
    'createGame.inQueue',
  );
});

test('DocumentsPanel_一句话步骤不用解析NPC文案', () => {
  const panel = read('src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.tsx');
  assert.match(panel, /isIdeaJob/);
  assert.match(panel, /createGame\.generatingNpc/);
  assert.match(panel, /showLiveProgress && isIdeaJob/);
  assert.match(panel, /showLiveProgress && !isIdeaJob/);
});

test('UploadProgressModal_使用分流标题', () => {
  const modal = read('src/components/GameSettingEditor/DocumentUpload/UploadProgressModal.tsx');
  assert.match(modal, /resolveUploadProgressTitle/);
  assert.match(modal, /resolveUploadJobStatusLabel/);
});

test('useFileUpload_一句话addJob带idea_kind', () => {
  const hook = read('src/hooks/editor/useFileUpload.ts');
  assert.match(hook, /addJob\(jobId, fileName, startTime, pointsKind === 'idea' \? 'idea' : 'document'\)/);
});
