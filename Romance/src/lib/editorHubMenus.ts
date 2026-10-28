/**
 * 游戏内「编辑器」弹层（EditorHub）菜单元数据：与 GameShell 里胶囊导航一一对应。
 * 创作向导第 2 步 / 单测以此为源，禁止再手抄一份导致漏项。
 */

export type EditorHubGroupId = "now" | "story" | "mod";

export type EditorHubMenu = {
  id: string;
  groupId: EditorHubGroupId;
  group: string;
  scope: string;
  label: string;
  hint: string;
};

export const EDITOR_HUB_GROUPS: readonly {
  id: EditorHubGroupId;
  title: string;
  scope: string;
}[] = Object.freeze([
  { id: "now", title: "本局修订", scope: "即改即生效" },
  { id: "story", title: "剧情编排", scope: "条件达成即上演" },
  { id: "mod", title: "世界观", scope: "新局生效 · 可导出分享" },
]);

/** 顺序即 EditorHub 胶囊编号 01…N */
export const EDITOR_HUB_MENUS: readonly EditorHubMenu[] = Object.freeze([
  {
    id: "person",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "人物设定",
    hint: "新增人物，修改姓名、年龄、身份、关系、简介与常驻地点；调整人设、口吻、时间线与关系网",
  },
  {
    id: "map",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "地点场景",
    hint: "为地点更换名称与背景图，补写场景描写和专属剧情",
  },
  {
    id: "rules",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "世界规则",
    hint: "设定婚姻、冠姓、生育与社会秩序，决定这个世界的运转方式",
  },
  {
    id: "engine",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "底层规则",
    hint: "条件与标记、随机种子、AI 扮演控制权与 OOC、好感值域与衰减、NPC 行为、世界书检索与记忆摘要",
  },
  {
    id: "beauty",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "美化",
    hint: "主题包、皮肤配色字体、对话框、场景立绘、顶栏底栏、素材库与 CSS",
  },
  {
    id: "nav",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "底部栏",
    hint: "自由调整底部按钮的顺序与名称，并选择显示或隐藏",
  },
  {
    id: "book",
    groupId: "now",
    group: "本局修订",
    scope: "即改即生效",
    label: "世界书",
    hint: "收录世界设定词条，对话中提及关键词时，所有角色都会知晓",
  },
  {
    id: "fixed",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "剧情桥段",
    hint: "预先写好想看的剧情桥段或事件链，条件达成时自动上演；可一句话让 AI 帮写",
  },
  {
    id: "cg",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "CG 图鉴",
    hint: "上传专属插图并设置解锁条件，达成后收入图鉴",
  },
  {
    id: "audio",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "音频库",
    hint: "BGM、短音效、环境氛围音统一管理；剧情、地点、触发器与皮肤从这里选音频",
  },
  {
    id: "faction",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "阵营派系",
    hint: "自定义阵营与成员立场；声望影响态度、店铺价格与事件分支",
  },
  {
    id: "timeline",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "复盘时间线",
    hint: "自动记录时间、地点、好感、属性、事件与目标变动；可回历史点或开平行分支",
  },
  {
    id: "end",
    groupId: "story",
    group: "剧情编排",
    scope: "条件达成即上演",
    label: "结局",
    hint: "设计属于这个世界的结局，以及抵达它的条件",
  },
  {
    id: "paths",
    groupId: "mod",
    group: "世界观",
    scope: "新局生效 · 可导出分享",
    label: "人物线路",
    hint: "管理开局可选人物线路：解锁 / 锁定与提示语 · 预设主角 · 开局地点 · 前置记忆",
  },
  {
    id: "mods",
    groupId: "mod",
    group: "世界观",
    scope: "新局生效 · 可导出分享",
    label: "创意工坊",
    hint: "切换世界观、叠加玩法 Mod，或用 AI 对话生成 / 修改模组；可导入导出分享",
  },
]);

export const EDITOR_HUB_LABELS: readonly string[] = Object.freeze(
  EDITOR_HUB_MENUS.map((m) => m.label),
);
