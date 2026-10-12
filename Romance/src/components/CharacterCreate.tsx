import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { DEFAULT_ATTRS, randomPlayerSeed } from "../lib/store";
import type { Player } from "../lib/types";
import { Avatar, Chip, SectionHead } from "./ui";
import { IconDice, IconPlay } from "../lib/icons";
import { STYLES, IDENTITIES, BACKGROUNDS, DIRECTIONS, TRAITS, PARENT_JOBS, zodiacOf, WORLD_RULE_DIMS, defaultWorldRules } from "../game/data";
import { ZodiacSign } from "../lib/zodiacIcons";
import { SIGNING_CONTRACTS, type SigningContract } from "../worlds/star2005/content";
import { loadDebutPaths } from "../lib/debutPaths";

const IDENTITY_OPTS = ["练习生", "新人演员", "选秀出身歌手", "模特转型艺人", "音乐剧演员", "网络小生", "综艺新面孔"];
const BG_OPTS = ["单亲家庭长大", "小城书香门第", "梨园世家", "普通工薪家庭", "海外归国", "隐姓埋名的旧贵族"];
const KLASS_OPTS = ["草根逆袭", "中产", "殷实之家", "落魄名门"];

/* 全部可掷骰字段（「重掷全部」用，锁定的自动跳过） */
const ALL_KEYS = ["name", "gender", "identity", "directionId", "traits", "styleId", "description", "backgroundId", "klass", "background", "fatherJob", "motherJob", "birthday"];

/* 单页自设：无分步，全部字段平铺 */
const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const pickId = <T extends { id: string }>(a: T[]): string => rand(a).id;

/* 合约配色：内容池 tone → 界面色板 */
const TONE: Record<string, { text: string; ring: string; soft: string }> = {
  coral: { text: "text-coral", ring: "border-coral", soft: "bg-coral/10" },
  jade: { text: "text-jade", ring: "border-jade", soft: "bg-jade/10" },
  gold: { text: "text-gold", ring: "border-gold", soft: "bg-gold/10" },
};

