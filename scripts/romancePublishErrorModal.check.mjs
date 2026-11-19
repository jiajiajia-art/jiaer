/**
 * 功能注释：「同意并提交」失败时不得只写被审核弹层挡住的页内横幅，须弹窗展示；
 * 封面类错误（含后端缺少游戏封面文案）露出「去上传封面」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const editor = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const { isPublishCoverError } = await import(pathToFileURL(join(romance, 'lib/romancePublishReady.ts')).href);

test('isPublishCoverError_后端缺封面文案_识别为封面错误', () => {
  assert.equal(
    isPublishCoverError('缺少游戏封面，请先上传横版与竖版封面后再发布'),
    true,
  );
  assert.equal(isPublishCoverError('请先设置作品封面后再提交发布审核'), true);
  assert.equal(isPublishCoverError('同步封面到平台失败，请检查网络后重试'), true);
});

test('isPublishCoverError_非封面错误_不误判', () => {
  assert.equal(isPublishCoverError('请先选择作品题材后再提交发布审核'), false);
  assert.equal(isPublishCoverError('网络异常，提交失败'), false);
  assert.equal(isPublishCoverError(''), false);
  assert.equal(isPublishCoverError(null), false);
});

test('submitPublish_失败时弹窗展示且不写失败横幅', () => {
  assert.match(editor, /const \[publishError, setPublishError\]/);
  assert.match(editor, /无法提交发布审核/);
  assert.match(editor, /data-publish-error-modal="1"/);
  assert.match(editor, /去上传封面/);
  assert.match(editor, /dismissPublishErrorToCover/);
  assert.match(editor, /isPublishCoverError\(publishError\)/);
  // 功能注释：失败分支须关审核弹层并 setPublishError；禁止再 setPublishNote({ ok: false
  assert.match(editor, /setPublishOpen\(false\);\s*setPublishNote\(null\);\s*setPublishError\(/);
  assert.doesNotMatch(editor, /setPublishNote\(\{\s*ok:\s*false/);
});
