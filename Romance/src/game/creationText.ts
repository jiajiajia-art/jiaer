import { dayParts } from "./logic";
import { schoolName, creationCopy } from "./data";
import { term } from "../mods/registry";

/* 建角页文案模板：占位符随世界观自动替换，换世界观无需改写文案。
 * {world} 世界名 · {path} 人物线路 · {city} 城市 · {year} 开局年份 · {season} 季节 · {date} 开局日期
 * {school} 母校 · {openPaths} 已开放路径 · {lock} 锁形图标（旧写法 [L] / 🔒 同样识别）
 * 值为空的占位会连同紧邻的「 · 」分隔符一起去掉，不留残句。 */
export const CREATION_VARS: { k: string; label: string }[] = [
  { k: "world", label: "世界名" }, { k: "path", label: "人物线路" }, { k: "city", label: "城市" }, { k: "year", label: "开局年份" },
  { k: "season", label: "季节" }, { k: "date", label: "开局日期" }, { k: "school", label: "母校" }, { k: "openPaths", label: "已开放路径" }, { k: "lock", label: "锁形图标" },
];
const SEASON = ["冬", "冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬"];

export function creationVars(extra: { world?: string; path?: string }): Record<string, string> {
  const { y, m, d } = dayParts(0);
  return varsFrom({ ...extra, city: term("city", ""), date: [y, m, d], school: schoolName(), paths: creationCopy().paths });
}

/* 编辑器预览：按正在编辑的模组（而非当前世界）拼占位值 */
export function varsFrom(o: { world?: string; path?: string; city?: string; date?: [number, number, number] | string; school?: string; paths?: { name: string; open: boolean }[] }): Record<string, string> {
  const [y, m, d] = Array.isArray(o.date) ? o.date : (o.date ?? "2005.01.03").split(/[-./]/).map(Number);
  return {
    world: o.world ?? "",
    path: o.path ?? "",
    city: o.city ?? "",
    year: y ? String(y) : "",
    season: m ? SEASON[(m - 1 + 12) % 12] : "",
    date: y ? `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}` : "",
    school: o.school ?? "",
    openPaths: (o.paths ?? []).filter((p) => p.open && p.name).map((p) => `【${p.name}】`).join("、"),
  };
}

export type TextPart = { t: string; hl?: boolean; lock?: boolean };

/* 拆成片段：变量值高亮，{lock} 渲染为图标 */
export function fillParts(tpl: string, vars: Record<string, string>): TextPart[] {
  const src = tpl.replace(/\[L\]|🔒/g, "{lock}");
  const raw: TextPart[] = [];
  let last = 0;
  for (const m of src.matchAll(/\{(\w+)\}/g)) {
    if (m.index! > last) raw.push({ t: src.slice(last, m.index) });
    const k = m[1];
    if (k === "lock") raw.push({ t: "", lock: true });
    else if (k in vars) raw.push({ t: vars[k], hl: true });
    else raw.push({ t: m[0] }); // 未知占位原样保留，方便作者发现拼写错误
    last = m.index! + m[0].length;
  }
  if (last < src.length) raw.push({ t: src.slice(last) });
  // 空值占位：吃掉相邻的分隔符（「 · 」「，」「、」），避免出现「 · 2005 冬」这类残留
  const out: TextPart[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (p.hl && !p.t) {
      const prev = out[out.length - 1], next = raw[i + 1];
      if (next && !next.hl && !next.lock && /^\s*[·・，、]\s*/.test(next.t)) next.t = next.t.replace(/^\s*[·・，、]\s*/, "");
      else if (prev && !prev.hl && !prev.lock) prev.t = prev.t.replace(/\s*[·・，、]\s*$/, "");
      continue;
    }
    out.push(p);
  }
  if (out[0] && !out[0].hl && !out[0].lock) out[0].t = out[0].t.replace(/^\s*[·・，、。]\s*/, "");
  return out.filter((p) => p.t || p.lock);
}

/* 纯文本版（卡片标签 / 详情等不需要高亮的位置） */
export const fillText = (tpl: string | undefined, vars: Record<string, string>) =>
  tpl ? fillParts(tpl, vars).map((p) => (p.lock ? "锁" : p.t)).join("") : "";
