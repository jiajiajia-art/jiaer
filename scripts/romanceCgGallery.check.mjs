import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const galleryLib = await import(pathToFileURL(join(romance, 'lib/cgGallery.ts')).href);
const panel = readFileSync(join(romance, 'components/CgPanel.tsx'), 'utf8');
const cgLib = readFileSync(join(romance, 'lib/cgGallery.ts'), 'utf8');
const shell = readFileSync(join(romance, 'components/GameShell.tsx'), 'utf8');
const audit = readFileSync(join(romance, 'game/refAudit.ts'), 'utf8');
const imageStore = readFileSync(join(romance, 'game/cgImageStore.ts'), 'utf8');

test('批量CG草稿_名称来自文件且条件保持为空', () => {
  const cg = galleryLib.createCgDraft('cg-1', '雨天.png', 'file-1');
  assert.deepEqual(cg, { id: 'cg-1', title: '雨天', imageFileId: 'file-1', conds: [] });
  assert.equal(cg.image, undefined);
});

test('CG排序_数组顺序就是玩家图鉴顺序且边界不移动', () => {
  const list = [
    galleryLib.createCgDraft('a', 'A'),
    galleryLib.createCgDraft('b', 'B'),
    galleryLib.createCgDraft('c', 'C'),
  ];
  assert.deepEqual(galleryLib.moveCg(list, 'b', -1).map((x) => x.id), ['b', 'a', 'c']);
  assert.equal(galleryLib.moveCg(list, 'a', -1), list);
});

test('CG解锁_状态和新标记只写当前存档并保存对应剧情', () => {
  const game = { id: 'save-a', cgUnlocked: { old: '第一天' }, cgNew: ['old'] };
  const next = galleryLib.applyCgUnlocks(game, ['new-1', 'new-2'], '第二天', '她说：下雨了');
  assert.deepEqual(next.cgUnlocked, { old: '第一天', 'new-1': '第二天', 'new-2': '第二天' });
  assert.deepEqual(next.cgNew, ['old', 'new-1', 'new-2']);
  assert.equal(next.cgDialogue['new-1'], '她说：下雨了');
  assert.equal(game.cgUnlocked['new-1'], undefined, '不得修改原存档对象');
});

test('同批解锁_只演出第一张并汇总其余', () => {
  assert.deepEqual(galleryLib.cgRevealBatch(['a', 'b', 'c']), { id: 'a', extra: 2 });
  assert.equal(galleryLib.cgRevealBatch([]), null);
});

test('CG入口_至少有一张启用CG才显示', () => {
  assert.equal(galleryLib.hasCgMenu(undefined), false);
  assert.equal(galleryLib.hasCgMenu([{ id: 'a', title: 'A', conds: [], enabled: false }]), false);
  assert.equal(galleryLib.hasCgMenu([{ id: 'a', title: 'A', conds: [] }]), true);
});

test('CG编辑器_复用条件行_文件ID存储_空条件不误解锁', () => {
  assert.match(panel, /CondRow/);
  assert.match(panel, /storeCgImage/);
  assert.match(cgLib, /conds:\s*\[\]/);
  assert.match(panel, /批量上传图片/);
  assert.match(panel, /前移/);
  assert.match(panel, /后移/);
  assert.match(panel, /未设解锁条件，玩家看不到/);
  assert.doesNotMatch(panel, /readAsDataURL/);
  assert.match(imageStore, /imageFileId/);
});

test('发布检查_CG缺图空条件和失效引用均按错误处理', () => {
  assert.match(audit, /未设解锁条件，玩家看不到/);
  assert.match(audit, /还没有上传图片，不能发布/);
  assert.match(audit, /cg\.npcId.*kind:\s*"npc"/s);
  assert.match(audit, /level:\s*"error"/);
});

test('游戏侧_CG菜单按作品内容显隐并支持首次解锁演出', () => {
  assert.match(shell, /hasCgMenu\(game\.cgs\)/);
  assert.match(shell, /CgUnlockReveal/);
  assert.match(shell, /prefers-reduced-motion:\s*reduce/);
  assert.match(shell, /cgNew:\s*\[\]/);
});
