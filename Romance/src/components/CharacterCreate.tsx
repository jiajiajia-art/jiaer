import { lazyPanel } from "../lib/lazyPanel";
const WorldRuleCards = lazyPanel(() => import("./WorldRulesPanel").then((m) => ({ default: m.WorldRuleCards })));
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { randomPlayerSeed } from "../lib/store";
import { syncPlayerNameChange } from "../lib/syncPlayerName";
import { randomName, type NameGender, type NameStyle } from "../game/names";
import type { PlayPrefs, Player } from "../lib/types";
import PlayPrefsPicker from "./PlayPrefsPicker";
import { fxSummary } from "../game/optFx";
import type { OptFx } from "../game/data";
import { Avatar, Modal } from "./ui";
import { IconCake, IconCheck, IconDiceDuo, IconIdCard, IconLock, IconPlay, IconUser } from "../lib/icons";
import { IDENTITIES, creationCopy, zodiacOf, optFx, defaultWorldRules, type BuiltinFieldCfg, type BuiltinFieldKey, type CreationField } from "../game/data";
import { commitSelection, worldPersonById, getSelectedWorld, selectedFeature, selectedSlot, setStartDateOverride, useMods } from "../mods/registry";
import NamePicker from "./NamePicker";
import { factionSigningOffers, rollSigningOffers, type SigningContract } from "../worlds/star2005/content";
import { creationVars, fillParts, fillText } from "../game/creationText";
import { normalizeGenderOptions } from "../game/creationSystemFields";
import { formatCreatorAttrPreview, rollCreatorAttrStarts, visibleCreatorAttrs } from "../lib/creationItems";
import { shouldShowPathPicker } from "../lib/pathPicker";
import { isAuthorPreview, requestAuthorPreviewEnd } from "../lib/authorPreview";
import { deleteSlot, listSaves, type SaveSlot } from "../lib/store";
import { asModArray } from "../lib/asModArray";

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

