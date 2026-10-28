import { useCallback, useEffect, useState } from "react";
import localforage from "localforage";

/* 情侣空间 · 数据层：按「存档 id」隔离，存进 localforage（IndexedDB），可放大图（背景 / 信纸 / 纪念日照片）。
 * 结构上 spaces 以 charId 为键、bindings 为数组——目前一个 user 只绑一个 char，后续多绑定无需迁移。 */

export type Block = { id: string; text: string; x: number; y: number }; // x / y 为信纸内百分比坐标
export type Letter = {
  id: string;
  from: "me" | "char";
  paper: string; // 预设 id 或自定义信纸 id
  font: string;
  color: string;
  size: number;
  blocks: Block[];
  day: number; // 游戏日
  ts: number;
  read?: boolean;
  status?: "waiting" | "replied" | "failed"; // 仅我寄出的信
  replyTo?: string;
};
export type Anniv = { id: string; name: string; date: string; color: string; img?: string; builtin?: boolean };
export type QaRecord = { q: number; mine: string; theirs: string; day: number };
export type Space = {
  charId: string;
  since: number; // 绑定成功的游戏日
  qa: { cur: number; answeredDay?: number; history: QaRecord[] };
  letters: Letter[];
  annivs: Anniv[];
  bond?: Partial<Record<string, number>>; // 各类互动最近一次结算关系数值的游戏日（每类每天一次）
  proactiveDay?: number; // 最近一次判定「TA 主动来信」的游戏日
};
export type Invite = { id: string; charId: string; text: string; reply?: string; accept?: boolean; day: number; ts: number; failed?: boolean };
export type Identity = { mode: "player" | "custom"; name: string; avatar?: string };
export type CoupleData = {
  v: 1;
  identity: Identity;
  bg?: string;
  veil: number; // 背景蒙白程度 0~0.9
  papers: { id: string; src: string }[]; // 自定义上传的信纸
  bindings: string[]; // 已绑定的 charId（当前上限 1）
  spaces: Record<string, Space>;
  invites: Invite[];
};

export const MAX_BINDINGS = 1;

const db = localforage.createInstance({ name: "star2005", storeName: "couple_space" });

const blank = (): CoupleData => ({ v: 1, identity: { mode: "player", name: "" }, veil: 0.35, papers: [], bindings: [], spaces: {}, invites: [] });

function normalize(v: unknown): CoupleData {
  if (!v || typeof v !== "object") return blank();
  const d = { ...blank(), ...(v as Partial<CoupleData>) };
  d.bindings = Array.isArray(d.bindings) ? d.bindings.filter((id) => d.spaces?.[id]) : [];
  d.invites = Array.isArray(d.invites) ? d.invites : [];
  d.papers = Array.isArray(d.papers) ? d.papers : [];
  return d;
}

/* 模块级缓存 + 订阅：AI 回信等异步结果即使在离开 App 后才返回，也能照常落库 */
const cache = new Map<string, CoupleData>();
const loading = new Map<string, Promise<void>>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function load(gameId: string): Promise<void> {
  if (cache.has(gameId)) return Promise.resolve();
  let p = loading.get(gameId);
  if (!p) {
    p = db.getItem(gameId).then((v) => { cache.set(gameId, normalize(v)); }).catch(() => { cache.set(gameId, blank()); }).finally(() => { loading.delete(gameId); emit(); });
    loading.set(gameId, p);
  }
  return p;
}

export const getCouple = (gameId: string): CoupleData | undefined => cache.get(gameId);

export function updateCouple(gameId: string, fn: (d: CoupleData) => CoupleData) {
  const cur = cache.get(gameId);
  if (!cur) return;
  const next = fn(cur);
  cache.set(gameId, next);
  db.setItem(gameId, next).catch(() => { /* 存储失败时保留内存态 */ });
  emit();
}

export function useCouple(gameId: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    void load(gameId);
    return () => { subs.delete(f); };
  }, [gameId]);
  const update = useCallback((fn: (d: CoupleData) => CoupleData) => updateCouple(gameId, fn), [gameId]);
  return [cache.get(gameId) ?? null, update] as const;
}