export default function CharacterCreate() {
  const { go, startNew } = useGame();
  const seed = randomPlayerSeed();
  const [paths] = useState(loadDebutPaths);
  const [pathId, setPathId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(() => paths.find((path) => path.open)?.id ?? null);
  const [form, setForm] = useState({
    name: seed.name!,
    age: paths.find((path) => path.open)?.age ?? "22",
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
    styleId: STYLES[0].id,
    identityId: paths.find((path) => path.open)?.identityId ?? "kban",
    backgroundId: BACKGROUNDS[0].id,
    directionId: DIRECTIONS[0].id,
  });
  const [traitIds, setTraitIds] = useState<string[]>([TRAITS[0].id]);
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [contractId, setContractId] = useState<string>(SIGNING_CONTRACTS[0]?.id ?? "");
  const [worldRules, setWorldRulesState] = useState(defaultWorldRules);

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toggleLock = (k: string) => setLocked((l) => ({ ...l, [k]: !l[k] }));

  /* 单字段掷骰（尊重锁定） */
  const rollField = (k: string) => {
    if (locked[k]) return;
    const s = randomPlayerSeed();
    switch (k) {
      case "name": upd({ name: s.name! }); break;
      case "age": upd({ age: s.age! }); break;
      case "gender": upd({ gender: s.gender! }); break;
      case "identity": upd({ identity: rand(IDENTITY_OPTS) }); break;
      case "background": upd({ background: rand(BG_OPTS) }); break;
      case "klass": upd({ klass: rand(KLASS_OPTS) }); break;
      case "description": upd({ description: s.description! }); break;
      case "styleId": upd({ styleId: pickId(STYLES) }); break;
      case "identityId": upd({ identityId: pickId(IDENTITIES) }); break;
      case "backgroundId": upd({ backgroundId: pickId(BACKGROUNDS) }); break;
      case "directionId": upd({ directionId: pickId(DIRECTIONS) }); break;
      case "fatherJob": upd({ fatherJob: rand(PARENT_JOBS) }); break;
      case "motherJob": upd({ motherJob: rand(PARENT_JOBS) }); break;
      case "birthday": upd({ birthMonth: 1 + Math.floor(Math.random() * 12), birthDay: 1 + Math.floor(Math.random() * 28) }); break;
      case "traits": {
        setTraitIds([rand(TRAITS).id]);
        break;
      }
    }
  };

  /* 重掷所有未锁定字段 */
  const rerollAll = () => ALL_KEYS.forEach(rollField);

  const toggleTrait = (id: string) =>
    setTraitIds([id]);

  const begin = () => {
    if (!form.name.trim() || !form.age.trim() || !form.gender) return;
    const zodiac = zodiacOf(form.birthMonth, form.birthDay);
    const selectedPath = paths.find((item) => item.id === pathId);
    const extra = [
      { label: "母校", value: selectedPath?.school ?? "尚未设置" },
      { label: "出道路径", value: selectedPath?.name ?? "自定义出道" },
      { label: "生日", value: `${form.birthMonth}月${form.birthDay}日` },
      { label: "星座", value: zodiac.name },
      { label: "父亲职业", value: form.fatherJob },
      { label: "母亲职业", value: form.motherJob },
      ...(form.extraKey && form.extraVal ? [{ label: form.extraKey, value: form.extraVal }] : []),
    ];
    const traitDefs = TRAITS.filter((t) => traitIds.includes(t.id));
    const contract = SIGNING_CONTRACTS.find((c) => c.id === contractId);
    const identityId = selectedPath?.identityId ?? "kban";
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
      traits: traitDefs.map((t) => ({ name: t.name, kind: "positive" as const, desc: t.desc })),
      history: [],
      extra,
    };
    startNew(
      player,
      { name: player.name, styleId: form.styleId, identityId, backgroundId: form.backgroundId, directionId: form.directionId, traitIds, zodiacId: zodiac.id },
      contract,
      worldRules,
    );
  };

  const field = "w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-jade";
  const label = "text-[12px] font-medium text-ink-soft";

  /* 带锁 + 掷骰的字段头 */
  const Head = ({ k, text }: { k: string; text: string }) => (
    <div className="mb-1 flex items-center justify-between">
      <span className={label}>{text}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleLock(k)}
          title={locked[k] ? "已锁定，重掷时保留" : "锁定此项"}
          className={`text-[12px] font-bold leading-none transition ${locked[k] ? "text-gold" : "text-ink-soft/50 hover:text-ink-soft"}`}
        >
          {locked[k] ? "[L]" : "[ ]"}
        </button>
        <button
          type="button"
          onClick={() => rollField(k)}
          disabled={locked[k]}
          title="单独掷一次"
          className="text-ink-soft/60 transition hover:text-jade disabled:opacity-30"
        >
          <IconDice width={13} height={13} />
        </button>
      </div>
    </div>
  );

  const basicsComplete = !!form.name.trim() && !!form.age.trim() && !!form.gender;
  const okToFinish = !!contractId && basicsComplete;
  const path = paths.find((p) => p.id === pathId);
  const zodiac = zodiacOf(form.birthMonth, form.birthDay);

  /* 第一步：选择编辑器配置并开放的出道路径 */
  if (pathId === null) {
    return (
      <div className="paper-grain min-h-screen px-5 py-10">
        <div className="mx-auto max-w-lg">
          <button onClick={() => go("cover")} className="mb-5 text-sm text-ink-soft transition hover:text-ink">
            ← 返回封面
          </button>
          <h1 className="text-2xl font-black tracking-wide text-jade">▌选择出道路径</h1>
          <p className="mt-1 text-[13px] text-ink-soft">曜城 · 2005 冬。每条路都是一种截然不同的人生开局。点开卡片查看详情，并选择你想走的路。</p>
          <div className="mt-5 space-y-3">
            {paths.map((p) => {
              const expanded = p.open && openDetail === p.id;
              // 未开放路径：不展开详情，仅显示「开发中」
              if (!p.open) {
                return (
                  <div key={p.id} className="rounded-sm border border-dashed border-line/60 bg-paper/40 p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-ink">{p.name}</span>
                      <Chip>开发中</Chip>
                      <span className="ml-auto text-[11px] text-ink-soft">{p.tag}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{p.blurb}</p>
                  </div>
                );
              }
              return (
                <div
                  key={p.id}
                  className="rounded-sm border border-line bg-paper-2/60 transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenDetail(expanded ? null : p.id)}
                    className="flex w-full items-start gap-2 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-ink">{p.name}</span>
                        <Chip tone="jade">已开放</Chip>
                        <span className="ml-auto text-[11px] text-ink-soft">{p.tag}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{p.blurb}</p>
                    </div>
                    <span className={`mt-1 shrink-0 text-ink-soft transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {expanded && (
                    <div className="border-t border-line/60 px-4 py-3 text-[12.5px] leading-relaxed">
                      <p className="text-ink/90">{p.about}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] font-bold tracking-wide text-jade">▌可自由决定</p>
                          <ul className="space-y-0.5 text-ink-soft">
                            {p.choose.map((c) => <li key={c}>· {c}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] font-bold tracking-wide text-coral">▌固定 · 不可更改</p>
                          <ul className="space-y-0.5 text-ink-soft">
                            {p.fixed.map((f) => <li key={f}>· {f}</li>)}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-3 rounded-sm bg-gold/5 px-2.5 py-1.5 text-[12px] text-ink">
                        <span className="font-semibold text-gold">数值倾向　</span>{p.perks}
                      </p>
                      {p.open ? (
                        <button
                          type="button"
                          onClick={() => { setPathId(p.id); upd({ age: p.age, identityId: p.identityId }); }}
                          className="mt-3 w-full rounded-sm bg-jade py-2.5 text-sm font-semibold text-paper transition hover:brightness-110"
                        >
                          选择此路径 · 开始建角
                        </button>
                      ) : (
                        <div className="mt-3 w-full rounded-sm border border-dashed border-line py-2.5 text-center text-sm text-ink-soft">
                          敬请期待
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-grain min-h-screen px-5 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={() => setPathId(null)} className="text-sm text-ink-soft transition hover:text-ink">
            ← 换条路径
          </button>
          <button onClick={rerollAll} className="flex items-center gap-1 rounded-lg border border-jade/40 bg-jade/10 px-3 py-1.5 text-xs font-medium text-jade transition hover:bg-jade/20">
            <IconDice width={15} height={15} /> 重掷全部
          </button>
        </div>

        <h1 className="text-2xl font-black tracking-wide text-jade">▌{path?.name} · 自设</h1>
        <p className="text-[13px] text-ink-soft">曜城 · 2005 冬。你的起点是 <span className="font-medium text-jade">{path?.school}</span>。一页定型——锁住满意的（[L]），其余随时重掷。</p>

        {/* IDENTITY 身份 */}
        <SectionHead code="IDENTITY" cn="身份" />
        <div className="flex items-center gap-4">
          <Avatar src={form.avatar} name={form.name} size={64} onPick={(d) => upd({ avatar: d })} />
          <div className="flex-1">
            <Head k="name" text="姓名 · 必填" />
            <input required aria-required="true" className={field} value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="必须填写姓名" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <span className={label}>年龄 · 必填（当前线路固定）</span>
            <div className={`${field} mt-1 flex items-center justify-between bg-jade/5`}>
              <span className="font-medium text-jade">{form.age} 岁</span>
              <span className="text-[11px] text-ink-soft">不可更改</span>
            </div>
          </div>
          <div>
            <Head k="gender" text="性别 · 必填" />
            <select required aria-required="true" className={field} value={form.gender} onChange={(e) => upd({ gender: e.target.value })}>
              <option value="女">女</option>
              <option value="男">男</option>
              <option value="其他">其他</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <Head k="birthday" text="出生月日（决定星座与专属加成）" />
          <div className="flex items-center gap-3">
            <select className={field} value={form.birthMonth} onChange={(e) => upd({ birthMonth: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select className={field} value={form.birthDay} onChange={(e) => upd({ birthDay: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d} 日</option>)}
            </select>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-sm border border-gold/40 bg-gold/5 px-3 py-2">
            <ZodiacSign id={zodiac.id} width={20} height={20} className="text-gold" />
            <span className="text-[13px] font-semibold text-ink">{zodiac.name}</span>
            <span className="ml-auto text-[12px] font-medium text-gold">{zodiac.bonus}</span>
          </div>
        </div>
        <div className="mt-3">
          <Head k="identity" text="出道身份（登记履历，AI 不可擅改）" />
          <select className={field} value={form.identity} onChange={(e) => upd({ identity: e.target.value })}>
            {IDENTITY_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* ABILITY 能力 */}
        <SectionHead code="ABILITY" cn="出道天赋" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>出道路径（已锁定）</span>
            <div className={`${field} mt-1 flex items-center justify-between bg-jade/5`}>
              <span className="font-medium text-jade">{path?.name}</span>
              <span className="text-[11px] text-ink-soft">{path?.school}</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">{IDENTITIES.find((o) => o.id === path?.identityId)?.desc}</p>
          </div>
          <div>
            <Head k="directionId" text="职业方向" />
            <select className={field} value={form.directionId} onChange={(e) => upd({ directionId: e.target.value })}>
              {DIRECTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-ink-soft">{DIRECTIONS.find((o) => o.id === form.directionId)?.desc}</p>
          </div>
        </div>
        <div className="mt-3">
          <Head k="traits" text="初始特质（只能选 1 个）" />
          <div className="flex flex-wrap gap-2">
            {TRAITS.map((t) => {
              const on = traitIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTrait(t.id)}
                  title={t.desc}
                  className={`rounded-sm border px-2.5 py-1 text-[12px] transition ${on ? "border-jade bg-jade/15 text-jade" : "border-line text-ink-soft hover:border-jade/50"}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          {traitIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {traitIds.map((id) => <Chip key={id} tone="jade">{TRAITS.find((t) => t.id === id)?.desc}</Chip>)}
            </div>
          )}
        </div>

        {/* IMAGE 形象 */}
        <SectionHead code="IMAGE" cn="形象气质" />
        <div>
          <Head k="styleId" text="外形风格" />
          <select className={field} value={form.styleId} onChange={(e) => upd({ styleId: e.target.value })}>
            {STYLES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-soft">{STYLES.find((o) => o.id === form.styleId)?.desc}</p>
        </div>
        <div className="mt-3">
          <Head k="description" text="人物描述 / 气质设定" />
          <textarea className={`${field} h-24 resize-none`} value={form.description} onChange={(e) => upd({ description: e.target.value })} placeholder="性格、外貌、梦想、隐藏的过去……都会影响 AI 的演绎。" />
        </div>

        {/* BACKGROUND 履历 */}
        <SectionHead code="BACKGROUND" cn="家世履历" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Head k="backgroundId" text="家庭背景（影响资源）" />
            <select className={field} value={form.backgroundId} onChange={(e) => upd({ backgroundId: e.target.value })}>
              {BACKGROUNDS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-ink-soft">{BACKGROUNDS.find((o) => o.id === form.backgroundId)?.desc}</p>
          </div>
          <div>
            <Head k="klass" text="出身阶层（叙事底色）" />
            <select className={field} value={form.klass} onChange={(e) => upd({ klass: e.target.value })}>
              {KLASS_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <Head k="background" text="家世叙述" />
          <select className={field} value={form.background} onChange={(e) => upd({ background: e.target.value })}>
            {BG_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Head k="fatherJob" text="父亲职业" />
            <select className={field} value={form.fatherJob} onChange={(e) => upd({ fatherJob: e.target.value })}>
              {PARENT_JOBS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <Head k="motherJob" text="母亲职业" />
            <select className={field} value={form.motherJob} onChange={(e) => upd({ motherJob: e.target.value })}>
              {PARENT_JOBS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">父母的职业与出身阶层，会决定他们为何不愿你入行——开局剧情将由此展开。</p>
        <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-3">
          <div>
            <label className={label}>自定义字段名</label>
            <input className={`${field} mt-1`} value={form.extraKey} onChange={(e) => upd({ extraKey: e.target.value })} placeholder="如：座右铭" />
          </div>
          <div>
            <label className={label}>内容</label>
            <input className={`${field} mt-1`} value={form.extraVal} onChange={(e) => upd({ extraVal: e.target.value })} placeholder="如：越安静，越锋利" />
          </div>
        </div>

        {/* CONTRACT 目标 */}
        <SectionHead code="WORLD" cn="世界规则" right={
          <button
            type="button"
            onClick={() => setWorldRulesState({ ...worldRules, enabled: !worldRules.enabled })}
            className={`flex items-center gap-1.5 text-[11.5px] font-medium transition ${worldRules.enabled ? "text-jade" : "text-ink-soft"}`}
          >
            <span className={`relative h-4 w-8 rounded-full transition ${worldRules.enabled ? "bg-jade" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${worldRules.enabled ? "left-[18px]" : "left-0.5"}`} />
            </span>
            {worldRules.enabled ? "已启用" : "默认"}
          </button>
        } />
        <p className="mb-2 text-[12.5px] text-ink-soft">设定这个世界的社会规则。开启后 AI 演绎婚恋与人物关系将严格遵循；关闭则沿用现实默认。开局后仍可在 <span className="text-ink">☰ 菜单 → 世界规则</span> 里随时调整。</p>
        <div className={`mb-6 grid gap-2 sm:grid-cols-3 ${worldRules.enabled ? "" : "pointer-events-none opacity-45"}`}>
          {WORLD_RULE_DIMS.map((d) => {
            const cur = worldRules.choices[d.id] ?? d.def;
            const curOpt = d.options.find((o) => o.id === cur) ?? d.options[0];
            return (
              <div key={d.id} className="rounded-sm border border-line bg-paper-2/60 p-2.5">
                <div className="mb-1 text-[12px] font-medium text-ink-soft">{d.label}</div>
                <div className="relative">
                  <select
                    value={cur}
                    disabled={!worldRules.enabled}
                    onChange={(e) => setWorldRulesState({ ...worldRules, choices: { ...worldRules.choices, [d.id]: e.target.value } })}
                    className="w-full appearance-none rounded-sm border border-line bg-paper px-2.5 py-2 pr-7 text-[13px] font-medium text-ink outline-none transition focus:border-jade"
                  >
                    {d.options.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-soft">▾</span>
                </div>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-soft">{curOpt.desc}</p>
              </div>
            );
          })}
        </div>

        <SectionHead code="CONTRACT" cn="签约目标" />
        <p className="mb-2 text-[12.5px] text-ink-soft">三家经纪公司递来合约。<span className="text-ink">三年之内替公司回本</span>，你才算真正立住脚——挑一份签下去。</p>
        <div className="space-y-2.5">
          {SIGNING_CONTRACTS.map((c) => {
            const on = c.id === contractId;
            const t = TONE[c.tone] ?? TONE.jade;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setContractId(c.id)}
                className={`w-full rounded-sm border p-3.5 text-left transition ${on ? `${t.ring} ${t.soft}` : "border-line bg-paper-2/60 hover:border-ink-soft/40"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-base font-bold text-ink">{c.company}</span>
                  <span className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${t.soft} ${t.text}`}>[{c.focusLabel}]</span>
                  <span className="ml-auto text-[11px] text-ink-soft">{c.companyStyle}</span>
                </div>
                <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">{c.blurb}</p>
                <ContractTerms c={c} />
              </button>
            );
          })}
        </div>

        {!basicsComplete && <p className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-center text-xs text-danger">姓名、年龄和性别为必填基础档案，请填写完整。</p>}
        <button onClick={begin} disabled={!okToFinish} className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-jade py-3 text-base font-semibold text-paper transition hover:brightness-110 disabled:opacity-40">
          <IconPlay width={18} height={18} /> 签约 · 开启她的故事
        </button>
      </div>
    </div>
  );
}

function Term({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-sm bg-paper px-2.5 py-1.5">
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
      <p className="mt-2 text-[11px] text-ink-soft">独家条款 · {c.exclusive}</p>
    </div>
  );
}