/* 建角分组卡：一组相关字段放一张卡，标题 + 一句说明；titleAction 放标题行右侧（如属性整组重掷） */
function Card({ title, desc, titleAction, children }: { title?: string; desc?: ReactNode; titleAction?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-paper-2/55 p-3">
      {title && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-black tracking-wide text-ink">
              <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--coral)] to-[var(--jade)]" />
              {title}
            </h3>
            {titleAction}
          </div>
          {desc && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{desc}</p>}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* 选项说明 / 开局效果：选中项下面的一行补充 */
function Note({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "jade" | "gold" }) {
  if (!children) return null;
  const c = tone === "jade" ? "bg-jade/[0.07] text-jade" : tone === "gold" ? "bg-gold/[0.08] text-gold" : "bg-ink/[0.04] text-ink-soft";
  return <p className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug ${c}`}>{children}</p>;
}

// 选项去重：模组里重复的选项只出现一次（也保证下拉 key 唯一）；脏非数组按空
const uniq = (a: unknown): string[] => [...new Set(asModArray<string>(a).map((o) => String(o ?? "").trim()).filter(Boolean))];
/* 功能注释：重掷只动四个系统字段；旧娱乐圈内置字段已下线 */
const ALL_KEYS = ["name", "gender", "age", "birthday"] as const;

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/* 合约配色：内容池 tone → 界面色板 */
const TONE: Record<string, { text: string; ring: string; soft: string }> = {
  coral: { text: "text-coral", ring: "border-coral", soft: "bg-coral/10" },
  jade: { text: "text-jade", ring: "border-jade", soft: "bg-jade/10" },
  gold: { text: "text-gold", ring: "border-gold", soft: "bg-gold/10" },
};

export default function CharacterCreate() {
  const { startNew, loadState } = useGame();
  const { selection: modSel } = useMods();
  const previewing = isAuthorPreview();
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [continueOpen, setContinueOpen] = useState(false);
  const [, setPathLockTick] = useState(0);
  // 功能注释：封面菜单下线后，读档入口改挂建角页（作者预览不读正式档）
  useEffect(() => {
    if (previewing) return;
    void listSaves().then(setSaves);
  }, [previewing]);
  useEffect(() => {
    const h = () => setPathLockTick((n) => n + 1);
    window.addEventListener("star:path-locks", h);
    return () => window.removeEventListener("star:path-locks", h);
  }, []);
  // 建角页预览所选世界观：星座 / 八维叫法 / 开局合约等内容槽都按「所选」读取
  useEffect(() => { commitSelection(); }, [modSel.world, modSel.addons.join("|")]);
  const seed = randomPlayerSeed();
  const cc = creationCopy();
  // 功能注释：AI 常把 paths/fields/startFactions 写成单对象；一律 asModArray，禁止 .filter / 展开崩建角
  const PATHS = asModArray<NonNullable<typeof cc.paths>[number]>(cc.paths);
  // 功能注释：开放路径 >1 才弹窗自选；仅 1 条直接用，不再看 pathPicker
  const PICKABLE = shouldShowPathPicker(PATHS);
  const [pathId, setPathId] = useState<string | null>(PATHS.find((p) => p.open)?.id ?? "free");
  // 建角向导：路径（多路径时）→ 人设 → 开局；关掉弹窗不丢进度
  const [wizOpen, setWizOpen] = useState(true);
  const [stepK, setStepK] = useState<string>(PICKABLE ? "path" : "who");
  const topRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: seed.name!,
    age: cc.fixedAge ?? seed.age!,
    gender: normalizeGenderOptions(cc.builtin?.gender?.options).includes(seed.gender!) ? seed.gender! : "女",
    description: seed.description!,
    birthMonth: 1 + Math.floor(Math.random() * 12),
    birthDay: 1 + Math.floor(Math.random() * 28),
    avatar: "",
  });
  // 功能注释：自定义字段可按人物线路过滤；系统四项不走线路过滤
  const curPath = pathId ?? "";
  /* 系统字段：只读显示名；旧稿 hidden 对系统四项无效 */
  const bf = (k: BuiltinFieldKey): BuiltinFieldCfg => cc.builtin?.[k] ?? {};
  const bl = (k: BuiltinFieldKey, fb: string) => bf(k).label || fb;
  // 功能注释：建角页预览隐藏项不展示；开局仍按完整 customAttrs 写入
  const creatorAttrs = visibleCreatorAttrs(selectedSlot("customAttrs"));
  const creatorAttrsKey = creatorAttrs.map((a) => a.id).join("|");
  /* 功能注释：属性开局值在建角页先掷好，标题骰子可整组重掷；入局沿用同一批 */
  const [attrStarts, setAttrStarts] = useState<Record<string, number>>(() => rollCreatorAttrStarts(creatorAttrs));
  useEffect(() => {
    setAttrStarts(rollCreatorAttrStarts(creatorAttrs));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在属性 id 集合变化时重掷
  }, [creatorAttrsKey, modSel.world]);
  const rerollAttrs = () => setAttrStarts(rollCreatorAttrStarts(creatorAttrs));
  /* 创作者自定义字段：仅按人物线路过滤；系统四项始终显示、不进此列 */
  const CUSTOM = asModArray<CreationField>(cc.fields).filter((f) => f.label && (!asModArray(f.paths).length || asModArray<string>(f.paths).includes(curPath)));
  const [customVals, setCustomVals] = useState<Record<string, string>>({});
  const cv = (f: CreationField) => (f.locked ? f.init ?? "" : customVals[f.id] ?? f.init ?? "");
  /** 自定义单选/下拉：按人物线路收窄选项（家庭背景池已下线，bgs 条件忽略以免误藏） */
  const customOptions = (f: CreationField) => uniq(f.options ?? []).filter((option) => {
    const link = f.optionLinks?.[option];
    // 功能注释：optionLinks.paths 常被写成对象；asModArray 后再判断，禁止 .includes 崩更多设定
    const linkPaths = asModArray<string>(link?.paths);
    return !link || !linkPaths.length || linkPaths.includes(curPath);
  });
  const identityIdOf = () => (pathId && IDENTITIES.some((o) => o.id === pathId) ? pathId : null) ?? PATHS.find((p) => p.open)?.id ?? "";
  const fxOf = (f: CreationField): OptFx | undefined => (f.type === "select" || f.type === "radio" ? f.optFx?.[cv(f)] : undefined);
  // 功能注释：customAttrs / 合并后的 npcs 都可能是 AI 脏对象；禁止 .find / flatMap 直接啃非数组
  const attrName = (id: string) => asModArray<{ id?: string; label?: string }>(selectedSlot("customAttrs")).find((a) => a.id === id)?.label;
  const npcName = (id: string) => asModArray<{ id?: string; name?: string }>(getSelectedWorld().content.npcs).find((p) => p.id === id)?.name;
  /* 开局游玩偏好：世界观默认预选模式/视角；屏幕方向默认竖屏，换世界观时保留玩家已选方向 */
  const playSlot = selectedSlot("play");
  const playKey = JSON.stringify(playSlot ?? {});
  const [prefs, setPrefs] = useState<PlayPrefs>(() => ({ mode: playSlot?.mode, pov: playSlot?.pov, orient: "portrait" }));
  useEffect(() => {
    setPrefs((p) => ({ mode: playSlot?.mode, pov: playSlot?.pov, orient: p.orient ?? "portrait" }));
  }, [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 功能注释：开局日期只用创作者填的那天；进入建角时清掉上一局可能残留的玩家日期覆盖
  useEffect(() => { setStartDateOverride(undefined); }, []);
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [nameStyle, setNameStyle] = useState<NameStyle>("any");
  const [pickName, setPickName] = useState(false);
  // 记录字库生成过的名字：切换性别时，若名字仍是自动生成的就按新性别换一个（手动输入的不动）
  const autoNames = useRef(new Set<string>());
  const genName = (g: string) => { const n = randomName(g as NameGender, nameStyle); autoNames.current.add(n); return n; };
  if (!autoNames.current.size) autoNames.current.add(form.name);
  // 配置了开局阵营 → 合约来自这些阵营（签约即入阵营）；否则按公司名气随机递合约
  // 功能注释：startFactions.name 偶发非字符串；禁止 .trim 崩建角势力/合约
  const factionOffers = () => factionSigningOffers(asModArray<NonNullable<typeof cc.startFactions>[number]>(cc.startFactions).filter((f) => f.id && String(f.name ?? "").trim()));
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
    // 功能注释：切换世界时 paths 仍可能脏；与首屏 PATHS 一样先 asModArray
    const nextPaths = asModArray<NonNullable<typeof c.paths>[number]>(c.paths);
    const first = nextPaths.find((p) => p.open)?.id ?? null;
    setPathId(first ?? "free");
    setStepK(shouldShowPathPicker(nextPaths) ? "path" : "who");
    setWizOpen(true);
    setForm((f) => ({
      ...f,
      age: c.fixedAge ?? s0.age!,
      gender: normalizeGenderOptions(c.builtin?.gender?.options).includes(s0.gender!) ? s0.gender! : "女",
      description: s0.description!,
      birthMonth: 1 + Math.floor(Math.random() * 12),
      birthDay: 1 + Math.floor(Math.random() * 28),
    }));
  }, [modSel.world, modSel.addons.join("|")]);

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toggleLock = (k: string) => setLocked((l) => ({ ...l, [k]: !l[k] }));

  /** 功能注释：改名时同步人物描述里的旧姓名（模板重填或全文替换）。 */
  const setPlayerName = (next: string) => {
    setForm((f) =>
      syncPlayerNameChange(f, next, {
        descLocked: locked.description,
        seedDescription: cc.seedDescription,
      }),
    );
  };

  /* 单字段掷骰（尊重锁定）；只覆盖系统四项 */
  const rollField = (k: string) => {
    if (locked[k]) return;
    const s = randomPlayerSeed();
    switch (k) {
      case "name": setPlayerName(genName(form.gender)); break;
      case "age": if (!cc.fixedAge) upd({ age: s.age! }); break;
      case "gender": {
        const opts = normalizeGenderOptions(bf("gender").options);
        const g = opts.includes(s.gender!) ? s.gender! : (opts[0] ?? "女");
        if (locked.name) upd({ gender: g });
        else setForm((f) => syncPlayerNameChange({ ...f, gender: g }, genName(g), {
          descLocked: locked.description,
          seedDescription: cc.seedDescription,
        }));
        break;
      }
      case "birthday": upd({ birthMonth: 1 + Math.floor(Math.random() * 12), birthDay: 1 + Math.floor(Math.random() * 28) }); break;
    }
  };

  /* 重掷所有未锁定字段 */
  const rerollAll = () => ALL_KEYS.forEach(rollField);


  const begin = () => {
    const extra = [
      ...(selectedFeature("career") && path?.name ? [{ label: "人物线路", value: path.name }] : []),
      { label: bl("birthday", "生日"), value: `${form.birthMonth}月${form.birthDay}日` },
      ...CUSTOM.filter((f) => cv(f).trim()).map((f) => {
        const note = fxOf(f)?.note?.trim();
        return { label: f.label, value: [cv(f), note && `（${note}）`, f.desc && `（${f.desc}）`].filter(Boolean).join("") };
      }),
    ];
    const fx = [
      ...CUSTOM.map(fxOf),
      optFx(IDENTITIES.find((o) => o.id === identityIdOf())),
    ].filter((x): x is OptFx => !!x);
    const contract = career ? offers.find((c) => c.id === contractId) : undefined;
    const identityId = identityIdOf();
    const player: Player = {
      name: form.name || "无名",
      age: form.age,
      gender: form.gender,
      // 功能注释：旧内置身份/家世/阶层不再由系统字段写入；作者可用自定义字段写进 extra
      identity: "",
      background: "",
      klass: "",
      description: form.description,
      avatar: form.avatar,
      // 功能注释：不预填演技/歌艺等八维；创作者属性由开局 GameContext 按 customAttrs 写入（只掷一次）
      attrs: [],
      history: [],
      extra,
    };
    commitSelection(); // 所选世界观 / 叠加包在开新局时正式生效
    startNew(
      player,
      // 功能注释：外形/家庭/职业方向不再由系统内置字段写入；星座由生日推算
      { name: player.name, styleId: "", identityId, backgroundId: "", directionId: "", zodiacId: zodiac.id },
      contract,
      worldRules,
      {
        fx,
        // 功能注释：始终带上游玩偏好（含屏幕方向），开局写入 theme.orient，不再弹首次方向窗；开局日期不由玩家覆盖
        playPrefs: { ...prefs, orient: prefs.orient ?? "portrait" },
        // 功能注释：线路人际 npcs 也可能是脏对象；开局前收成数组
        pathNpcs: asModArray((PATHS.find((p) => p.id === pathId) ?? PATHS.find((p) => p.open))?.npcs),
        route: PATHS.find((p) => p.id === pathId) ?? PATHS.find((p) => p.open),
        // 功能注释：startFactions 可能是 AI 单对象；开局前收成数组，避免 GameContext 侧再炸
        factions: asModArray<NonNullable<typeof cc.startFactions>[number]>(cc.startFactions),
        joined,
        ...(Object.keys(attrStarts).length ? { cattrStarts: attrStarts } : {}),
      },
    );
  };

  const field = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition focus:border-jade focus:ring-2 focus:ring-jade/15 disabled:opacity-70";
  /* 功能注释：pr-8 给自定义下拉箭头留空，避免箭头压住文字 */
  const selectField = `${field} pr-8`;

  /* 字段头：线性图标 · 名称 · 中间附加（姓名风格条）· 右侧锁定 / 双骰子重掷 */
  const Head = ({ k, text, hint, extra }: { k: string; text: string; hint?: string; extra?: ReactNode }) => {
    const I = FIELD_ICONS[k];
    const label = stripFieldEmoji(text);
    return (
      <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        {I && <I size={14} className="shrink-0 text-coral" />}
        <span className="shrink-0 text-[12.5px] font-bold text-ink">{label}</span>
        {hint && <span className="min-w-0 truncate text-[10.5px] text-ink-soft">{hint}</span>}
        {extra}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={() => toggleLock(k)} aria-pressed={!!locked[k]} title={locked[k] ? "已锁定，重掷时保留" : "锁定此项，重掷时保留"} aria-label={locked[k] ? "解锁" : "锁定"}
            className={`grid h-6 w-6 place-items-center rounded-full transition ${locked[k] ? "bg-jade/12 text-jade" : "text-ink-soft/50 hover:bg-ink/5 hover:text-ink"}`}>
            <LockGlyph open={!locked[k]} />
          </button>
          <button type="button" onClick={() => rollField(k)} disabled={locked[k]} title="单独掷一次" aria-label="单独重掷"
            className="grid h-6 w-6 place-items-center rounded-full text-ink-soft/50 transition hover:bg-ink/5 hover:text-jade disabled:opacity-30">
            <IconDiceDuo size={14} />
          </button>
        </div>
      </div>
    );
  };

  // 当前所选世界观是否有演艺事业线：没有则走通用建角（无人物线路 / 母校 / 经纪合约）
  const career = selectedFeature("career");
  const selWorld = getSelectedWorld().chain[0];
  const systemFieldsComplete = !!form.name.trim() && Number(form.age) > 0 && !!form.gender && form.birthMonth > 0 && form.birthDay > 0;
  const customFieldsComplete = CUSTOM.every((field) => {
    if (!field.required) return true;
    const value = cv(field).trim();
    return !!value && (!(field.type === "select" || field.type === "radio") || customOptions(field).includes(value));
  });
  const whoComplete = systemFieldsComplete && customFieldsComplete;
  const okToFinish = whoComplete && (!career || !!contractId);
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
      ...(h.gender === "男" || h.gender === "女" || normalizeGenderOptions(bf("gender").options).includes(String(h.gender || "")) ? { gender: String(h.gender) } : {}),
      description: h.bio || f.description,
    }));
  }, [heroId]);
  // 文案占位：世界名 / 路径 / 城市 / 年份季节 / 母校…随世界观自动替换
  const tv = creationVars({ world: selWorld?.name, path: path?.name });
  const pv = (name: string) => ({ ...tv, path: name });
  const zodiac = zodiacOf(form.birthMonth, form.birthDay);
  const pathWord = fillText(cc.pathTitle, tv).replace(/^选择/, "") || "开局路径";
  const formTitle = fillText(cc.formTitle || (path ? "{path} · 自设" : "{world} · 自设"), { ...tv, world: tv.world || "角色" });
  const hasMore = CUSTOM.length > 0;

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
  useEffect(() => { topRef.current?.closest(".ui-dialog-body")?.scrollTo({ top: 0 }); }, [stepK, wizOpen]);

  /* ① 路径：多条开放路径时弹窗；卡片只展示路径名 + 开局处境 */
  const stepPath = (
    <div className="space-y-2.5">
      {cc.pathIntro && <p className="text-[12.5px] leading-relaxed text-ink-soft"><Tpl text={cc.pathIntro} vars={tv} /></p>}
      {PATHS.filter((p) => p.open).map((p) => {
        const current = pathId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPathId(p.id);
              if (STEPS[si + 1]) goStep(STEPS[si + 1].k);
            }}
            className={`w-full rounded-2xl border bg-paper-2/70 px-3.5 py-3 text-left transition ${
              current ? "border-jade shadow-[0_0_0_3px_color-mix(in_srgb,var(--jade)_14%,transparent)]" : "border-line hover:border-jade/40"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${current ? "border-jade" : "border-line"}`} aria-hidden>
                {current && <span className="h-1.5 w-1.5 rounded-full bg-jade" />}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[15px] font-bold text-ink">{p.name}</span>
                {p.about ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{fillText(p.about, pv(p.name))}</p>
                ) : p.blurb ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{fillText(p.blurb, pv(p.name))}</p>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  /* 功能注释：姓名风格条放在「姓名」标签行，不压在输入框下面 */
  const nameStyleBar = (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <div role="radiogroup" aria-label="名字风格" className="flex rounded-full bg-ink/[0.05] p-0.5">
        {([["any", "不限"], ["modern", "现代"], ["ancient", "古风"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="radio" aria-checked={nameStyle === k} onClick={() => setNameStyle(k)}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition ${nameStyle === k ? "bg-paper text-jade shadow-sm" : "text-ink-soft"}`}>{t}</button>
        ))}
      </div>
      <button type="button" disabled={locked.name} onClick={() => setPlayerName(genName(form.gender))}
        className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink transition hover:border-jade hover:text-jade disabled:opacity-40">
        <IconDiceDuo size={12} />换一个
      </button>
      <button type="button" disabled={locked.name} onClick={() => setPickName(true)}
        className="rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[10.5px] font-semibold text-jade disabled:opacity-40">字库</button>
    </div>
  );

  /* ② 人设 · 身份：名字 · 年龄性别 · 生日星座 · 登记身份（线路已在上一步选定，自设页不再重复展示「人物线路选择」）
   * 功能注释：人设页不展示 formIntro / 作品简介——地点季节与生成提示词只干扰填表 */
  const stepWho = (
    <>
      <Card title="基本信息">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-6"><Avatar src={form.avatar} name={form.name} size={68} onPick={(d) => upd({ avatar: d })} avatarSlot={selectedSlot("avatars") ?? null} /></div>
          <fieldset className="min-w-0 flex-1">
            <Head k="name" text={bl("name", "姓名")} extra={nameStyleBar} />
            <input className={field} value={form.name} onChange={(e) => setPlayerName(e.target.value)} placeholder={form.gender === "男" ? "为他取个名字" : "为她取个名字"} />
            {pickName && <NamePicker gender={form.gender as NameGender} value={form.name} onClose={() => setPickName(false)} onPick={(n) => setPlayerName(n)} />}
          </fieldset>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Head k="age" text={bl("age", "年龄")} />
            <input type="number" min={1} className={field} value={form.age} onChange={(e) => upd({ age: e.target.value })} />
          </div>
          <fieldset className="min-w-0">
            <Head k="gender" text={bl("gender", "性别")} />
            <div role="radiogroup" className="grid gap-1 rounded-xl bg-ink/[0.05] p-1" style={{ gridTemplateColumns: `repeat(${normalizeGenderOptions(bf("gender").options).length}, minmax(0, 1fr))` }}>
              {normalizeGenderOptions(bf("gender").options).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={form.gender === g}
                  onClick={() => upd(!locked.name && autoNames.current.has(form.name) ? { gender: g, name: genName(g) } : { gender: g })}
                  className={`rounded-lg py-1.5 text-[13px] font-bold transition ${form.gender === g ? "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white shadow-sm" : "text-ink-soft hover:bg-paper"}`}>{g}</button>
              ))}
            </div>
          </fieldset>
        </div>
        <div>
          <Head k="birthday" text={bl("birthday", "生日")} />
          <div className="grid grid-cols-2 gap-2">
            <select className={selectField} value={form.birthMonth} onChange={(e) => upd({ birthMonth: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select className={selectField} value={form.birthDay} onChange={(e) => upd({ birthDay: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d} 日</option>)}
            </select>
          </div>
        </div>
      </Card>
    </>
  );

  /* 功能注释：开局属性区只列有名称的建角数值；标题旁双骰子整组重掷预览值 */
  const stepAttrs = creatorAttrs.length > 0 ? (
    <Card
      title="属性"
      desc="按创作者配置的顺序；点骰子可整组重掷开局值"
      titleAction={
        <button
          type="button"
          onClick={rerollAttrs}
          title="整组重掷属性开局值"
          aria-label="整组重掷属性"
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft/60 transition hover:bg-ink/5 hover:text-jade"
        >
          <IconDiceDuo size={15} />
        </button>
      }
    >
      <ul className="space-y-1.5">
        {creatorAttrs.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-xl border border-line/70 bg-paper px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{a.label}</span>
            <span className="shrink-0 text-[12px] text-ink-soft">{formatCreatorAttrPreview(a, attrStarts[a.id])}</span>
          </li>
        ))}
      </ul>
    </Card>
  ) : null;

  /* 自定义字段按作者顺序渲染；系统四项不参与线路/背景过滤。 */
  const stepCustom = hasMore ? (
    <Card title="更多设定" desc="创作者为本作品添加的角色信息">
      <div className="grid gap-3 sm:grid-cols-2">
        {CUSTOM.map((f, fi) => {
          const set = (value: string) => setCustomVals((current) => ({ ...current, [f.id]: value }));
          const val = cv(f);
          const options = customOptions(f);
          const fxs = fxSummary(fxOf(f), { attr: attrName, npc: npcName });
          return (
            <fieldset key={`${f.id}-${fi}`} className={`min-w-0 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[12.5px] font-bold text-ink">{f.label}</span>
                {f.required && <span className="text-[10.5px] font-semibold text-coral">必填</span>}
              </div>
              {f.type === "select" ? (
                <>
                  <select className={selectField} value={val} onChange={(e) => set(e.target.value)}>
                    {!val && <option value="">请选择</option>}
                    {options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  {fxs.length > 0 && <Note tone="jade">开局：{fxs.join(" · ")}</Note>}
                </>
              ) : f.type === "radio" ? (
                <div role="radiogroup" className="flex flex-wrap gap-1.5">
                  {options.map((option) => <button key={option} type="button" role="radio" aria-checked={val === option} onClick={() => set(option)}
                    className={`rounded-lg border px-3 py-2 text-[12.5px] ${val === option ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{option}</button>)}
                </div>
              ) : f.type === "textarea" ? (
                <textarea className={`${field} h-20 resize-none`} value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
              ) : f.type === "number" ? (
                <input type="number" className={field} value={val} min={f.min} max={f.max} placeholder={f.placeholder}
                  onChange={(e) => { const n = Number(e.target.value); set(e.target.value === "" ? "" : String(Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n)))); }} />
              ) : f.type === "date" ? (
                /* 功能注释：自定义日期用文本，禁止 type=date（与「建角不可自选开局日期」契约冲突） */
                <input className={field} value={val} placeholder={f.placeholder || "如：3月15日"} onChange={(e) => set(e.target.value)} />
              ) : (
                <input className={field} value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
              )}
            </fieldset>
          );
        })}
      </div>
    </Card>
  ) : null;

  /* ③ 开局 · 游玩偏好 · 开局日期 · 世界规则 */
  const stepSetup = (
    <>
      <Card title="游玩偏好" desc="开局默认竖屏；屏幕方向请到局内「游戏设置」再改">
        <PlayPrefsPicker value={prefs} onChange={setPrefs} />
      </Card>
      <Card title="世界规则" desc="恋爱、婚姻、继承与社会秩序——决定这个世界怎么看待你">
        <WorldRuleCards rules={worldRules} onChange={setWorldRulesState} female={!/男/.test(form.gender ?? "女")} compact />
      </Card>
    </>
  );

  /* ③ 开局 · 势力：创作者在「人物线路」编辑器里自设，可多选（受上限约束）；不选也能开局 */
  const SF = asModArray<NonNullable<typeof cc.startFactions>[number]>(cc.startFactions).filter((f) => f.id && String(f.name ?? "").trim());
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
                {!!asModArray<string>(f.tags).length && <span className="mt-1 flex flex-wrap gap-1">{asModArray<string>(f.tags).map((t) => <span key={t} className="rounded-full bg-ink/[0.05] px-1.5 py-px text-[10.5px] text-ink-soft">{t}</span>)}</span>}
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
          <IconDiceDuo size={12} />换几家公司
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
    // 功能注释：基本信息与属性紧挨，避免中间空一大截
    who: <div className="space-y-2">{stepWho}{stepAttrs}{stepCustom}</div>,
    setup: <div className="space-y-3">{career && stepSign}{stepFactions}{stepSetup}</div>,
  };

  // 功能注释：底栏走 Modal.footer，钉在 85% 框底；滚动只发生在 ui-dialog-body，属性不被按钮盖住
  // 第一步：作者预览可退出；有存档可读取；不再回封面开始菜单
  const wizardFoot = (
    <div className="ui-sheet-foot">
      <div className="flex items-center gap-2">
        {si > 0 ? (
          <button type="button" onClick={() => goStep(STEPS[si - 1].k)} className="ui-btn ui-btn-lg shrink-0">‹ 上一步</button>
        ) : previewing ? (
          <button type="button" onClick={() => requestAuthorPreviewEnd()} className="ui-btn ui-btn-lg shrink-0">退出预览</button>
        ) : saves.length > 0 ? (
          <button type="button" onClick={() => setContinueOpen(true)} className="ui-btn ui-btn-lg shrink-0">读取存档</button>
        ) : null}
        {last ? (
          <button type="button" onClick={begin} disabled={!okToFinish} className="ui-btn ui-btn-primary ui-btn-lg min-w-0 flex-1 disabled:opacity-40">
            <IconPlay width={16} height={16} /><span className="truncate">{cc.cta ?? "开启故事"}</span>
          </button>
        ) : (
          <button type="button" onClick={() => goStep(STEPS[si + 1].k)} disabled={step.k === "who" && !whoComplete} className="ui-btn ui-btn-primary ui-btn-lg min-w-0 flex-1 disabled:opacity-40">
            <span className="truncate">下一步 · {STEPS[si + 1].label}</span> ›
          </button>
        )}
      </div>
    </div>
  );

  const wizard = wizOpen ? (
    <Modal
      title={step.k === "path" ? (fillText(cc.pathTitle, tv) || "选择开局") : formTitle}
      onClose={() => setWizOpen(false)}
      heavyBackdrop
      panelClassName="ui-dialog-create"
      footer={wizardFoot}
    >
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
            <IconDiceDuo size={13} />重掷
          </button>
        )}
      </div>

      {body[step.k]}
    </Modal>
  ) : null;

  /* 弹窗背后：建角进度卡，关掉弹窗后可继续 */
  return (
    /* 功能注释：作者预览时吃满预览舞台高度，勿 min-h-screen 顶破底栏 */
    <div
      className={`paper-grain flex items-center justify-center bg-paper px-5 py-10 ${
        previewing ? "h-full min-h-0 overflow-auto" : "min-h-screen"
      }`}
    >
      {wizard}
      {continueOpen && (
        <Modal title="继续游戏 · 读取存档" onClose={() => setContinueOpen(false)}>
          {saves.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">暂无存档，先完成建角开一局吧。</p>
          ) : (
            <div className="space-y-2">
              {saves.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif font-bold text-ink">{s.name}</p>
                    {s.state.saveSummary && <p className="truncate text-[12px] text-ink">{s.state.saveSummary}</p>}
                    <p className="text-[11px] text-ink-soft">
                      {s.state.world.time} · {s.state.world.location} · 第 {s.state.turnCount} 回合 · {new Date(s.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <button type="button" onClick={() => loadState(s.state)} className="rounded-lg bg-jade px-3 py-1.5 text-xs font-medium text-paper-2 transition hover:brightness-110">
                    读取
                  </button>
                  <button
                    type="button"
                    onClick={() => { void deleteSlot(s.id).then(() => listSaves().then(setSaves)); }}
                    className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft transition hover:border-danger hover:text-danger"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {/* 功能注释：向导打开时隐藏背后进度卡，避免半透明遮罩透出旧入口 */}
      <div
        className={`w-full max-w-sm rounded-[24px] border border-line/70 bg-paper/85 p-6 text-center shadow-[0_16px_40px_-24px_rgba(0,0,0,0.4)] backdrop-blur ${wizOpen ? "invisible pointer-events-none" : ""}`}
        aria-hidden={wizOpen}
      >
        <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-soft">{selWorld?.name ?? "新的人生"}</p>
        <div className="mx-auto mt-4 w-fit"><Avatar src={form.avatar} name={form.name} size={76} editable={false} /></div>
        <h1 className="mt-3 font-serif text-[22px] font-black tracking-wide text-ink">{form.name || "无名"}</h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">{[path?.name, form.age && `${form.age} 岁`, form.gender, zodiac.name].filter(Boolean).join(" · ")}</p>
        <p className="mt-3 text-[12px] text-ink-soft">角色创建中 · 第 {si + 1} / {STEPS.length} 步「{step.label}」</p>
        <button type="button" onClick={() => setWizOpen(true)} className="ui-btn ui-btn-primary ui-btn-lg mt-4 w-full">继续创建</button>
        {!previewing && saves.length > 0 && (
          <button type="button" onClick={() => setContinueOpen(true)} className="ui-btn ui-btn-lg mt-2 w-full">读取存档</button>
        )}
        {previewing && (
          <button type="button" onClick={() => requestAuthorPreviewEnd()} className="mt-2 text-[12px] text-ink-soft transition hover:text-ink">退出预览</button>
        )}
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
