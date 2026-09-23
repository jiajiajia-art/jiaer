import { useState } from "react";
import { fetchModels, testConnection } from "../lib/ai";
import { useGame } from "../store/gameCtx";
import { IconRefresh, IconSpark } from "../lib/icons";
import type { AIConfig } from "../lib/types";

export default function AIConfigPanel() {
  const { cfg, setCfg } = useGame();
  const [draft, setDraft] = useState<AIConfig>(cfg);
  const [status, setStatus] = useState<{ tone: "ok" | "err" | "info"; msg: string } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);

  const upd = (patch: Partial<AIConfig>) => setDraft((d) => ({ ...d, ...patch }));

  const doFetch = async () => {
    setLoadingModels(true);
    setStatus(null);
    try {
      const models = await fetchModels(draft);
      const next = { ...draft, models, model: draft.model || models[0] };
      setDraft(next);
      setStatus({ tone: "ok", msg: `已拉取 ${models.length} 个模型` });
    } catch (e) {
      setStatus({ tone: "err", msg: (e as Error).message });
    } finally {
      setLoadingModels(false);
    }
  };

  const doTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const msg = await testConnection(draft);
      setStatus({ tone: "ok", msg });
    } catch (e) {
      setStatus({ tone: "err", msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const doSave = () => {
    setCfg(draft);
    setStatus({ tone: "ok", msg: "配置已保存，全局生效（刷新后自动加载）。" });
  };

  const field = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-jade";
  const label = "mb-1 block text-[12px] font-medium text-ink-soft";

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>API Base URL</label>
        <input className={field} value={draft.baseUrl} onChange={(e) => upd({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
      </div>
      <div>
        <label className={label}>API Key</label>
        <input className={field} type="password" value={draft.apiKey} onChange={(e) => upd({ apiKey: e.target.value })} placeholder="sk-..." />
      </div>

      <div>
        <label className={label}>模型</label>
        <div className="flex gap-2">
          <select className={`${field} flex-1`} value={draft.model} onChange={(e) => upd({ model: e.target.value })}>
            {draft.model && !draft.models.includes(draft.model) && <option value={draft.model}>{draft.model}</option>}
            {draft.models.length === 0 && <option value="">（点击右侧获取模型列表）</option>}
            {draft.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={doFetch}
            disabled={loadingModels}
            className="flex items-center gap-1 rounded-lg border border-jade/40 bg-jade/10 px-3 py-2 text-xs font-medium text-jade transition hover:bg-jade/20 disabled:opacity-50"
          >
            <IconRefresh width={15} height={15} className={loadingModels ? "animate-spin" : ""} />
            获取模型列表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>temperature · {draft.temperature.toFixed(2)}</label>
          <input type="range" min={0} max={2} step={0.05} value={draft.temperature} onChange={(e) => upd({ temperature: +e.target.value })} className="w-full accent-jade" />
        </div>
        <div>
          <label className={label}>top_p · {draft.topP.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={draft.topP} onChange={(e) => upd({ topP: +e.target.value })} className="w-full accent-jade" />
        </div>
      </div>

      {status && (
        <p className={`rounded-lg px-3 py-2 text-[12px] ${status.tone === "ok" ? "bg-jade/12 text-jade" : status.tone === "err" ? "bg-danger/12 text-danger" : "bg-gold/12 text-gold"}`}>
          {status.msg}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={doTest} disabled={testing} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line py-2 text-sm font-medium text-ink transition hover:bg-line/40 disabled:opacity-50">
          <IconSpark width={16} height={16} /> {testing ? "测试中…" : "测试连接"}
        </button>
        <button onClick={doSave} className="flex-1 rounded-lg bg-jade py-2 text-sm font-semibold text-paper-2 transition hover:brightness-110">
          保存配置
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-soft">
        配置持久化到本地（localStorage），全局生效，所有剧情请求复用该配置，切换模型无需刷新。未填写时游戏进入离线试玩模式，仍可体验完整流程。
      </p>
    </div>
  );
}
