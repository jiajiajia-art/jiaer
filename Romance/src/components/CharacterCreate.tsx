import { lazyPanel } from "../lib/lazyPanel";
const WorldRuleCards = lazyPanel(() => import("./WorldRulesPanel").then((m) => ({ default: m.WorldRuleCards })));
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { DEFAULT_ATTRS, randomPlayerSeed } from "../lib/store";
import { syncPlayerNameChange } from "../lib/syncPlayerName";
import { randomName, type NameGender, type NameStyle } from "../game/names";
import type { PlayPrefs, Player } from "../lib/types";
import PlayPrefsPicker from "./PlayPrefsPicker";
import { fxSummary } from "../game/optFx";
import type { OptFx } from "../game/data";
import { Avatar, Chip, Modal } from "./ui";
import { IconCake, IconCheck, IconDice, IconHeart, IconIdCard, IconLock, IconPlay, IconUser } from "../lib/icons";
import { STYLES, IDENTITIES, BACKGROUNDS, DIRECTIONS, PARENT_JOBS, schoolName, creationCopy, savePathLock, zodiacOf, optFx, defaultWorldRules, type BuiltinFieldCfg, type BuiltinFieldKey, type CreationField, type CreationOptCat } from "../game/data";
import { commitSelection, worldPersonById, getSelectedWorld, getWorldRuleDims, selectedFeature, selectedSlot, setStartDateOverride, useMods } from "../mods/registry";
import NamePicker from "./NamePicker";
import { ZodiacSign } from "../lib/zodiacIcons";
import { factionSigningOffers, rollSigningOffers, type SigningContract } from "../worlds/star2005/content";
import { creationVars, fillParts, fillText } from "../game/creationText";
import RoutePerks from "./RoutePerks";
import { cleanPerks } from "../game/routeFx";

/** 功能注释：锁定图标统一走 Lucide；open=true 时略透明表示「未锁」。 */
function LockGlyph({ open, className }: { open?: boolean; className?: string }) {
  return <IconLock size={13} className={`${open ? "opacity-45" : ""} ${className ?? ""}`} />;
}

/** 功能注释：去掉创作者自定义 label 里残留的 Emoji / 装饰符，改由线性图标表达。 */
function stripFieldEmoji(s: string) {
  return s.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]+/u, "").trim() || s;
}

/** 功能注释：建角字段头左侧线性图标（禁止人物/蛋糕/证件类 Emoji）。 */
const FIELD_ICONS: Record<string, typeof IconUser> = {
  gender: IconUser,
  birthday: IconCake,
  identity: IconIdCard,
  name: IconUser,
};

/* 建角文案模板渲染：占位值高亮，{lock} 显示为与锁定按钮一致的图标 */
function Tpl({ text, vars }: { text: string; vars: Record<string, string> }) {
  return <>{fillParts(text, vars).map((p, i) => p.lock
    ? <LockGlyph key={i} className="mx-0.5 inline -mt-0.5 text-jade" />
    : p.hl ? <span key={i} className="font-medium text-jade">{p.t}</span> : <span key={i}>{p.t}</span>)}</>;
}

