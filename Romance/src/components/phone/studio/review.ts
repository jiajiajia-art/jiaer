/* ═══ 审核中心 · 审核引擎 ═══
 * 两段式：① 规则硬性拦截（完整性检查必须通过、截图 ≥2、体验风险 ≤2）；
 * ② AI 审核员按《开发者工坊审核规范》逐项评估，给出结论、驳回原因与修改建议。
 * 审核在模块级异步执行：离开页面不中断；刷新后遗留的「审核中」会自动恢复为待审核。 */
import { useSyncExternalStore } from "react";
import { complete, isConfigured } from "../../../lib/ai";
import { friendlyAIError } from "../../../lib/aiError";
import { loadConfig } from "../../../lib/store";
import { layoutText, layoutOf, patchApp, reviewApp, runChecks, type UserApp } from "./core";

export const REVIEW_STEPS = ["资料审核", "功能测试", "内容合规", "体验评估", "出具意见"] as const;
export type ReviewRecord = {
  at: number; ok: boolean; opinion: string; reasons: string[]; suggestions: string[];
  scores?: Record<string, number>; by: "规则" | "AI 审核员"; version: string;
};

/* 进行中的审核进度（内存态，跨组件订阅） */
const progress = new Map<string, number>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let snap = new Map(progress);
export const useReviewProgress = (id: string) =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap).get(id);
const setStep = (id: string, n: number | undefined) => { if (n === undefined) progress.delete(id); else progress.set(id, n); snap = new Map(progress); emit(); };

const SYS = `你是小手机「应用商店」的审核员，依据《开发者工坊审核规范》审核玩家提交的应用。
规范：
1. 资料：名称简洁不误导；简介如实描述功能；截图与页面一致。
2. 功能：主要功能都有对应页面和可用交互；不存在空壳页面、无效按钮、无处查看的数据。
3. 内容合规：不含赌博、色情、暴力、诈骗、侵权、诱导付费等内容。
4. 体验：布局符合玩家确认的习惯；导航清晰；信息密度合理；文案友好。
评分每项 0~100，任一项低于 60 或存在合规问题即驳回。
只输出一个 JSON：{"ok":true|false,"scores":{"资料":0,"功能":0,"合规":0,"体验":0},"opinion":"一句话结论","reasons":["驳回原因，通过时为空"],"suggestions":["具体修改建议，最多 4 条"]}`;

function brief(a: UserApp) {
  const s = a.spec;
  return JSON.stringify({
    名称: s.name, 类型: s.type, 分类: a.meta.category, 版本: a.meta.version, 简介: s.intro, 功能: s.features,
    交互: s.interaction, 存储: s.storage, 登录: s.login, 联网: s.network, 布局习惯: layoutText(layoutOf(s)),
    底部导航: s.tabs, 截图数: a.meta.screenshots.length,
    页面: s.pages.map((p) => ({ id: p.id, 名称: p.name, 组件: p.blocks.map((b) => [b.type, b.title || b.text || "", b.action ? `${b.action}->${b.target ?? ""}` : ""].filter(Boolean).join(" ")) })),
  }).slice(0, 6000);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = new Set<string>();

export async function startReview(app: UserApp, onSlime?: (t: string) => void) {
  if (running.has(app.id)) return;
  running.add(app.id);
  patchApp(app.id, { status: "reviewing", reviewStartedAt: Date.now() });
  onSlime?.("审核员正在看你的应用，稍等一下下～");
  const finish = (rec: ReviewRecord) => {
    patchApp(app.id, (a) => ({ status: rec.ok ? "approved" : "rejected", review: { opinion: rec.opinion, reasons: rec.reasons, at: rec.at }, reviews: [rec, ...(a.reviews ?? [])].slice(0, 20), reviewStartedAt: undefined }));
    onSlime?.(rec.ok ? "审核通过啦！快点「发布到应用商店」！" : "被驳回了…别灰心，看看原因改一改～");
  };
  try {
    // ① 资料 + 功能测试：重新跑一遍完整性检查（以提交时的最新内容为准）
    setStep(app.id, 0); await wait(600);
    const report = runChecks(app);
    patchApp(app.id, { report });
    setStep(app.id, 1); await wait(700);
    const rule = reviewApp(app);
    if (!rule.ok) {
      setStep(app.id, 4); await wait(400);
      return finish({ at: Date.now(), ok: false, opinion: rule.opinion, reasons: rule.reasons, suggestions: ["按驳回原因逐条修改", "改完回到「检查」重新提交"], by: "规则", version: app.meta.version });
    }
    // ② AI 审核员
    setStep(app.id, 2);
    const cfg = loadConfig();
    if (!isConfigured(cfg)) {
      patchApp(app.id, { status: "pending", reviewStartedAt: undefined });
      onSlime?.("审核员需要接入 AI 才能上班哦");
      throw new Error("需要先在菜单「AI 配置」里接入模型，审核员才能审核。");
    }
    const raw = await complete(cfg, [{ role: "system", content: SYS }, { role: "user", content: `请审核这个应用：\n${brief(app)}` }]);
    setStep(app.id, 3); await wait(500);
    const m = raw.match(/\{[\s\S]*\}/);
    let v: { ok?: boolean; scores?: Record<string, number>; opinion?: string; reasons?: string[]; suggestions?: string[] };
    try { v = JSON.parse((m?.[0] ?? "").replace(/,\s*([}\]])/g, "$1")); } catch { throw new Error("审核员的意见格式有误，请重新提交审核。"); }
    const scores = v.scores ?? {};
    const low = Object.entries(scores).filter(([, n]) => typeof n === "number" && n < 60).map(([k, n]) => `${k}得分 ${n}，低于 60 分`);
    const ok = v.ok === true && !low.length;
    setStep(app.id, 4); await wait(400);
    finish({
      at: Date.now(), ok, scores, by: "AI 审核员", version: app.meta.version,
      opinion: v.opinion || (ok ? "审核通过。" : "审核未通过。"),
      reasons: ok ? [] : [...(v.reasons ?? []), ...low].filter(Boolean).slice(0, 8),
      suggestions: (v.suggestions ?? []).slice(0, 4),
    });
  } catch (e) {
    const msg = e instanceof Error && /AI 配置|格式有误/.test(e.message) ? e.message : friendlyAIError(e).text;
    patchApp(app.id, { status: "pending", reviewStartedAt: undefined, reviewError: msg });
    onSlime?.("审核没能完成，稍后再提交一次吧");
  } finally {
    running.delete(app.id);
    setStep(app.id, undefined);
  }
}

/** 刷新/重进后：没有在跑的「审核中」恢复为待审核，避免永远卡住 */
export function recoverStaleReviews(apps: UserApp[]) {
  for (const a of apps) if (a.status === "reviewing" && !running.has(a.id)) patchApp(a.id, { status: "pending", reviewStartedAt: undefined, reviewError: "上次审核被中断，请重新提交。" });
}

/* 从「设置 · 审核中心」跳回开发者工坊修改 */
let pendingOpen: { id?: string; tab: "chat" | "check" } | null = null;
export function requestStudio(id?: string, tab: "chat" | "check" = "chat") {
  pendingOpen = { id, tab };
  window.dispatchEvent(new CustomEvent("phone:open-app", { detail: "appstore" }));
  window.dispatchEvent(new Event("studio:open")); // 已在应用商店里时直接打开工坊
}
export const takeStudioRequest = () => { const r = pendingOpen; pendingOpen = null; return r; };
