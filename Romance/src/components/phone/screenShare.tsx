import { LIVE_PERSON_BY_ID, getWorld } from "../../mods/registry";
import { loadConfig } from "../../lib/store";
import type { AIConfig } from "../../lib/types";
import type { EmotionId } from "../../game/phone";
/* 屏幕共享：截取当前屏幕（getDisplayMedia 抓一帧）或从相册选图，统一压缩成 JPEG dataURL */
import { useRef } from "react";
import { IconImage, IconMonitor } from "../../lib/icons";

const MAX = 960;

function shrink(src: CanvasImageSource, w: number, h: number): string {
  const k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}

export async function captureScreen(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("当前浏览器不支持截屏，请改用「从相册上传」");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const v = document.createElement("video");
    v.srcObject = stream;
    v.muted = true;
    await v.play();
    await new Promise((r) => setTimeout(r, 250));
    return shrink(v, v.videoWidth, v.videoHeight);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function fileToImage(f: File): Promise<string> {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { ok(shrink(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(url); };
    img.onerror = () => bad(new Error("图片读取失败"));
    img.src = url;
  });
}

/* 朗读：配置了语音模型就走 OpenAI 兼容 /audio/speech（同句缓存），失败或未配置时退回浏览器自带 TTS */
const ttsCache = new Map<string, string>();
let ttsAudio: HTMLAudioElement | null = null;
/* 人物专属音色：编辑器里给人物 / 父母配置的 voice；没有则返回 undefined，按性别走默认 */
export function voiceOf(pid?: string): string | undefined {
  if (!pid) return undefined;
  const own = LIVE_PERSON_BY_ID[pid]?.ttsVoice?.trim();
  if (own) return own;
  const fv = getWorld().content.familyVoices;
  return (pid === "family-father" ? fv?.father : pid === "family-mother" ? fv?.mother : undefined)?.trim() || undefined;
}
export async function synthSpeech(cfg: AIConfig, text: string, gender?: string, voiceId?: string): Promise<string> {
  const voice = voiceId || (gender === "男" ? cfg.ttsVoiceMale : cfg.ttsVoiceFemale) || cfg.ttsVoiceFemale || cfg.ttsVoiceMale || "alloy";
  const key = `${cfg.ttsModel}|${voice}|${cfg.ttsSpeed ?? 1}|${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  const base = (cfg.ttsBaseUrl || cfg.baseUrl).replace(/\/+$/, "");
  const res = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.ttsApiKey || cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.ttsModel, input: text.slice(0, 600), voice, speed: cfg.ttsSpeed ?? 1, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`语音合成失败（${res.status}）${(await res.text().catch(() => "")).slice(0, 120)}`);
  const url = URL.createObjectURL(await res.blob());
  ttsCache.set(key, url);
  return url;
}
let speechGen = 0; // 每次朗读 / 停止 +1：迟到的云端结果不再播放，避免两段语音叠在一起
export function speakOut(text: string, gender?: string, pid?: string, ownVoice?: string, emotion?: EmotionId) {
  if (typeof window === "undefined" || !text) return;
  const cfg = loadConfig();
  // 念出口的只有台词：去掉括号里的动作神态
  const say = text.replace(/[（(][^）)]*[）)]/g, "").trim() || text;
  const gen = ++speechGen;
  const local = () => { if (gen === speechGen) browserSpeak(say, gender, pid, emotion, cfg.ttsSpeed ?? 1); };
  if (cfg.ttsModel) {
    window.speechSynthesis?.cancel();
    ttsAudio?.pause();
    synthSpeech(cfg, say, gender, ownVoice?.trim() || voiceOf(pid))
      .then((url) => { if (gen !== speechGen) return; ttsAudio = new Audio(url); return ttsAudio.play(); })
      .catch(local);
    return;
  }
  local();
}
/* 挂断 / 关闭时把还没念完的话停掉 */
export function stopSpeech() {
  if (typeof window === "undefined") return;
  speechGen++;
  window.speechSynthesis?.cancel();
  ttsAudio?.pause();
}

/* ———— 浏览器自带朗读（未配置语音模型或合成失败时）————
 * 旧版只用系统默认音色、靠固定音高分男女，而性别又只读人物卡手填的 persona.gender（内置人物都没填），结果男女不分、一个调子念到底。
 * · 音色：只在普通话音色里挑，按名字认男女（Edge / Windows 的晓晓·云希、macOS 的婷婷·李牧等）；同性别有多个时按人物 id 固定分配，
 *   不同人声音不同，同一人每次一致。系统里没有该性别的音色时（如 Chrome 自带只有女声「Google 普通话」），靠音高明显拉开男女。
 * · 起伏：年龄和人物标签（清冷 / 温柔 / 直率…）定各人的嗓音底子；AI 回复的情绪定这段话的快慢、高低、轻重；
 *   再逐句按句末标点变化（问句上扬、感叹更快更响、省略号放慢放轻）。整体语速跟随设置里的「语速」。 */
type Sex = "男" | "女";
const FEMALE_VOICE = /xiao|hsiao|hiu|huihui|yaoyao|hanhan|tracy|ting-?ting|mei-?jia|sin-?ji|lili|lanlan|yu-?shu|shasha|flo|sandy|shelley|google|女|female/i;
const MALE_VOICE = /yun(?:xi|yang|jian|feng|hao|ye|ze|jie|jhe|yi)|kangkang|zhiwei|danny|wanlung|li-?mu|eddy|reed|rocko|男|\bmale\b/i;
const ODD_VOICE = /yunxia|xiaoshuang|xiaoyou|child|儿童|grandma|grandpa/i; // 童声、老人腔的趣味音色不拿来演成年人
const RETRO_VOICE = /eloquence|eddy|flo|reed|rocko|sandy|shelley/i; // macOS 的复古合成音色：同性别有更好的就不用
const MANDARIN = /^(zh|cmn)(-(hans|hant))?(-(cn|tw|sg))?$/; // 普通话；粤语与方言音色（zh-HK、zh-CN-liaoning…）不用
const MAINLAND = /^(zh|cmn)(-hans)?(-cn)?$/;
const FINE = /natural|neural|online|premium|enhanced|增强|高品质/i;
const langOf = (v: SpeechSynthesisVoice) => v.lang.replace(/_/g, "-").toLowerCase();
const sexOf = (v: SpeechSynthesisVoice): Sex | undefined => {
  const n = `${v.name} ${v.voiceURI}`;
  return FEMALE_VOICE.test(n) ? "女" : MALE_VOICE.test(n) ? "男" : undefined;
};
const rank = (v: SpeechSynthesisVoice) => (MAINLAND.test(langOf(v)) ? 2 : 0) + (FINE.test(v.name) ? 1 : 0) - (RETRO_VOICE.test(`${v.name} ${v.voiceURI}`) ? 1 : 0);
const hashOf = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Chrome 的音色列表是异步加载的：模块载入时先要一次，第一次开口前基本就绪
if (typeof window !== "undefined") window.speechSynthesis?.getVoices();

/* 挑音色：同性别里取最好的一档（大陆口音、神经网络音色优先），按人物 id 固定分配；matched=false 表示系统里没有该性别的音色 */
function pickVoice(sex: Sex | undefined, seed: number): { voice?: SpeechSynthesisVoice; matched: boolean } {
  const all = window.speechSynthesis.getVoices();
  const zh = all.filter((v) => MANDARIN.test(langOf(v)));
  const pool = (zh.length ? zh : all.filter((v) => /^(zh|yue)/.test(langOf(v)))).filter((v) => !ODD_VOICE.test(v.name)).sort((a, b) => a.name.localeCompare(b.name));
  const same = sex ? pool.filter((v) => sexOf(v) === sex) : pool;
  const unsure = pool.filter((v) => !sexOf(v));
  const from = same.length ? same : unsure.length ? unsure : pool;
  if (!from.length) return { matched: !sex };
  const top = Math.max(...from.map(rank));
  const best = from.filter((v) => rank(v) === top);
  return { voice: best[seed % best.length], matched: !sex || same.length > 0 };
}

/* 各人固定的嗓音底子（语速、音高、音量倍数）：按 id 的一点固定差异，再叠年龄与人物标签 */
function timbre(pid: string | undefined, seed: number): [number, number, number] {
  const p = pid ? LIVE_PERSON_BY_ID[pid] : undefined;
  const age = p?.age ?? (pid === "family-father" || pid === "family-mother" ? 50 : undefined);
  const tags = p?.tags?.join(" ") ?? "";
  let rate = 1 + (((seed >>> 4) % 11) - 5) / 100;
  let pitch = 1 + (((seed >>> 12) % 13) - 6) / 100;
  let volume = 1;
  if (age !== undefined) {
    if (age >= 50) { rate *= 0.93; pitch *= 0.92; }
    else if (age >= 38) { rate *= 0.97; pitch *= 0.96; }
    else if (age <= 22) { rate *= 1.03; pitch *= 1.03; }
  }
  if (/冷|沉稳|稳重|成熟|严格|严肃|危险|腹黑|慵懒/.test(tags)) { rate *= 0.94; pitch *= 0.95; }
  else if (/温柔|邻家|害羞|内向|治愈|乖/.test(tags)) { rate *= 0.95; pitch *= 1.03; volume = 0.9; }
  else if (/直率|活泼|元气|开朗|阳光|爽朗|毒舌|热情|话痨/.test(tags)) { rate *= 1.07; pitch *= 1.04; }
  return [rate, pitch, volume];
}

/* 情绪（AI 回复的 emotion）→ 语速、音高、音量倍数 */
const EMO_TONE: Record<EmotionId, [number, number, number]> = {
  ecstatic: [1.14, 1.14, 1],
  happy: [1.06, 1.07, 1],
  surprised: [1.08, 1.16, 1],
  curious: [1.03, 1.06, 0.95],
  tsundere: [1.06, 1.04, 1],
  shy: [0.92, 1.08, 0.75],
  clingy: [0.9, 1.1, 0.85],
  moved: [0.88, 0.97, 0.8],
  jealous: [1.05, 0.95, 0.95],
  possessive: [0.94, 0.9, 1],
  worried: [0.95, 0.97, 0.85],
  confused: [0.94, 1.03, 0.9],
  sad: [0.84, 0.9, 0.7],
  calm: [0.98, 1, 0.9],
};

/* 句末标点 → 这一句的语速、音高倍数与音量增减 */
function lilt(s: string): [number, number, number] {
  const end = s.match(/[。！？!?…～~]+$/)?.[0] ?? "";
  if (/[？?]/.test(end)) return [1.02, 1.1, 0];
  if (/[！!]/.test(end)) return [1.08, 1.06, 0.1];
  if (end.includes("…")) return [0.86, 0.95, -0.1];
  if (/[～~]/.test(end)) return [0.96, 1.08, 0];
  return [1, 1, 0];
}

/* 按句末标点与换行拆句，每句单独念（自带停顿与语调）；只剩标点的碎片并回上一句 */
function phrases(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\.{3,}|。{2,}/g, "…").match(/[^。！？!?…～~\n]+[。！？!?…～~]*|[。！？!?…～~]+/g) ?? []) {
    const s = raw.trim();
    if (!s) continue;
    if (out.length && !/[^\s。！？!?…～~，,、]/.test(s)) out[out.length - 1] += s;
    else out.push(s);
  }
  return out.length ? out : [text];
}

let utterances: SpeechSynthesisUtterance[] = []; // 留住引用：Chrome 会回收没人引用的 utterance，念到一半就断
function browserSpeak(text: string, gender: string | undefined, pid: string | undefined, emotion: EmotionId | undefined, speed: number) {
  const ss = window.speechSynthesis;
  if (!ss) return;
  const sex = gender === "男" || gender === "女" ? gender : undefined;
  const seed = hashOf(pid ?? "");
  const { voice, matched } = pickVoice(sex, seed);
  const [r0, p0, v0] = timbre(pid, seed);
  const [r1, p1, v1] = (emotion && EMO_TONE[emotion]) || [1, 1, 1];
  // 没有同性别的音色：男声明显压低（系统默认的中文音色多是女声），女声略抬高，至少听得出男女
  const base = matched ? 1 : sex === "男" ? 0.62 : 1.1;
  ss.cancel();
  utterances = phrases(text).map((s) => {
    const [r2, p2, dv] = lilt(s);
    const j = (hashOf(s) % 1000) / 1000 - 0.5; // 每句一点固定的起伏，免得句句同一个调
    const u = new SpeechSynthesisUtterance(s);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "zh-CN";
    u.rate = clamp(speed * r0 * r1 * r2 * (1 + j * 0.06), 0.5, 2);
    u.pitch = clamp(base * p0 * p1 * p2 * (1 - j * 0.08), 0.3, 1.8);
    u.volume = clamp(v0 * v1 + dv, 0.3, 1);
    return u;
  });
  for (const u of utterances) ss.speak(u);
}

/* 底部弹出的二选一面板 */
export function ShareSheet({ onPick, onClose, onError, dark }: { onPick: (img: string) => void; onClose: () => void; onError: (msg: string) => void; dark?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const shot = async () => {
    try { onPick(await captureScreen()); } catch (e) { onError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "已取消截屏"); }
    onClose();
  };
  const card = dark ? "bg-white/12 text-white" : "bg-white text-ink";
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/35" onClick={onClose}>
      <div className={`rounded-t-2xl p-3 pb-5 ${dark ? "bg-slate-900/95" : "bg-[#f7f7f7]"}`} onClick={(e) => e.stopPropagation()}>
        <p className={`mb-1 text-center text-[13px] font-semibold ${dark ? "text-white" : "text-ink"}`}>屏幕共享</p>
        <p className={`mb-3 text-center text-[11px] ${dark ? "text-white/60" : "text-ink-soft"}`}>TA 会真正「看到」画面，并按自己的性格做出反应</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={shot} className={`flex flex-col items-center gap-1.5 rounded-xl py-4 ${card}`}>
            <IconMonitor size={24} /><span className="text-[13px] font-medium">截图当前屏幕</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className={`flex flex-col items-center gap-1.5 rounded-xl py-4 ${card}`}>
            <IconImage size={24} /><span className="text-[13px] font-medium">从相册上传</span>
          </button>
        </div>
        <button onClick={onClose} className={`mt-2 w-full rounded-xl py-2.5 text-[14px] ${card}`}>取消</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { try { onPick(await fileToImage(f)); } catch (err) { onError((err as Error).message); } }
          onClose();
        }} />
      </div>
    </div>
  );
}
