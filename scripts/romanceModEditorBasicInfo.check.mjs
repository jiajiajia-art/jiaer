/**
 * 作品编辑器：基本信息精简 + 玩法依赖统一入口（fluid 作者态）
 * dependencies（模组底座）≠ playModInstalls（玩法组件），禁止把二者当同一字段删掉。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const wizard = readFileSync(join(root, 'Romance/src/lib/worldGenWizard.ts'), 'utf8');
const catalog = readFileSync(join(root, 'Romance/src/mods/playModCatalog.ts'), 'utf8');
const addModal = readFileSync(join(root, 'Romance/src/components/AddPlayModModal.tsx'), 'utf8');

test('ModEditorPanel_fluid作者态应精简基本信息并保留底层字段写入路径', () => {
  assert.match(panel, /authorSimplify\s*=\s*!!fluid/);
  assert.match(panel, /authorSimplify \? \(/);
  // 精简态：名称 + 简介 + 剧本基调；不展示作品 ID / 版本 / 作者 / 图标 / 类型
  const simplifyBranch = panel.slice(
    panel.indexOf('authorSimplify ? ('),
    panel.indexOf(') : (', panel.indexOf('authorSimplify ? (')),
  );
  assert.match(simplifyBranch, /名称 \*/);
  assert.match(simplifyBranch, /简介/);
  assert.match(simplifyBranch, /剧本基调（系统提示词）/);
  assert.doesNotMatch(simplifyBranch, /作品 ID/);
  assert.doesNotMatch(simplifyBranch, /版本号/);
  assert.doesNotMatch(simplifyBranch, /作者</);
  assert.doesNotMatch(simplifyBranch, /ImagePicker/);
  assert.doesNotMatch(simplifyBranch, /世界观（单选）/);
  // 非精简（模组库高级）仍保留完整表单
  assert.match(panel, /版本号/);
  assert.match(panel, /ImagePicker value=\{m\.icon\}/);
  assert.match(panel, /世界观（单选）/);
  // ScopeBanner 在作者态隐藏
  assert.match(panel, /!authorSimplify && \([\s\S]*ScopeBanner/);
  // 新建绑作者 / 不覆盖旧作（仅 isNew 分支写入 author）
  assert.match(panel, /readFunloomAuthorLabel/);
  assert.match(panel, /if \(isNew\) \{[\s\S]*readFunloomAuthorLabel/);
  assert.match(wizard, /author: readFunloomAuthorLabel\(\)/);
});

test('ModEditorPanel_玩法页应展示玩法依赖且作者态隐藏底座依赖', () => {
  assert.match(panel, /summarizePlayModDeps/);
  assert.match(panel, /玩法依赖摘要/);
  // 功能注释：创作者不得再看到「模组底座依赖」；娱乐圈/校园骨架不进勾选列表
  assert.doesNotMatch(panel, /高级设置 · 模组底座依赖/);
  assert.doesNotMatch(panel, /收起 · 高级：模组底座依赖/);
  assert.doesNotMatch(panel, /showModDepsAdvanced/);
  assert.match(panel, /基础设定、建角、地点、人物、事件、档案是本剧本体/);
  assert.match(panel, /authorSimplify && out\.kind === "world"\) out\.dependencies = \[\]/);
  assert.match(panel, /removePlayInstall/);
  assert.match(panel, /orphanedAutoPlayDeps/);
  assert.match(panel, /playModsDependingOn/);
  // 玩法安装须标记 autoInstalled（依赖链非目标项）
  assert.match(catalog, /autoInstalled\?:/);
  assert.match(addModal, /autoInstalled: true/);
  assert.match(panel, /autoInstalled: true/);
  // 玩法目录只有可选玩法/手机应用，不含世界观骨架
  assert.doesNotMatch(catalog, /星光2005/);
  assert.doesNotMatch(catalog, /青藤校园/);
  assert.doesNotMatch(catalog, /头衔扩展包/);
});

test('ModEditorPanel_保存路径不得因精简界面清空 icon_author_kind_dependencies', () => {
  // clean() 不得 delete out.author / out.icon / out.dependencies / out.kind
  const cleanStart = panel.indexOf('const clean = (): Mod =>');
  const cleanEnd = panel.indexOf('const save =', cleanStart);
  const cleanBody = panel.slice(cleanStart, cleanEnd);
  assert.doesNotMatch(cleanBody, /delete out\.author/);
  assert.doesNotMatch(cleanBody, /delete out\.icon/);
  assert.doesNotMatch(cleanBody, /delete out\.dependencies/);
  assert.doesNotMatch(cleanBody, /delete out\.kind/);
  assert.doesNotMatch(cleanBody, /delete out\.version/);
  assert.match(cleanBody, /delete out\.builtin/);
});