export function newSpace(charId: string, day: number): Space {
  return {
    charId, since: day,
    qa: { cur: 0, history: [] },
    letters: [],
    annivs: [{ id: "together", name: "我们在一起", date: "", color: "#c4607e", builtin: true }],
  };
}

export const uidc = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── 信纸与字体预设（手机内固定配色，不随游戏皮肤变化） ── */
export const PAPERS: { id: string; label: string; bg: string; ink: string }[] = [
  { id: "cream", label: "奶油", bg: "linear-gradient(#fffaf3,#fff4ea)", ink: "#5a4450" },
  { id: "lined", label: "横线", bg: "repeating-linear-gradient(#fffdfd 0 27px,#efd3dc 27px 28px)", ink: "#5a4450" },
  { id: "grid", label: "方格", bg: "linear-gradient(#f3e3e9 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,#f3e3e9 1px,transparent 1px) 0 0/18px 18px,#fffdfe", ink: "#5a4450" },
  { id: "dots", label: "粉点", bg: "radial-gradient(#f2c6d4 1.2px,transparent 1.6px) 0 0/16px 16px,#fff8fa", ink: "#6b3f53" },
  { id: "sakura", label: "樱花", bg: "radial-gradient(60% 40% at 15% 10%,#ffe1ea,transparent 70%),radial-gradient(50% 40% at 90% 95%,#ffd6e3,transparent 70%),#fffafc", ink: "#7a3d58" },
  { id: "kraft", label: "牛皮", bg: "linear-gradient(160deg,#ead8bd,#dcc39f)", ink: "#4e3a2a" },
  { id: "mist", label: "雾蓝", bg: "linear-gradient(170deg,#eef3fb,#e3e8f6)", ink: "#3c4a66" },
  { id: "night", label: "夜空", bg: "radial-gradient(1px 1px at 20% 30%,#fff8,transparent),radial-gradient(1px 1px at 70% 60%,#fff6,transparent),radial-gradient(1.5px 1.5px at 40% 80%,#fff7,transparent),linear-gradient(170deg,#2b2d4a,#1b1c33)", ink: "#f3ecff" },
];
export const FONTS: { id: string; label: string; family: string }[] = [
  { id: "longcang", label: "手写", family: "'Long Cang', 'Ma Shan Zheng', cursive" },
  { id: "mashan", label: "毛笔", family: "'Ma Shan Zheng', cursive" },
  { id: "zhimang", label: "行草", family: "'Zhi Mang Xing', cursive" },
  { id: "kuaile", label: "圆趣", family: "'ZCOOL KuaiLe', sans-serif" },
  { id: "xiaowei", label: "雅宋", family: "'ZCOOL XiaoWei', serif" },
  { id: "serif", label: "宋体", family: "'Noto Serif SC', serif" },
  { id: "sans", label: "黑体", family: "'Noto Sans SC', sans-serif" },
];
export const INKS = ["#5a4450", "#c4607e", "#3c4a66", "#4e3a2a", "#7b5ea7", "#2f6f62", "#ffffff"];
export const ANNIV_COLORS = ["#c4607e", "#e08aa4", "#b07cc6", "#6f8fd1", "#4fa39a", "#d39a4a", "#5a4450"];

export const fontOf = (id: string) => FONTS.find((f) => f.id === id)?.family ?? FONTS[0].family;
export function paperStyle(id: string, papers: CoupleData["papers"]): { background: string; ink: string } {
  const custom = papers.find((p) => p.id === id);
  if (custom) return { background: `center/cover no-repeat url(${custom.src})`, ink: "#5a4450" };
  const p = PAPERS.find((x) => x.id === id) ?? PAPERS[0];
  return { background: p.bg, ink: p.ink };
}

/* 上传图片：等比压到最长边 max，转成 dataURL，避免原图撑爆存储 */
export async function readImage(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
