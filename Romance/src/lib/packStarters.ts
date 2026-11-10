/**
 * 功能注释：玩法包通用模板——合约 / 影视项目 / 行业生态 / 舆情人设。
 * 规则：保留引擎结算参数（游戏读取时本来就用这套兜底）；所有内容列表清空交给作者填写；
 * 名气 / 黑粉 / 体能 / 演技 / 歌艺等娱乐圈数值一律置 0，不把娱乐圈门槛带进其它世界。
 * 同时按字段名产出各列表的空白条目样板，供编辑器「新增一项」使用。
 */
import { RAW_CONTRACTS, RAW_PROJECTS, RAW_INDUSTRY, RAW_IMAGE_CRISIS } from "../worlds/star2005/content";

type J = unknown;
type Rec = Record<string, J>;
const isRec = (v: J): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const isPrim = (v: J) => v === null || ["string", "number", "boolean"].includes(typeof v);
/** 娱乐圈专属数值字段：模板里一律归零 */
const ENT_NUM_KEY = /fame|black|tineng|yanji|geyi|controversy/i;

/** 空白条目：文字清空、数字归 0、嵌套列表清空；id 留空待作者填写 */
function blankItem(v: J): J {
  if (typeof v === "string") return "";
  if (typeof v === "number") return 0;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return [];
  if (isRec(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankItem(x)]));
  return v;
}

/** 模板骨架：对象参数保留（娱乐圈数值归零），对象列表清空 */
function skeleton(v: J, key = ""): J {
  if (typeof v === "number") return ENT_NUM_KEY.test(key) ? 0 : v;
  if (Array.isArray(v)) return v.every(isPrim) ? [] : [];
  if (isRec(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, skeleton(x, k)]));
  return v;
}

/** 收集各对象列表的条目样板（字段名 → 空白条目） */
function collectTemplates(v: J, out: Record<string, Rec> = {}): Record<string, Rec> {
  if (Array.isArray(v)) {
    for (const x of v) collectTemplates(x, out);
    return out;
  }
  if (!isRec(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (Array.isArray(x) && x.length && !x.every(isPrim) && isRec(x[0]) && !out[k]) out[k] = blankItem(x[0]) as Rec;
    collectTemplates(x, out);
  }
  return out;
}

export type PackStarter<T> = { starter: () => T; templates: Record<string, Rec> };
const make = <T,>(raw: T): PackStarter<T> => ({
  starter: () => skeleton(structuredClone(raw)) as T,
  templates: collectTemplates(raw),
});

export const contractsStarter = make(RAW_CONTRACTS);
export const projectsStarter = make(RAW_PROJECTS);
export const industryStarter = make(RAW_INDUSTRY);
export const imageCrisisStarter = make(RAW_IMAGE_CRISIS);
