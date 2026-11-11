import type { GameState, Npc, NpcBaseField } from "./types";
import { worldPersonById } from "../mods/registry";
import { dayParts } from "../game/logic";

/* NPC 身份工具：生日（确定性分配 + 逢生日月长一岁）、名字归一 / 占位名拦截 / 去重匹配 */

/** 基础资料取值：玩家在编辑器里改过的存档值优先，其次内容池原设定，最后存档值（剧情 / AI 写入的） */
export function ownField(n: Npc | undefined, key: NpcBaseField, content?: string): string | undefined {
  const own = n?.[key]?.trim();
  if (own && n?.edited?.includes(key)) return own;
  return content?.trim() || own || undefined;
}

/* 年龄：纯数字（可带「岁」，如 24 / 24岁 / 24 岁）视为岁数；其余自由文本（「二十出头」）原样保留 */
const AGE_NUM = /^(\d+)\s*岁?$/;
/** 编辑器写回存档：纯数字统一存成「N 岁」，自由文本原样 */
export const normAge = (v: string): string => {
  const t = v.trim();
  const hit = AGE_NUM.exec(t);
  return hit ? `${hit[1]} 岁` : t;
};
/** 资料卡 / 提示词展示：同 normAge；空值返回 undefined（不展示该行） */
export const ageLabel = (v?: string): string | undefined => (v?.trim() ? normAge(v) : undefined);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 按 id/名字确定性推出生日（同一人物每次载入都一样） */
export function birthdayFor(key: string): { m: number; d: number } {
  const h = hashStr(key || "npc");
  const m = (h % 12) + 1;
  const d = (Math.floor(h / 12) % DAYS_IN_MONTH[m - 1]) + 1;
  return { m, d };
}

/** 缺生日则补上；agedYear 初始化为「今年生日月是否已过」，避免载入即长一岁 */
export function ensureBirthday(npc: Npc, day: number): Npc {
  if (npc.birthday) return npc;
  const set = worldPersonById(npc.id)?.birthday; // 作者在角色库里填了生日 → 用之；否则自动分配
  const birthday = set && set.m >= 1 && set.m <= 12 && set.d >= 1 && set.d <= DAYS_IN_MONTH[set.m - 1] ? set : birthdayFor(npc.id || npc.name);
  const { y, m } = dayParts(day);
  return { ...npc, birthday, agedYear: m >= birthday.m ? y : y - 1 };
}

/** 日历进入 NPC 生日月：年龄 +1（每年仅一次）。返回新数组与播报 */
export function tickBirthdays(npcs: Npc[], day: number): { npcs: Npc[]; notes: string[] } {
  const { y, m } = dayParts(day);
  const notes: string[] = [];
  let changed = false;
  const out = npcs.map((n0) => {
    let n = ensureBirthday(n0, day);
    if (n !== n0) changed = true;
    if (n.birthday && n.birthday.m === m && n.agedYear !== y) {
      // 只有纯数字年龄才长岁，并保留「岁」后缀；「三十出头」之类的自由文本不解析、不改写
      const hit = AGE_NUM.exec((n.age ?? "").trim());
      const age = hit ? Number(hit[1]) : NaN;
      n = { ...n, agedYear: y, ...(hit ? { age: n.age.replace(/\d+/, String(age + 1)) } : {}) };
      changed = true;
      if (Number.isFinite(age)) notes.push(`${n.name} 迎来 ${n.birthday!.m} 月 ${n.birthday!.d} 日的生日，今年 ${age + 1} 岁。`);
    }
    return n;
  });
  return { npcs: changed ? out : npcs, notes };
}

/** 主角生日：取建角页写进档案的「生日：X月Y日」；没填 = 元旦 */
export function playerBirthday(g: Pick<GameState, "player">): { m: number; d: number; set: boolean } {
  const v = g.player.extra?.find((e) => e.label === "生日")?.value ?? "";
  const r = /(\d{1,2})\s*月\s*(\d{1,2})/.exec(v);
  return r ? { m: +r[1], d: +r[2], set: true } : { m: 1, d: 1, set: false };
}
/** 主角年龄随日历：日历走到生日（没填则元旦）时 +1 岁，每年一次。首次调用只记基准年、不长岁 */
export function tickPlayerAge(g: GameState, day: number): { g: GameState; note?: string } {
  const { y, m, d } = dayParts(day);
  const b = playerBirthday(g);
  const passed = m > b.m || (m === b.m && d >= b.d);
  const year = passed ? y : y - 1; // 最近一次生日所在年份
  if (g.playerAgedYear === undefined) return { g: { ...g, playerAgedYear: year } };
  if (year <= g.playerAgedYear) return { g };
  const age = parseInt(g.player.age, 10);
  if (!Number.isFinite(age)) return { g: { ...g, playerAgedYear: year } };
  const n = age + (year - g.playerAgedYear);
  return {
    g: { ...g, playerAgedYear: year, player: { ...g.player, age: g.player.age.replace(/\d+/, String(n)) } }, // 保留「18岁」之类的后缀
    note: b.set ? `今天是${g.player.name}的生日，${n} 岁了。` : `新年到了，${g.player.name}又长了一岁，今年 ${n} 岁。`,
  };
}

export function birthdayLabel(n: Pick<Npc, "birthday">): string | undefined {
  return n.birthday ? `${n.birthday.m} 月 ${n.birthday.d} 日` : undefined;
}

/** 名字归一：去空白 / 标点 / 括注，便于同名判定 */
export function normName(s: string | undefined): string {
  return (s ?? "").replace(/[（(][^）)]*[）)]/g, "").replace(/[\s·・.,，。、"'“”‘’「」『』]/g, "").toLowerCase();
}

const PLACEHOLDER = /^(陌生|神秘|某|无名|不知名|未知|路人|那个|这个|一个|一名|一位)?(人|某人|陌生人|男人|女人|男子|女子|男生|女生|少年|少女|老人|小孩|孩子|路人|路人甲|路人乙|对方|他|她|它|TA|ta|ta们|他们|她们|人物|角色|npc|未知|某某|神秘人|神秘人物|陌生男子|陌生女子)?$/i;

/** 占位名（陌生人/某人/男子/他/她……）不算具体名字，不得建档 */
export function isPlaceholderName(name: string | undefined): boolean {
  const n = normName(name);
  if (!n) return true;
  return PLACEHOLDER.test(n);
}

/** 按 id → 归一名字 → 别名 查找已存在的 NPC */
export function findNpc(npcs: Npc[], id: string | undefined, name: string | undefined): Npc | undefined {
  if (id) {
    const byId = npcs.find((x) => x.id === id);
    if (byId) return byId;
  }
  const nn = normName(name);
  if (!nn) return undefined;
  return npcs.find((x) => normName(x.name) === nn || (x.aliases ?? []).some((a) => normName(a) === nn));
}


/** 心境：始终给出一句话。AI 若只回了「平静」之类的短词，按好感补成一句。 */
export function moodLine(n: { mood?: string; affinity?: number } | undefined): string {
  const m = (n?.mood || "").trim();
  if (m.length > 6) return m;
  const a = n?.affinity ?? 0;
  if (!m || m === "平静" || m === "平常") return a >= 60 ? "见到你，眉眼都松了下来。" : a >= 20 ? "神色如常，像在等你先开口。" : "客气地点点头，没多说什么。";
  return `此刻有些${m}，心思写在脸上。`;
}
