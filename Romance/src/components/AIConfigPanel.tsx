import { synthSpeech } from "./phone/screenShare";
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
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsMsg, setTtsMsg] = useState("");

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

  /* 功能注释：select 须 appearance-none + pr-8，否则嵌入缺 preflight 时 UA 双线框叠出自绘箭头 */
  const field = "w-full appearance-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-jade";
  const selectField = `${field} pr-8`;
  const label = "mb-1 block text-[12px] font-medium text-ink-soft";

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>API Base URL</label>
        <input className={field} value={draft.baseUrl} onChange={(e) => upd({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
        <p className="mt-1 text-[11px] leading-snug text-ink-soft">
          OpenAI 兼容地址须带 <code className="text-ink">/v1</code>（如 TokenHub：
          <code className="text-ink">https://tokenhub.tencentmaas.com/v1</code>）。云厂商接口多半禁止浏览器跨域，拉取列表 / 对话会 CORS 失败——请换支持网页直连的网关，或手填模型后改用可直连的地址。
        </p>
      </div>
      <div>
        <label className={label}>API Key</label>
        <input className={field} type="password" value={draft.apiKey} onChange={(e) => upd({ apiKey: e.target.value })} placeholder="sk-..." />
      </div>

      <div>
        <label className={label}>模型</label>
        <div className="flex gap-2">
          {/* 功能注释：可手填 model id（TokenHub CORS 时无法拉列表）；datalist 承接「获取模型列表」结果 */}
          <input
            className={`${field} flex-1`}
            list="romance-ai-model-list"
            value={draft.model}
            onChange={(e) => upd({ model: e.target.value })}
            placeholder="手填模型 id，如 deepseek-v3 / hy3"
            autoComplete="off"
          />
          <datalist id="romance-ai-model-list">
            {draft.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={doFetch}
            disabled={loadingModels}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-jade/40 bg-jade/10 px-3 py-2 text-xs font-medium text-jade transition hover:bg-jade/20 disabled:opacity-50"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>对话流式输出（主剧情始终流式）</label>
          <button type="button" onClick={() => upd({ stream: !draft.stream })} aria-pressed={!!draft.stream}
            className={`w-full rounded-lg border px-3 py-2 text-[13px] transition ${draft.stream ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>
            {draft.stream ? "已开启 · 逐字显示" : "已关闭 · 整段显示"}
          </button>
        </div>
        <div>
          <label className={label}>思考强度（reasoning.effort）</label>
          <select className={selectField} value={draft.reasoningEffort ?? "none"} onChange={(e) => upd({ reasoningEffort: e.target.value as "none" | "low" | "high" | "max" })}>
            <option value="none">none · 关闭思考</option>
            <option value="low">low</option>
            <option value="high">high</option>
            <option value="max">max</option>
          </select>
        </div>
      </div>

      {/* 语音模型：小手机语音消息、通话的朗读；不填模型就用浏览器自带朗读 */}
      <div className="space-y-3 rounded-xl border border-line bg-paper-2/60 p-3">
        <p className="text-[13px] font-bold text-ink">语音模型 <span className="ml-1 text-[11px] font-normal text-ink-soft">用于语音消息 / 通话朗读；模型留空则用浏览器自带朗读（免费、本地）</span></p>
        <div>
          <label className={label}>语音 API Base URL（留空沿用上方）</label>
          <input className={field} value={draft.ttsBaseUrl ?? ""} onChange={(e) => upd({ ttsBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label className={label}>语音 API Key（留空沿用上方）</label>
          <input className={field} type="password" value={draft.ttsApiKey ?? ""} onChange={(e) => upd({ ttsApiKey: e.target.value })} placeholder="sk-..." />
        </div>
        <div>
          <label className={label}>语音模型（OpenAI 兼容 /audio/speech）</label>
          <input className={field} value={draft.ttsModel ?? ""} onChange={(e) => upd({ ttsModel: e.target.value })} placeholder="gpt-4o-mini-tts / tts-1 / FunAudioLLM/CosyVoice2-0.5B" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>女声音色</label>
            <input className={field} value={draft.ttsVoiceFemale ?? ""} onChange={(e) => upd({ ttsVoiceFemale: e.target.value })} placeholder="nova / shimmer" />
          </div>
          <div>
            <label className={label}>男声音色</label>
            <input className={field} value={draft.ttsVoiceMale ?? ""} onChange={(e) => upd({ ttsVoiceMale: e.target.value })} placeholder="onyx / echo" />
          </div>
        </div>
        <div>
          <label className={label}>语速 · {(draft.ttsSpeed ?? 1).toFixed(2)}×</label>
          <input type="range" min={0.5} max={2} step={0.05} value={draft.ttsSpeed ?? 1} onChange={(e) => upd({ ttsSpeed: Number(e.target.value) })} className="w-full accent-jade" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!draft.ttsModel || ttsBusy} onClick={async () => {
            setTtsMsg(""); setTtsBusy(true);
            try { const url = await synthSpeech(draft, "你好呀，今天的声乐课别迟到哦。"); await new Audio(url).play(); setTtsMsg("试听成功"); }
            catch (e) { setTtsMsg(e instanceof Error ? e.message : "试听失败"); }
            finally { setTtsBusy(false); }
          }} className="rounded-full border border-jade px-3 py-1 text-[12px] font-bold text-jade transition hover:bg-jade/10 disabled:opacity-40">{ttsBusy ? "合成中…" : "试听"}</button>
          {ttsMsg && <span className={`text-[11.5px] ${ttsMsg === "试听成功" ? "text-jade" : "text-danger"}`}>{ttsMsg}</span>}
        </div>
      </div>

      {/* 生图模型：封面、CG 等「AI 生成图片」共用 */}
      <div className="space-y-3 rounded-xl border border-line bg-paper-2/60 p-3">
        <p className="text-[13px] font-bold text-ink">生图模型 <span className="ml-1 text-[11px] font-normal text-ink-soft">用于编辑器里 AI 生成封面 / CG</span></p>
        <div>
          <label className={label}>生图 API Base URL（留空沿用上方）</label>
          <input className={field} value={draft.imgBaseUrl ?? ""} onChange={(e) => upd({ imgBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label className={label}>生图 API Key（留空沿用上方）</label>
          <input className={field} type="password" value={draft.imgApiKey ?? ""} onChange={(e) => upd({ imgApiKey: e.target.value })} placeholder="sk-..." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>生图模型</label>
            <input className={field} value={draft.imgModel ?? ""} onChange={(e) => upd({ imgModel: e.target.value })} placeholder="gpt-image-1 / dall-e-3" />
          </div>
          <div>
            <label className={label}>默认尺寸</label>
            <select className={selectField} value={draft.imgSize ?? "1024x1792"} onChange={(e) => upd({ imgSize: e.target.value })}>
              <option value="1024x1792">竖版 1024×1792</option>
              <option value="1024x1024">方形 1024×1024</option>
              <option value="1792x1024">横版 1792×1024</option>
            </select>
          </div>
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