/* 建角分组卡：一组相关字段放一张卡，标题 + 一句说明 */
function Card({ title, desc, children }: { title?: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-paper-2/55 p-3.5">
      {title && (
        <div className="mb-3">
          <h3 className="flex items-center gap-1.5 text-[13.5px] font-black tracking-wide text-ink"><span aria-hidden className="h-3.5 w-1 rounded-full bg-gradient-to-b from-[var(--coral)] to-[var(--jade)]" />{title}</h3>
          {desc && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{desc}</p>}
        </div>
      )}
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

/* 选项说明 / 开局效果：选中项下面的一行补充 */
function Note({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "jade" | "gold" }) {
  if (!children) return null;
  const c = tone === "jade" ? "bg-jade/[0.07] text-jade" : tone === "gold" ? "bg-gold/[0.08] text-gold" : "bg-ink/[0.04] text-ink-soft";
  return <p className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug ${c}`}>{children}</p>;
}

/* 建角池与文案全部来自模组槽（styles / identities / backgrounds / directions / school / parentJobs / creation） */
// 选项去重：模组里重复的选项只出现一次（也保证下拉 key 唯一）
const uniq = (a: string[]): string[] => [...new Set(a.map((o) => o.trim()).filter(Boolean))];
const opts = (a: string[] | undefined): string[] => (a?.length ? uniq(a) : []);
/* 全部可掷骰字段（「重掷全部」用，锁定的自动跳过） */
const ALL_KEYS = ["name", "gender", "identity", "styleId", "description", "backgroundId", "klass", "background", "fatherJob", "motherJob", "birthday"];

/* 单页自设：无分步，全部字段平铺 */
const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const pickId = <T extends { id: string }>(a: T[]): string => rand(a)?.id ?? "";

/* 合约配色：内容池 tone → 界面色板 */
const TONE: Record<string, { text: string; ring: string; soft: string }> = {
  coral: { text: "text-coral", ring: "border-coral", soft: "bg-coral/10" },
  jade: { text: "text-jade", ring: "border-jade", soft: "bg-jade/10" },
  gold: { text: "text-gold", ring: "border-gold", soft: "bg-gold/10" },
};

export default function CharacterCreate() {
  const { go, startNew } = useGame();
  const { mods: allMods, selection: modSel } = useMods();
  const [modsOpen, setModsOpen] = useState(false);
  const [, setPathLockTick] = useState(0);
  useEffect(() => {
    const h = () => setPathLockTick((n) => n + 1);
    window.addEventListener("star:path-locks", h);
    return () => window.removeEventListener("star:path-locks", h);
  }, []);
  // 建角页预览所选世界观：星座 / 八维叫法 / 开局合约等内容槽都按「所选」读取
  useEffect(() => { commitSelection(); }, [modSel.world, modSel.addons.join("|")]);
  const seed = randomPlayerSeed();
  const cc = creationCopy();
  const SCHOOL = schoolName();
  const PATHS = cc.paths ?? [];
  // 人物线路：默认选中第一条开放路径；创作者开启「开局弹窗」时进页即弹出让玩家挑，关闭则直接沿用默认
  const pickableOf = (c: typeof cc) => (c.paths ?? []).some((p) => p.open) && c.pathPicker !== "off";
  const PICKABLE = pickableOf(cc);
  const [pathId, setPathId] = useState<string | null>(PATHS.find((p) => p.open)?.id ?? "free");
  // 建角向导：路径（创作者开启时）→ 人设（身份 · 天赋形象 · 家世一页填完）→ 开局（签约 · 游玩偏好 · 世界规则）；关掉弹窗不丢进度
  const [wizOpen, setWizOpen] = useState(true);
  const [stepK, setStepK] = useState<string>(PICKABLE ? "path" : "who");
  const topRef = useRef<HTMLDivElement>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: seed.name!,
    age: cc.fixedAge ?? seed.age!, // 世界可固定年龄（娱乐圈 · 科班出道：22 岁）
    gender: seed.gender!,
    identity: seed.identity!,
    background: seed.background!,
    klass: seed.klass!,
    description: seed.description!,
    fatherJob: rand(PARENT_JOBS),
    motherJob: rand(PARENT_JOBS),
    birthMonth: 1 + Math.floor(Math.random() * 12),
    birthDay: 1 + Math.floor(Math.random() * 28),
    extraKey: "",
    extraVal: "",
    avatar: "",
    styleId: STYLES[0]?.id ?? "",
    identityId: PATHS.find((p) => p.open)?.id ?? IDENTITIES[0]?.id ?? "",
    backgroundId: BACKGROUNDS[0]?.id ?? "",
    directionId: DIRECTIONS[0]?.id ?? "",
  });
  /* 选项联动：人物线路 → 身份/家世/阶层；家庭背景 → 阶层/家世/父母职业。交集为空时退回全集，绝不出现空下拉 */
  const narrow = (all: string[], ...subs: (string[] | undefined)[]) => {
    let out = all;
    for (const sub of subs) if (sub?.length) { const n = out.filter((o) => sub.includes(o)); if (n.length) out = n; }
    return out;
  };
  const pLink = cc.pathOpts?.[pathId ?? form.identityId] ?? {};
  const bLink = cc.bgLinks?.[form.backgroundId] ?? {};
  const curPath = pathId ?? form.identityId;
  // 逐选项联动（编辑器「建角字段」）：限定了路径 / 家庭背景的选项只在匹配时出现
  const linked = (cat: CreationOptCat, all: string[]) => {
    const m = cc.optLinks?.[cat];
    if (!m) return all;
    const n = all.filter((o) => { const l = m[o]; return !l || ((!l.paths?.length || l.paths.includes(curPath)) && (!l.bgs?.length || l.bgs.includes(form.backgroundId))); });
    return n.length ? n : all;
  };
  const IDENTITY_OPTS = linked("identityOpts", narrow(opts(cc.identityOpts), pLink.identityOpts));
  const BG_OPTS = linked("backgroundOpts", narrow(opts(cc.backgroundOpts), pLink.backgroundOpts, bLink.backgroundOpts));
  const KLASS_OPTS = linked("klassOpts", narrow(opts(cc.klassOpts), pLink.klassOpts, bLink.klassOpts));
  const JOB_OPTS = linked("parentJobs", narrow(uniq(PARENT_JOBS), pLink.parentJobs, bLink.parentJobs));
  /* 内置字段配置：改名 / 隐藏 / 锁定为固定值 */
  const bf = (k: BuiltinFieldKey): BuiltinFieldCfg => cc.builtin?.[k] ?? {};
  const bl = (k: BuiltinFieldKey, fb: string) => bf(k).label || fb;
  const shown = (k: BuiltinFieldKey) => !bf(k).hidden;
  const fixedKey = JSON.stringify(cc.builtin ?? {});
  useEffect(() => {
    const keys: BuiltinFieldKey[] = ["name", "gender", "identity", "description", "klass", "background", "fatherJob", "motherJob"];
    const patch: Record<string, string> = {};
    for (const k of keys) { const c = bf(k); if (c.locked && c.value) patch[k] = c.value; }
    if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }));
  }, [fixedKey]);
  /* 创作者自定义字段：按路径 / 家庭背景条件出现 */
  const CUSTOM = (cc.fields ?? []).filter((f) => f.label && (!f.paths?.length || f.paths.includes(curPath)) && (!f.bgs?.length || f.bgs.includes(form.backgroundId)));
  const [customVals, setCustomVals] = useState<Record<string, string>>({});
  const cv = (f: CreationField) => (f.locked ? f.init ?? "" : customVals[f.id] ?? f.init ?? "");
  /* 下拉选项绑定的开局效果（数值 / 文本设定 / NPC 好感 / 开局日期） */
  const identityIdOf = () => (pathId && IDENTITIES.some((o) => o.id === pathId) ? pathId : null) ?? PATHS.find((p) => p.open)?.id ?? "";
  // 玩家可见：选项说明 + 作者配置的开局加成
  const optNote = (o?: Parameters<typeof optFx>[0] & { desc?: string }) => o ? [o.desc, ...fxSummary(optFx(o), { attr: attrName, npc: npcName })].filter(Boolean).join(" · ") : undefined;
  const fxOf = (f: CreationField): OptFx | undefined => (f.type === "select" ? f.optFx?.[cv(f)] : undefined);
  const attrName = (id: string) => selectedSlot("customAttrs")?.find((a) => a.id === id)?.label;
  const npcName = (id: string) => getSelectedWorld().chain.flatMap((m) => m.content.npcs ?? []).find((p) => p.id === id)?.name;
  /* 开局游玩偏好：世界观默认预选，玩家可改；切换世界观时跟着换默认 */
  const playSlot = selectedSlot("play");
  const playKey = JSON.stringify(playSlot ?? {});
  const [prefs, setPrefs] = useState<PlayPrefs>(() => ({ mode: playSlot?.mode, pov: playSlot?.pov }));
  useEffect(() => { setPrefs({ mode: playSlot?.mode, pov: playSlot?.pov }); }, [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 读者自选开局日期（世界观在「时间与推进」里开放后才显示） */
  const worldStart = (selectedSlot("startDate") ?? selectedSlot("calendar")?.startDate ?? "2005.01.03").replace(/[./]/g, "-");
  const [pickDate, setPickDate] = useState("");
  // 手动键入的日期可能超出作者给的范围（date 控件只做提示不拦截）：开局时夹回范围内
  const clampDate = (d: string) => {
    const lo = playSlot?.startDateMin?.replace(/[./]/g, "-"), hi = playSlot?.startDateMax?.replace(/[./]/g, "-");
    return !/^\d{4}-\d{2}-\d{2}$/.test(d) ? worldStart : lo && d < lo ? lo : hi && d > hi ? hi : d;
  };
  // 建角页按世界观本身的开局日期显示，不沿用上一局玩家自选的日期
  useEffect(() => { setStartDateOverride(undefined); }, []);
  // 上游改变后，把已不在可选范围内的下游值换成合法值
  const linkKey = [IDENTITY_OPTS, BG_OPTS, KLASS_OPTS, JOB_OPTS].map((a) => a.join(",")).join("|");
  useEffect(() => {
    setForm((f) => {
      const fix = (v: string, list: string[]) => (list.length && !list.includes(v) ? rand(list) : v);
      const n = { ...f, identity: fix(f.identity, IDENTITY_OPTS), background: fix(f.background, BG_OPTS), klass: fix(f.klass, KLASS_OPTS), fatherJob: fix(f.fatherJob, JOB_OPTS), motherJob: fix(f.motherJob, JOB_OPTS) };
      return (Object.keys(n) as (keyof typeof n)[]).some((k) => n[k] !== f[k]) ? n : f;
    });
  }, [linkKey]);
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [nameStyle, setNameStyle] = useState<NameStyle>("any");
  const [pickName, setPickName] = useState(false);
  // 记录字库生成过的名字：切换性别时，若名字仍是自动生成的就按新性别换一个（手动输入的不动）
  const autoNames = useRef(new Set<string>());
  const genName = (g: string) => { const n = randomName(g as NameGender, nameStyle); autoNames.current.add(n); return n; };
  if (!autoNames.current.size) autoNames.current.add(form.name);
  // 配置了开局阵营 → 合约来自这些阵营（签约即入阵营）；否则按公司名气随机递合约
  const factionOffers = () => factionSigningOffers((cc.startFactions ?? []).filter((f) => f.id && f.name.trim()));
  const [offers, setOffers] = useState<SigningContract[]>(() => { const fo = factionOffers(); return fo.length ? fo : rollSigningOffers(); });
  const boundToFaction = offers.some((o) => o.factionId);
  const [contractId, setContractId] = useState<string>(() => offers[0]?.id ?? "");
  const [joinedRaw, setJoined] = useState<string[]>([]); // 开局勾选加入的势力
  // 所签合约绑定的阵营总是计入「已加入」
  const signedFaction = offers.find((o) => o.id === contractId)?.factionId;
  const joined = signedFaction && !joinedRaw.includes(signedFaction) ? [signedFaction, ...joinedRaw] : joinedRaw;
  const [worldRules, setWorldRulesState] = useState(defaultWorldRules);

  // 切换世界观：按新世界的建角池重置选项（避免残留上一个世界的 id）
  useEffect(() => {
    const c = creationCopy();
    const s0 = randomPlayerSeed();
    const first = (c.paths ?? []).find((p) => p.open)?.id ?? null;
    setOpenDetail(null); // 开局先看路线列表，详情由用户点开
    setPathId(first ?? "free");
    setStepK(pickableOf(c) ? "path" : "who");
    setWizOpen(true);
    setForm((f) => ({
      ...f,
      age: c.fixedAge ?? s0.age!,
      identity: s0.identity!, background: s0.background!, klass: s0.klass!,
      fatherJob: rand(PARENT_JOBS), motherJob: rand(PARENT_JOBS),
      styleId: STYLES[0]?.id ?? "", identityId: first ?? IDENTITIES[0]?.id ?? "",
      backgroundId: BACKGROUNDS[0]?.id ?? "", directionId: DIRECTIONS[0]?.id ?? "",
    }));
  }, [modSel.world, modSel.addons.join("|")]);

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toggleLock = (k: string) => setLocked((l) => ({ ...l, [k]: !l[k] }));

  /** 功能注释：改名时同步人物描述里的旧姓名（模板重填或全文替换），锁定描述则只改 name。 */
  const setPlayerName = (next: string) => {
    setForm((f) =>
      syncPlayerNameChange(f, next, {
        descLocked: locked.description || bf("description").locked,
        seedDescription: cc.seedDescription,
      }),
    );
  };

  /* 单字段掷骰（尊重锁定） */
  const rollField = (k: string) => {
    if (locked[k] || bf(k as BuiltinFieldKey).locked) return;
    const s = randomPlayerSeed();
    switch (k) {
      case "name": setPlayerName(genName(form.gender)); break;
      case "age": if (!cc.fixedAge) upd({ age: s.age! }); break;
      case "gender": {
        const g = s.gender!;
        if (locked.name) upd({ gender: g });
        else setForm((f) => syncPlayerNameChange({ ...f, gender: g }, genName(g), {
          descLocked: locked.description || bf("description").locked,
          seedDescription: cc.seedDescription,
        }));
        break;
      }
      case "identity": if (IDENTITY_OPTS.length) upd({ identity: rand(IDENTITY_OPTS) }); break;
      case "background": if (BG_OPTS.length) upd({ background: rand(BG_OPTS) }); break;
      case "klass": if (KLASS_OPTS.length) upd({ klass: rand(KLASS_OPTS) }); break;
      case "description": upd({ description: s.description! }); break;
      case "styleId": upd({ styleId: pickId(STYLES) }); break;
      case "identityId": upd({ identityId: pickId(IDENTITIES) }); break;
      case "backgroundId": upd({ backgroundId: pickId(BACKGROUNDS) }); break;
      case "directionId": upd({ directionId: pickId(DIRECTIONS) }); break;
      case "fatherJob": upd({ fatherJob: rand(JOB_OPTS) }); break;
      case "motherJob": upd({ motherJob: rand(JOB_OPTS) }); break;
      case "birthday": upd({ birthMonth: 1 + Math.floor(Math.random() * 12), birthDay: 1 + Math.floor(Math.random() * 28) }); break;
    }
  };

  /* 重掷所有未锁定字段 */
  const rerollAll = () => ALL_KEYS.forEach(rollField);


  const begin = () => {
    const zodiac = zodiacOf(form.birthMonth, form.birthDay);
    const extra = [
      ...(selectedFeature("career") && path?.name ? [{ label: "人物线路", value: path.name }] : []),
      ...(selectedFeature("career") && SCHOOL && (!PICKABLE || pathId === "kban") ? [{ label: "母校", value: SCHOOL }] : []),
      { label: "生日", value: `${form.birthMonth}月${form.birthDay}日` },
      ...(shown("zodiac") ? [{ label: bl("zodiac", "星座"), value: zodiac.name }] : []),
      ...(shown("fatherJob") ? [{ label: bl("fatherJob", "父亲职业"), value: form.fatherJob }] : []),
      ...(shown("motherJob") ? [{ label: bl("motherJob", "母亲职业"), value: form.motherJob }] : []),
      ...(shown("extra") && form.extraKey && form.extraVal ? [{ label: form.extraKey, value: form.extraVal }] : []),
      ...CUSTOM.filter((f) => cv(f).trim()).map((f) => {
        const note = fxOf(f)?.note?.trim();
        return { label: f.label, value: [cv(f), note && `（${note}）`, f.desc && `（${f.desc}）`].filter(Boolean).join("") };
      }),
    ];
    const fx = [
      ...CUSTOM.map(fxOf),
      // 建角选项自带的开局加成（作者在编辑器里配置；未配置 = 只有文字设定）
      shown("style") ? optFx(STYLES.find((o) => o.id === form.styleId)) : undefined,
      optFx(IDENTITIES.find((o) => o.id === identityIdOf())),
      shown("family") ? optFx(BACKGROUNDS.find((o) => o.id === form.backgroundId)) : undefined,
      shown("direction") ? optFx(DIRECTIONS.find((o) => o.id === form.directionId)) : undefined,
      shown("zodiac") ? optFx(zodiac) : undefined,
    ].filter((x): x is OptFx => !!x);
    const contract = career ? offers.find((c) => c.id === contractId) : undefined;
    const identityId = identityIdOf();
    const player: Player = {
      name: form.name || "无名",
      age: form.age,
      gender: form.gender,
      identity: form.identity,
      background: form.background,
      klass: form.klass,
      description: form.description,
      avatar: form.avatar,
      attrs: DEFAULT_ATTRS.map((a) => ({ ...a })),
      history: [],
      extra,
    };
    commitSelection(); // 所选世界观 / 叠加包在开新局时正式生效
    startNew(
      player,
      { name: player.name, styleId: shown("style") ? form.styleId : "", identityId, backgroundId: shown("family") ? form.backgroundId : "", directionId: shown("direction") && DIRECTIONS.some((o) => o.id === form.directionId) ? form.directionId : "", zodiacId: shown("zodiac") ? zodiac.id : undefined },
      contract,
      worldRules,
      {
        fx,
        playPrefs: prefs.mode || prefs.pov ? prefs : undefined,
        startDate: playSlot?.pickStartDate && pickDate ? clampDate(pickDate).replace(/-/g, ".") : undefined,
        pathNpcs: (PATHS.find((p) => p.id === pathId) ?? PATHS.find((p) => p.open))?.npcs,
        route: PATHS.find((p) => p.id === pathId) ?? PATHS.find((p) => p.open),
        factions: cc.startFactions,
        joined,
      },
    );
  };

  const field = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition focus:border-jade focus:ring-2 focus:ring-jade/15 disabled:opacity-70";
  /* 功能注释：pr-8 给自定义下拉箭头留空，避免箭头压住文字 */
  const selectField = `${field} pr-8`;

  /* 字段头：线性图标 · 名称 · 小字说明 · 右侧锁定 / 单独重掷（创作者锁定的显示「固定」） */
  const Head = ({ k, text, hint }: { k: string; text: string; hint?: string }) => {
    const I = FIELD_ICONS[k];
    const label = stripFieldEmoji(text);
    return (
      <div className="mb-1.5 flex min-w-0 items-center gap-2">
        {I && <I size={14} className="shrink-0 text-coral" />}
        <span className="shrink-0 text-[12.5px] font-bold text-ink">{label}</span>
        {hint && <span className="min-w-0 truncate text-[10.5px] text-ink-soft">{hint}</span>}
        {bf(k as BuiltinFieldKey).locked ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] text-ink-soft"><LockGlyph />固定</span>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => toggleLock(k)} aria-pressed={!!locked[k]} title={locked[k] ? "已锁定，重掷时保留" : "锁定此项，重掷时保留"} aria-label={locked[k] ? "解锁" : "锁定"}
              className={`grid h-6 w-6 place-items-center rounded-full transition ${locked[k] ? "bg-jade/12 text-jade" : "text-ink-soft/50 hover:bg-ink/5 hover:text-ink"}`}>
              <LockGlyph open={!locked[k]} />
            </button>
            <button type="button" onClick={() => rollField(k)} disabled={locked[k]} title="单独掷一次" aria-label="单独重掷"
              className="grid h-6 w-6 place-items-center rounded-full text-ink-soft/50 transition hover:bg-ink/5 hover:text-jade disabled:opacity-30">
              <IconDice width={13} height={13} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // 当前所选世界观是否有演艺事业线：没有则走通用建角（无人物线路 / 母校 / 经纪合约）
  const career = selectedFeature("career");
  const selWorld = getSelectedWorld().chain[0];
  const okToFinish = !career || !!contractId;
  const path = PATHS.find((p) => p.id === pathId);
  // 人物线路 · 预设主角：选中后用 TA 的档案填好自设页（玩家仍可微调）
  const heroId = path?.hero;
  useEffect(() => {
    const h = heroId ? worldPersonById(heroId) : undefined;
    if (!h) return;
    setForm((f) => ({
      ...f,
      name: h.name || f.name,
      ...(h.age ? { age: String(h.age) } : {}),
      ...(h.gender === "男" || h.gender === "女" ? { gender: h.gender } : {}),
      identity: h.role || f.identity,
      description: h.bio || f.description,
    }));
  }, [heroId]);
  // 文案占位：世界名 / 路径 / 城市 / 年份季节 / 母校…随世界观自动替换
  const tv = creationVars({ world: selWorld?.name, path: path?.name });
  const pv = (name: string) => ({ ...tv, path: name });
  const zodiac = zodiacOf(form.birthMonth, form.birthDay);
  const hide = cc.pathHide ?? {};
  const pathWord = fillText(cc.pathTitle, tv).replace(/^选择/, "") || "开局路径";
  const formTitle = fillText(cc.formTitle || (path ? "{path} · 自设" : "{world} · 自设"), { ...tv, world: tv.world || "角色" });
  const hasMore = CUSTOM.length > 0 || shown("extra");

  /* —— 向导步骤：同类内容放一页，最多三步 —— */
  const STEPS = [
    ...(PICKABLE ? [{ k: "path", label: pathWord.length > 4 ? "路径" : pathWord }] : []),
    { k: "who", label: "人设" },
    { k: "setup", label: "开局" },
  ];
  const si = Math.max(0, STEPS.findIndex((x) => x.k === stepK));
  const step = STEPS[si];
  const last = si === STEPS.length - 1;
  const goStep = (k: string) => setStepK(k);
  useEffect(() => { topRef.current?.closest(".modal-sheet")?.scrollTo({ top: 0 }); }, [stepK, wizOpen]);

  /* ① 路径：卡片里展示哪些内容由创作者决定 */
  const stepPath = (
    <div className="space-y-2.5">
      {cc.pathIntro && <p className="text-[12.5px] leading-relaxed text-ink-soft"><Tpl text={cc.pathIntro} vars={tv} /></p>}
      {PATHS.filter((p) => p.open || !hide.soon).map((p) => {
        if (!p.open) {
          return (
            <div key={p.id} className="rounded-2xl border border-dashed border-line/70 bg-paper/40 px-3.5 py-3 opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-ink">{p.name}</span>
                <Chip>{p.lockTag || "未解锁"}</Chip>
                <span className="ml-auto truncate text-[11px] text-ink-soft">{fillText(p.tag, pv(p.name))}</span>
                <button
                  type="button"
                  onClick={() => { savePathLock(p.id, { open: true }); setPathId(p.id); setOpenDetail(p.id); }}
                  className="shrink-0 rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[10.5px] font-semibold text-jade transition hover:bg-jade hover:text-white"
                >
                  解锁
                </button>
              </div>
              {p.blurb && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{fillText(p.blurb, pv(p.name))}</p>}
              {p.lockHint && <p className="mt-1 text-[11.5px] text-coral/90">解锁条件：{fillText(p.lockHint, pv(p.name))}</p>}
            </div>
          );
        }
        const expanded = openDetail === p.id;
        const current = pathId === p.id;
        const rels = hide.npcs ? [] : (p.npcs ?? []).filter((n) => n.id && npcName(n.id));
        // 按建角表单的真实配置生成（隐藏的不列、锁定的归入「固定」），不再用写死的文案
        const free = (k: BuiltinFieldKey, fb: string) => (shown(k) && !bf(k).locked ? [bl(k, fb)] : []);
        const lockedRow = (k: BuiltinFieldKey, fb: string) => (shown(k) && bf(k).locked && bf(k).value ? [`${bl(k, fb)}：${bf(k).value}`] : []);
        const pFields = (cc.fields ?? []).filter((f) => f.label && (!f.paths?.length || f.paths.includes(p.id)));
        const choose = hide.choose ? [] : [
          ...free("name", "姓名"), ...free("gender", "性别"), "头像", "出生月日 → 星座",
          ...free("fatherJob", "父亲职业"), ...free("motherJob", "母亲职业"),
          ...(BACKGROUNDS.length && shown("family") ? [bl("family", "家庭背景")] : []), ...(KLASS_OPTS.length ? free("klass", "出身阶层") : []), ...free("background", "家世叙述"),
          ...(STYLES.length ? ["外形风格"] : []), ...free("description", "人设描述"),
          ...(career ? ["签约经纪公司"] : []),
          ...pFields.filter((f) => !f.locked).map((f) => f.label),
        ];
        const fixed = hide.fixed ? [] : [
          ...(career ? [`人物线路：${p.name}`] : []),
          ...(cc.fixedAge ? [`年龄：固定 ${cc.fixedAge} 岁`] : []),
          ...(career && SCHOOL && (!PICKABLE || p.id === "kban") ? [`母校：${SCHOOL}`] : []),
          ...lockedRow("name", "姓名"), ...lockedRow("gender", "性别"), ...lockedRow("identity", "身份"), ...lockedRow("klass", "出身阶层"),
          ...lockedRow("background", "家世叙述"), ...lockedRow("fatherJob", "父亲职业"), ...lockedRow("motherJob", "母亲职业"),
          ...pFields.filter((f) => f.locked && f.init).map((f) => `${f.label}：${f.init}`),
        ];
        return (
          <div key={p.id} className={`overflow-hidden rounded-2xl border bg-paper-2/70 transition ${current ? "border-jade shadow-[0_0_0_3px_color-mix(in_srgb,var(--jade)_14%,transparent)]" : "border-line"}`}>
            <button type="button" onClick={() => { setPathId(p.id); setOpenDetail(p.id); }} aria-haspopup="dialog" className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left">
              <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${current ? "border-jade" : "border-line"}`} aria-hidden>{current && <span className="h-1.5 w-1.5 rounded-full bg-jade" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{p.name}</span>
                  <span className="ml-auto truncate text-[11px] text-ink-soft">{fillText(p.tag, pv(p.name))}</span>
                </div>
                {p.blurb && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{fillText(p.blurb, pv(p.name))}</p>}
              </div>
              <span className="mt-0.5 shrink-0 text-[11px] text-ink-soft">详情 ›</span>
            </button>
            {expanded && (
              <Modal title={p.name} onClose={() => setOpenDetail(null)}>
              <div className="text-[13px] leading-relaxed">
                {p.tag && <p className="mb-2 text-[11.5px] text-ink-soft">{fillText(p.tag, pv(p.name))}</p>}
                {!hide.about && p.about && <p className="text-ink/90">{fillText(p.about, pv(p.name))}</p>}
                {(choose.length > 0 || fixed.length > 0) && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {choose.length > 0 && <div>
                    <p className="mb-1 text-[11px] font-bold tracking-wide text-jade">▌可自由决定</p>
                    <ul className="space-y-0.5 text-ink-soft">{choose.map((c, ci) => <li key={`${ci}-${c}`}>· {fillText(c, pv(p.name))}</li>)}</ul>
                  </div>}
                  {fixed.length > 0 && <div>
                    <p className="mb-1 text-[11px] font-bold tracking-wide text-coral">▌固定 · 不可更改</p>
                    <ul className="space-y-0.5 text-ink-soft">{fixed.map((f, fi) => <li key={`${fi}-${f}`}>· {fillText(f, pv(p.name))}</li>)}</ul>
                  </div>}
                </div>}
                {rels.length > 0 && <div className="mt-3">
                  <p className="mb-1 text-[11px] font-bold tracking-wide text-gold">▌开局人际</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rels.map((n) => (
                      <span key={n.id} className="ui-chip">
                        <b className="font-semibold text-ink">{npcName(n.id)}</b>
                        {n.relation && <span className="text-ink-soft">· {n.relation}</span>}
                        {typeof n.rel === "number" && <span className="inline-flex items-center gap-0.5 text-coral"><IconHeart size={12} />{n.rel}</span>}
                        {n.met && <span className="text-jade">已相识</span>}
                      </span>
                    ))}
                  </div>
                </div>}
                {!hide.perks && <RoutePerks className="mt-3" label={p.perksLabel && fillText(p.perksLabel, pv(p.name))} text={p.perks && fillText(cleanPerks(p.perks), pv(p.name))} />}
                <button type="button" onClick={() => { setPathId(p.id); setOpenDetail(null); if (STEPS[si + 1]) goStep(STEPS[si + 1].k); }} className="mt-4 w-full rounded-xl bg-jade py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]">选择「{p.name}」并继续 ›</button>
              </div>
              </Modal>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ② 人设 · 身份：名字 · 年龄性别 · 生日星座 · 登记身份 */
  const stepWho = (
    <>
      <p className="text-[12px] leading-relaxed text-ink-soft"><Tpl text={path?.formIntro || cc.formIntro || "{city} · {year} {season}。一页定型——锁住满意的（{lock}），其余随时重掷。"} vars={tv} /></p>
      {!career && !cc.formIntro && selWorld?.description && <p className="text-[12px] leading-relaxed text-ink-soft">{selWorld.description}</p>}
      <Card title="基本信息">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-6"><Avatar src={form.avatar} name={form.name} size={68} onPick={(d) => upd({ avatar: d })} avatarSlot={selectedSlot("avatars") ?? null} /></div>
          <fieldset disabled={bf("name").locked} className="min-w-0 flex-1">
            <Head k="name" text={bl("name", "姓名")} />
            <input className={field} value={form.name} onChange={(e) => setPlayerName(e.target.value)} placeholder={form.gender === "男" ? "为他取个名字" : "为她取个名字"} />
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <div role="radiogroup" aria-label="名字风格" className="flex rounded-full bg-ink/[0.05] p-0.5">
                {([["any", "不限"], ["modern", "现代"], ["ancient", "古风"]] as const).map(([k, t]) => (
                  <button key={k} type="button" role="radio" aria-checked={nameStyle === k} onClick={() => setNameStyle(k)}
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition ${nameStyle === k ? "bg-paper text-jade shadow-sm" : "text-ink-soft"}`}>{t}</button>
                ))}
              </div>
              <button type="button" disabled={locked.name} onClick={() => setPlayerName(genName(form.gender))}
                className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink transition hover:border-jade hover:text-jade disabled:opacity-40"><IconDice width={11} height={11} />换一个</button>
              <button type="button" disabled={locked.name} onClick={() => setPickName(true)}
                className="rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[10.5px] font-semibold text-jade disabled:opacity-40">字库</button>
            </div>
            {pickName && <NamePicker gender={form.gender as NameGender} value={form.name} onClose={() => setPickName(false)} onPick={(n) => setPlayerName(n)} />}
          </fieldset>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[12.5px] font-bold text-ink">年龄</span>
              {cc.fixedAge && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] text-ink-soft"><LockGlyph />{career && path ? `${path.name}固定` : "固定"}</span>}
            </div>
            <div className={`${field} flex items-center bg-jade/[0.05] font-semibold text-jade`}>{form.age} 岁</div>
          </div>
          {shown("gender") && <fieldset disabled={bf("gender").locked} className="min-w-0">
            <Head k="gender" text={bl("gender", "性别")} />
            <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.05] p-1">
              {["女", "男", "其他"].map((g) => (
                <button key={g} type="button" role="radio" aria-checked={form.gender === g}
                  onClick={() => upd(!locked.name && autoNames.current.has(form.name) ? { gender: g, name: genName(g) } : { gender: g })}
                  className={`rounded-lg py-1.5 text-[13px] font-bold transition ${form.gender === g ? "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white shadow-sm" : "text-ink-soft hover:bg-paper"}`}>{g}</button>
              ))}
            </div>
          </fieldset>}
        </div>
        <div>
          <Head k="birthday" text="生日" hint={shown("zodiac") ? `决定${stripFieldEmoji(bl("zodiac", "星座"))}` : undefined} />
          <div className="grid grid-cols-2 gap-2">
            <select className={selectField} value={form.birthMonth} onChange={(e) => upd({ birthMonth: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select className={selectField} value={form.birthDay} onChange={(e) => upd({ birthDay: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d} 日</option>)}
            </select>
          </div>
          {shown("zodiac") && <div className="mt-2 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] px-3 py-2">
            <ZodiacSign id={zodiac.id} width={20} height={20} className="shrink-0 text-gold" />
            <span className="shrink-0 text-[13px] font-bold text-ink">{zodiac.name}</span>
            <span className="ml-auto min-w-0 truncate text-right text-[12px] font-medium text-gold">{optNote({ ...zodiac, desc: zodiac.bonus })}</span>
          </div>}
        </div>
        {shown("identity") && (IDENTITY_OPTS.length ? (
          <fieldset disabled={bf("identity").locked} className="min-w-0">
            <Head k="identity" text={bl("identity", cc.identityLabel ?? "身份")} hint={PICKABLE && path ? `「${path.name}」路线下的细分身份，登记进履历` : "登记进履历，AI 不会擅改"} />
            <select className={selectField} value={form.identity} onChange={(e) => upd({ identity: e.target.value })}>
              {IDENTITY_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </fieldset>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center gap-2"><span className="text-[12.5px] font-bold text-ink">{bl("identity", "身份")}</span><span className="text-[10.5px] text-ink-soft">登记进履历，AI 不会擅改</span></div>
            <input disabled={bf("identity").locked} className={field} value={form.identity} onChange={(e) => upd({ identity: e.target.value })} placeholder="例如：高二（3）班转学生" />
          </div>
        ))}
      </Card>
    </>
  );

  /* ② 人设 · 天赋形象：外形风格 · 人物描述（线路已在上一步选定，自设页不再重复展示「人物线路选择」） */
  const stepTalent = (
    <>
      {((STYLES.length > 0 && shown("style")) || (DIRECTIONS.length > 0 && shown("direction")) || shown("description")) && (
        <Card title="形象气质">
          {STYLES.length > 0 && shown("style") && (
            <div>
              <Head k="styleId" text={bl("style", "外形风格")} />
              <select className={selectField} value={form.styleId} onChange={(e) => upd({ styleId: e.target.value })}>
                {STYLES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <Note>{optNote(STYLES.find((o) => o.id === form.styleId))}</Note>
            </div>
          )}
          {DIRECTIONS.length > 0 && shown("direction") && (
            <div>
              <Head k="directionId" text={bl("direction", "职业方向")} />
              <select className={selectField} value={form.directionId} onChange={(e) => upd({ directionId: e.target.value })}>
                {DIRECTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <Note>{optNote(DIRECTIONS.find((o) => o.id === form.directionId))}</Note>
            </div>
          )}
          {shown("description") && <fieldset disabled={bf("description").locked} className="min-w-0">
            <Head k="description" text={bl("description", "人物描述")} hint="性格 · 外貌 · 梦想 · 过去" />
            <textarea className={`${field} h-24 resize-none leading-relaxed`} value={form.description} onChange={(e) => upd({ description: e.target.value })} placeholder="性格、外貌、梦想、隐藏的过去……都会影响 AI 的演绎。" />
          </fieldset>}
        </Card>
      )}
    </>
  );

  /* ② 人设 · 家世：家庭背景 · 阶层 · 家世叙述 · 双亲 · 更多设定 */
  const stepFamily = (
    <>
      {((BACKGROUNDS.length > 0 && shown("family")) || (KLASS_OPTS.length > 0 && shown("klass")) || shown("background")) && (
        <Card title="家庭出身" desc={BACKGROUNDS.some((o) => optFx(o)) ? "影响开局资源与剧情底色" : "决定人物的剧情底色"}>
          {BACKGROUNDS.length > 0 && shown("family") && (
            <div>
              <Head k="backgroundId" text={bl("family", "家庭背景")} hint={BACKGROUNDS.some((o) => optFx(o)) ? "影响开局资源" : undefined} />
              <select className={selectField} value={form.backgroundId} onChange={(e) => upd({ backgroundId: e.target.value })}>
                {BACKGROUNDS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <Note tone="gold">{optNote(BACKGROUNDS.find((o) => o.id === form.backgroundId))}</Note>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {KLASS_OPTS.length > 0 && shown("klass") && (
              <fieldset disabled={bf("klass").locked} className="min-w-0">
                <Head k="klass" text={bl("klass", "出身阶层")} hint="叙事底色" />
                <select className={selectField} value={form.klass} onChange={(e) => upd({ klass: e.target.value })}>
                  {KLASS_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </fieldset>
            )}
            {shown("background") && <fieldset disabled={bf("background").locked} className="min-w-0">
              <Head k="background" text={bl("background", "家世叙述")} />
              {BG_OPTS.length ? (
                <select className={selectField} value={form.background} onChange={(e) => upd({ background: e.target.value })}>
                  {BG_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input className={field} value={form.background} onChange={(e) => upd({ background: e.target.value })} placeholder="例如：普通工薪家庭" />
              )}
            </fieldset>}
          </div>
        </Card>
      )}
      {(shown("fatherJob") || shown("motherJob")) && (
        <Card title="双亲" desc={cc.parentNote}>
          <div className="grid grid-cols-2 gap-3">
            {shown("fatherJob") && <fieldset disabled={bf("fatherJob").locked} className="min-w-0">
              <Head k="fatherJob" text={bl("fatherJob", "父亲职业")} />
              <select className={selectField} value={form.fatherJob} onChange={(e) => upd({ fatherJob: e.target.value })}>
                {JOB_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </fieldset>}
            {shown("motherJob") && <fieldset disabled={bf("motherJob").locked} className="min-w-0">
              <Head k="motherJob" text={bl("motherJob", "母亲职业")} />
              <select className={selectField} value={form.motherJob} onChange={(e) => upd({ motherJob: e.target.value })}>
                {JOB_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </fieldset>}
          </div>
        </Card>
      )}
      {hasMore && (
        <Card title="更多设定" desc="写进角色档案，AI 会参考">
          {CUSTOM.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CUSTOM.map((f, fi) => {
                const set = (v: string) => setCustomVals((m) => ({ ...m, [f.id]: v }));
                const val = cv(f);
                const fxs = fxSummary(fxOf(f), { attr: attrName, npc: npcName });
                return (
                  <fieldset key={`${f.id}-${fi}`} disabled={f.locked} className={`min-w-0 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[12.5px] font-bold text-ink">{f.label}</span>
                      {f.locked && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] text-ink-soft"><LockGlyph />固定</span>}
                    </div>
                    {f.type === "select" ? (
                      <>
                        <select className={selectField} value={val} onChange={(e) => set(e.target.value)}>
                          {!val && <option value="">请选择</option>}
                          {uniq(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
                        </select>
                        {fxs.length > 0 && <Note tone="jade">开局：{fxs.join(" · ")}</Note>}
                      </>
                    ) : f.type === "textarea" ? (
                      <textarea className={`${field} h-20 resize-none`} value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                    ) : f.type === "number" ? (
                      <input type="number" className={field} value={val} min={f.min} max={f.max} placeholder={f.placeholder}
                        onChange={(e) => { const n = Number(e.target.value); set(e.target.value === "" ? "" : String(Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n)))); }} />
                    ) : (
                      <input className={field} value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                    )}
                  </fieldset>
                );
              })}
            </div>
          )}
          {shown("extra") && (
            <div>
              <div className="mb-1.5 flex items-center gap-2"><span className="text-[12.5px] font-bold text-ink">{bl("extra", "自定义一条")}</span><span className="text-[10.5px] text-ink-soft">可留空</span></div>
              <div className="grid grid-cols-[2fr_3fr] gap-2">
                <input className={field} value={form.extraKey} onChange={(e) => upd({ extraKey: e.target.value })} placeholder="名称，如：座右铭" aria-label="自定义字段名" />
                <input className={field} value={form.extraVal} onChange={(e) => upd({ extraVal: e.target.value })} placeholder="内容，如：越安静，越锋利" aria-label="自定义字段内容" />
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );

  /* ③ 开局 · 游玩偏好 · 开局日期 · 世界规则 */
  const stepSetup = (
    <>
      <Card title="游玩偏好" desc="开局后在设置里仍可修改">
        <PlayPrefsPicker value={prefs} onChange={setPrefs} />
        {playSlot?.pickStartDate && (
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-ink">开局日期</span>
            <input type="date" className={field} value={pickDate || worldStart}
              min={playSlot.startDateMin?.replace(/[./]/g, "-")} max={playSlot.startDateMax?.replace(/[./]/g, "-")}
              onChange={(e) => setPickDate(e.target.value)} />
            <Note>故事从这一天开始；周结算、节日、固定事件与年龄都会按这一天对齐日历。</Note>
          </label>
        )}
      </Card>
      <Card title="世界规则" desc="恋爱、婚姻、继承与社会秩序——决定这个世界怎么看待你">
        <WorldRuleCards rules={worldRules} onChange={setWorldRulesState} female={!/男/.test(form.gender ?? "女")} compact />
      </Card>
    </>
  );

  /* ③ 开局 · 势力：创作者在「人物线路」编辑器里自设，可多选（受上限约束）；不选也能开局 */
  const SF = (cc.startFactions ?? []).filter((f) => f.id && f.name.trim());
  const sfMax = cc.factionPickMax && cc.factionPickMax > 0 ? cc.factionPickMax : SF.length;
  const stepFactions = SF.length > 0 && (
    <Card title="加入势力" desc={<>勾选开局就加入的势力{sfMax < SF.length ? `（最多 ${sfMax} 个）` : ""}。加入后获得初始声望，成员态度、店铺价格与剧情都会随之变化；也可以都不选，做个自由人。<span className="mt-1 block text-[11.5px] text-ink-soft">{boundToFaction ? "签约的经纪公司就是你的东家阵营，会自动加入；其余势力可按需再选。" : "势力是你的人脉圈子，与经纪合约互不绑定。"}</span></>}>
      <div className="grid gap-2 sm:grid-cols-2">
        {SF.map((f) => {
          const on = joined.includes(f.id);
          const isBoss = f.id === signedFaction; // 签约东家：由合约决定，不能在这里取消
          const full = !on && joined.length >= sfMax;
          return (
            <label key={f.id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${on ? "border-jade bg-jade/5 shadow-[0_0_0_3px_color-mix(in_srgb,var(--jade)_12%,transparent)]" : "border-line bg-paper-2/60 hover:border-jade/50"} ${full ? "cursor-not-allowed opacity-50" : ""}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--jade)]" checked={on} disabled={full || isBoss}
                onChange={() => setJoined((j) => (on ? j.filter((x) => x !== f.id) : [...j, f.id]))} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <b className="text-[14px] text-ink">{f.name}</b>
                  {isBoss && <span className="rounded-full bg-coral/12 px-1.5 py-px text-[10.5px] font-bold text-coral">签约东家</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-jade-deep">初始声望 {f.rep ?? 20}</span>
                </span>
                {f.desc && <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-soft">{f.desc}</span>}
                {!!f.tags?.length && <span className="mt-1 flex flex-wrap gap-1">{f.tags.map((t) => <span key={t} className="rounded-full bg-ink/[0.05] px-1.5 py-px text-[10.5px] text-ink-soft">{t}</span>)}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );

  /* ③ 开局 · 经纪合约（有演艺事业时，排在开局页最上面） */
  const stepSign = (
    <Card title="经纪合约" desc={<>{offers.length || "几"} 家经纪公司递来合约。<span className="font-semibold text-ink">三年之内替公司回本</span>，你才算真正立住脚——挑一份签下去。<span className="mt-1 block text-[11.5px] text-ink-soft">{boundToFaction ? "递合约的就是本世界的各大势力：签下哪家，就加入哪个阵营——它的成员态度、资源与剧情都会向你倾斜。" : "合约决定你的东家、分成与回本压力，按公司名气递来；不满意可以「换几家公司」。"}</span></>}>
      {!boundToFaction && <div className="-mt-1 mb-1 flex justify-end">
        <button type="button" onClick={() => { const o = rollSigningOffers(); setOffers(o); setContractId(o[0]?.id ?? ""); }}
          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:text-ink">
          <IconDice width={12} height={12} />换几家公司
        </button>
      </div>}
      {offers.map((c) => {
        const on = c.id === contractId;
        const t = TONE[c.tone] ?? TONE.jade;
        return (
          <button key={c.id} type="button" onClick={() => setContractId(c.id)} aria-pressed={on}
            className={`w-full rounded-2xl border p-3.5 text-left transition ${on ? `${t.ring} ${t.soft} shadow-sm` : "border-line bg-paper hover:border-ink-soft/40"}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? t.ring : "border-line"}`} aria-hidden>{on && <span className={`h-1.5 w-1.5 rounded-full bg-current ${t.text}`} />}</span>
              <span className="text-[15px] font-bold text-ink">{c.company}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${t.soft} ${t.text}`}>{c.focusLabel}</span>
              <span className="ml-auto truncate text-[11px] text-ink-soft">{c.companyStyle}</span>
            </div>
            <p className="mb-2 text-[12.5px] leading-relaxed text-ink-soft">{c.blurb}</p>
            {c.prestige != null && (
              <div className="mb-2 flex items-center gap-2 text-[11px] text-ink-soft">
                <span className="shrink-0">业内声望</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]"><span className={`block h-full rounded-full bg-current ${t.text}`} style={{ width: `${c.prestige}%` }} /></span>
                <span className="w-6 text-right font-semibold tabular-nums text-ink">{c.prestige}</span>
              </div>
            )}
            {c.boss?.quote && <p className="mb-3 border-l-2 border-line pl-2 text-[11.5px] italic leading-relaxed text-ink-soft">「{c.boss.quote}」<span className="not-italic">—— {c.boss.name}</span></p>}
            <ContractTerms c={c} />
          </button>
        );
      })}
    </Card>
  );

  // 人设一页填完（「重掷」只动这一页）；开局页合约在上，偏好与规则在下
  const body: Record<string, ReactNode> = {
    path: stepPath,
    who: <div className="space-y-3">{stepWho}{stepTalent}{stepFamily}</div>,
    setup: <div className="space-y-3">{career && stepSign}{stepFactions}{stepSetup}</div>,
  };

  const wizard = wizOpen ? (
    <Modal title={step.k === "path" ? (fillText(cc.pathTitle, tv) || "选择开局") : formTitle} onClose={() => setWizOpen(false)} heavyBackdrop>
      <div ref={topRef} />
      {/* 步骤条：可直接点跳到任一步 */}
      <div className="-mx-1 mb-3 flex items-center gap-2">
        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
          {STEPS.map((x, i) => {
            const on = i === si, done = i < si;
            return (
              <li key={x.k} className="flex shrink-0 items-center gap-1">
                {i > 0 && <span aria-hidden className={`h-px w-4 ${done || on ? "bg-jade/60" : "bg-line"}`} />}
                {/* 最多三步：每步都显示名称（已完成打勾） */}
                <button type="button" onClick={() => goStep(x.k)} aria-current={on ? "step" : undefined} aria-label={`第 ${i + 1} 步：${x.label}`}
                  className={`flex items-center gap-1 rounded-full p-0.5 pr-2.5 text-[11.5px] font-semibold transition ${on ? "bg-jade text-white" : done ? "text-jade hover:bg-jade/10" : "text-ink-soft hover:bg-ink/5"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10.5px] tabular-nums ${on ? "bg-white/25" : done ? "bg-jade/15" : "bg-ink/[0.06]"}`}>{done ? <IconCheck size={12} /> : i + 1}</span>
                  {x.label}
                </button>
              </li>
            );
          })}
        </ol>
        {step.k === "who" && (
          <button type="button" onClick={rerollAll} title="重掷所有未锁定的项" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-jade/40 bg-jade/10 px-2.5 py-1 text-[11px] font-semibold text-jade transition hover:bg-jade/20">
            <IconDice width={13} height={13} />重掷
          </button>
        )}
      </div>

      {body[step.k]}

      {/* 底部导航：上一步 / 下一步；最后一步开局 */}
      {/* 功能注释：不用 -mb-5 探出父级 padding——嵌入主站时负 margin 会让「下一步」掉出圆角卡片 */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-line/60 bg-paper-2/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex items-center gap-2">
          {si > 0
            ? <button type="button" onClick={() => goStep(STEPS[si - 1].k)} className="ui-btn ui-btn-lg shrink-0">‹ 上一步</button>
            : <button type="button" onClick={() => go("cover")} className="ui-btn ui-btn-lg shrink-0">返回封面</button>}
          {last ? (
            <button type="button" onClick={begin} disabled={!okToFinish} className="ui-btn ui-btn-primary ui-btn-lg min-w-0 flex-1 disabled:opacity-40">
              <IconPlay width={16} height={16} /><span className="truncate">{cc.cta ?? "开启故事"}</span>
            </button>
          ) : (
            <button type="button" onClick={() => goStep(STEPS[si + 1].k)} className="ui-btn ui-btn-primary ui-btn-lg min-w-0 flex-1">
              <span className="truncate">下一步 · {STEPS[si + 1].label}</span> ›
            </button>
          )}
        </div>
      </div>
    </Modal>
  ) : null;

  /* 弹窗背后：建角进度卡，关掉弹窗后可继续 */
  return (
    <div className="paper-grain bg-paper flex min-h-screen items-center justify-center px-5 py-10">
      {wizard}
      {/* 功能注释：向导打开时隐藏背后进度卡，避免遮罩半透明时「返回封面」透出来 */}
      <div
        className={`w-full max-w-sm rounded-[24px] border border-line/70 bg-paper/85 p-6 text-center shadow-[0_16px_40px_-24px_rgba(0,0,0,0.4)] backdrop-blur ${wizOpen ? "invisible pointer-events-none" : ""}`}
        aria-hidden={wizOpen}
      >
        <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-soft">{selWorld?.name ?? "新的人生"}</p>
        <div className="mx-auto mt-4 w-fit"><Avatar src={form.avatar} name={form.name} size={76} editable={false} /></div>
        <h1 className="mt-3 font-serif text-[22px] font-black tracking-wide text-ink">{form.name || "无名"}</h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">{[path?.name, form.age && `${form.age} 岁`, form.gender, shown("zodiac") && zodiac.name].filter(Boolean).join(" · ")}</p>
        <p className="mt-3 text-[12px] text-ink-soft">角色创建中 · 第 {si + 1} / {STEPS.length} 步「{step.label}」</p>
        <button type="button" onClick={() => setWizOpen(true)} className="ui-btn ui-btn-primary ui-btn-lg mt-4 w-full">继续创建</button>
        <button type="button" onClick={() => go("cover")} className="mt-2 text-[12px] text-ink-soft transition hover:text-ink">← 返回封面</button>
      </div>
    </div>
  );
}

function Term({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-paper/80 px-2.5 py-1.5">
      <div className="text-[10px] text-ink-soft">{label}</div>
      <div className={`text-[13px] font-semibold ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function ContractTerms({ c }: { c: SigningContract }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Term label="保底月薪" value={`¥${c.baseSalary.toLocaleString()}`} />
        <Term label="分成" value={`${c.revenueShare}%`} tone="text-jade" />
        <Term label="签约金" value={`¥${c.signBonus.toLocaleString()}`} tone="text-gold" />
        <Term label="违约金" value={`¥${c.penalty.toLocaleString()}`} tone="text-danger" />
        <Term label="信任" value={`+${c.trust}`} />
        <Term label="口碑" value={`${c.reputation >= 0 ? "+" : ""}${c.reputation}`} tone={c.reputation < 0 ? "text-danger" : undefined} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-soft"><b className="font-semibold text-ink">独家条款</b> · {c.exclusive}</p>
    </div>
  );
}
