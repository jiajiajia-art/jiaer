#!/usr/bin/env python3
"""One-shot: replace Romance UI glyphs with SVG helper usage. Not a check."""
from pathlib import Path
import re

COMP = Path("/Users/xiaoming/Documents/cursor/gameWork/Interactive-fiction-frontend/Romance/src/components")


def rel_icons(path: Path) -> str:
    depth = len(path.relative_to(COMP).parts) - 1
    return "../" * (depth + 1) + "lib/icons"


def add_imports(text: str, names: list[str], path: Path) -> str:
    rel = rel_icons(path)
    pat = re.compile(rf'import\s*\{{([^}}]+)\}}\s*from\s*["\']{re.escape(rel)}["\']')
    m = pat.search(text)
    if m:
        existing = []
        for x in m.group(1).split(","):
            x = x.strip()
            if x and x not in existing:
                existing.append(x)
        for n in names:
            if n not in existing:
                existing.append(n)
        new = f'import {{ {", ".join(existing)} }} from "{rel}"'
        return text[: m.start()] + new + text[m.end() :]
    lines = text.splitlines(True)
    last_imp = -1
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_imp = i
    insert = f'import {{ {", ".join(names)} }} from "{rel}";\n'
    lines.insert(last_imp + 1, insert)
    return "".join(lines)


def sub_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if old not in text:
        print(f"  MISS {label}: {old[:80]!r}")
        return text, False
    return text.replace(old, new), True


def patch_file(rel: str, names: list[str], pairs: list[tuple[str, str]]):
    path = COMP / rel
    text = path.read_text()
    ok = 0
    for old, new in pairs:
        text2, hit = sub_once(text, old, new, rel)
        if hit:
            ok += 1
            text = text2
    if names:
        text = add_imports(text, names, path)
    path.write_text(text)
    print(f"{rel}: {ok}/{len(pairs)}")


# —— global ✕ close buttons ——
close_files = []
for p in COMP.rglob("*.tsx"):
    t = p.read_text()
    if ">✕</button>" in t:
        t = t.replace(">✕</button>", '><IconClose size="sm" /></button>')
        t = add_imports(t, ["IconClose"], p)
        p.write_text(t)
        close_files.append(str(p.relative_to(COMP)))
print("close buttons:", close_files)

# HomeTab remaining
patch_file(
    "HomeTab.tsx",
    ["IconCheck", "StatusMark"],
    [
        (
            '<p className="mt-4 rounded-full bg-paper py-2 text-[12px] text-ink-soft">✓ 已在行囊中</p>',
            '<p className="mt-4 rounded-full bg-paper py-2 text-[12px] text-ink-soft"><StatusMark kind="ok">已在行囊中</StatusMark></p>',
        ),
        (
            '{companion === c.id ? "✓ " : ""}{c.name}',
            '{companion === c.id ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{c.name}',
        ),
    ],
)

patch_file(
    "ModManagerPanel.tsx",
    ["IconSpark", "StatusMark"],
    [
        (
            'const warn = refs.length ? `\\n\\n⚠ 引用链检查：\\n${refs.slice(0, 12).join("\\n")}${refs.length > 12 ? `\\n…共 ${refs.length} 处` : ""}\\n这些调用会失效。` : "";',
            'const warn = refs.length ? `\\n\\n引用链检查：\\n${refs.slice(0, 12).join("\\n")}${refs.length > 12 ? `\\n…共 ${refs.length} 处` : ""}\\n这些调用会失效。` : "";',
        ),
        (
            '>✦ AI 对话修改</button>',
            '><span className="inline-flex items-center gap-1"><IconSpark size={14} /> AI 对话修改</span></button>',
        ),
        (
            '{problems.map((p, i) => <li key={i}>⚠ {p}</li>)}',
            '{problems.map((p, i) => <li key={i}><StatusMark kind="warn">{p}</StatusMark></li>)}',
        ),
        (
            '>✦ AI 对话生成模组</button>',
            '><span className="inline-flex items-center gap-1"><IconSpark size={14} /> AI 对话生成模组</span></button>',
        ),
        (
            '{on && shadows[m.id]?.map((t, i) => <p key={i} className="mt-0.5 pl-10 text-[11px] text-gold">⚠ {t}</p>)}',
            '{on && shadows[m.id]?.map((t, i) => <p key={i} className="mt-0.5 pl-10 text-[11px] text-gold"><StatusMark kind="warn">{t}</StatusMark></p>)}',
        ),
        (
            '{notice && <p className="text-[12px] text-jade">✓ {notice}</p>}',
            '{notice && <p className="text-[12px] text-jade"><StatusMark kind="ok">{notice}</StatusMark></p>}',
        ),
    ],
)

patch_file(
    "ModEditorPanel.tsx",
    ["IconCheck", "IconSpark", "StatusMark"],
    [
        (
            '<span className="block text-[12.5px] font-bold text-ink">✦ 用对话修改这个模组</span>',
            '<span className="flex items-center gap-1 text-[12.5px] font-bold text-ink"><IconSpark size={14} /> 用对话修改这个模组</span>',
        ),
        (
            '{on ? "✓ " : ""}{x.name}',
            '{on ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{x.name}',
        ),
        (
            '{savedTip ? <span className="font-bold text-jade">✓ 已保存，下次开新局生效</span>',
            '{savedTip ? <span className="font-bold text-jade"><StatusMark kind="ok">已保存，下次开新局生效</StatusMark></span>',
        ),
    ],
)

patch_file(
    "ModHealthPanel.tsx",
    ["StatusMark"],
    [
        (
            '<p className="font-semibold text-jade">✓ 没发现明显失衡</p>',
            '<p className="font-semibold text-jade"><StatusMark kind="ok">没发现明显失衡</StatusMark></p>',
        ),
        (
            '{f.level === "warn" ? "⚠" : "·"} {f.area}',
            '{f.level === "warn" ? <StatusMark kind="warn">{f.area}</StatusMark> : <>· {f.area}</>}',
        ),
        (
            '{shadows.map((s, i) => <li key={i}>⚠ {s}</li>)}',
            '{shadows.map((s, i) => <li key={i}><StatusMark kind="warn">{s}</StatusMark></li>)}',
        ),
    ],
)

patch_file(
    "ModWorkshop.tsx",
    ["IconCheck", "IconSpark", "StatusMark"],
    [
        (
            '{target ? `✦ 对话修改「${target.mod.name}」` : "✦ AI 创意工坊"}',
            '<span className="inline-flex items-center gap-1"><IconSpark size={16} />{target ? `对话修改「${target.mod.name}」` : "AI 创意工坊"}</span>',
        ),
        (
            '{ok ? "✓ " : `${i + 1}. `}{s.label}',
            '{ok ? <IconCheck size={12} className="mr-0.5 inline" /> : `${i + 1}. `}{s.label}',
        ),
        (
            '{t.patch && <p className="mt-1 text-[10.5px] text-jade">✓ 已合并进草稿：{t.diff}</p>}',
            '{t.patch && <p className="mt-1 text-[10.5px] text-jade"><StatusMark kind="ok">已合并进草稿：{t.diff}</StatusMark></p>}',
        ),
    ],
)

patch_file(
    "CharacterCreate.tsx",
    ["IconCheck", "IconHeart", "IconLock"],
    [
        (
            '<Chip>🔒 {p.lockTag || "未解锁"}</Chip>',
            '<Chip><span className="inline-flex items-center gap-1"><IconLock size={12} /> {p.lockTag || "未解锁"}</span></Chip>',
        ),
        (
            '{typeof n.rel === "number" && <span className="text-coral">♥{n.rel}</span>}',
            '{typeof n.rel === "number" && <span className="inline-flex items-center gap-0.5 text-coral"><IconHeart size={12} />{n.rel}</span>}',
        ),
        (
            '{done ? "✓" : i + 1}',
            '{done ? <IconCheck size={12} /> : i + 1}',
        ),
    ],
)

patch_file(
    "GigBoard.tsx",
    ["StarRating"],
    [
        (
            '{"★".repeat(g.star)} {g.name}',
            '<span className="inline-flex items-center gap-1"><StarRating n={g.star} /> {g.name}</span>',
        ),
    ],
)

patch_file(
    "ProjectsTab.tsx",
    ["IconCheck", "StarRating"],
    [
        (
            '{"★".repeat(tpl.starLevel)} {tpl.title}',
            '<span className="inline-flex items-center gap-1"><StarRating n={tpl.starLevel} /> {tpl.title}</span>',
        ),
        (
            '{r.hint}{metricNow(r.metric) >= r.value ? " ✓" : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}',
            '{r.hint}{metricNow(r.metric) >= r.value ? <IconCheck size={12} className="ml-0.5 inline" /> : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}',
        ),
    ],
)

patch_file(
    "ProducerParley.tsx",
    ["IconCheck", "StarRating", "StatusMark"],
    [
        (
            '{knows(s, tpl.id, "starLevel") ? "★".repeat(tpl.starLevel) + " " : ""}{tpl.title}',
            '{knows(s, tpl.id, "starLevel") ? <StarRating n={tpl.starLevel} className="mr-1 inline-flex align-middle" /> : null}{tpl.title}',
        ),
        (
            '{r.hint}{metricNow(r.metric) >= r.value ? " ✓" : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}',
            '{r.hint}{metricNow(r.metric) >= r.value ? <IconCheck size={12} className="ml-0.5 inline" /> : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}',
        ),
        (
            'if (st === "asked") return <span key={q.id} className="rounded-md bg-jade/10 px-2 py-1 text-[11.5px] text-jade">✓ {q.label}</span>;',
            'if (st === "asked") return <span key={q.id} className="rounded-md bg-jade/10 px-2 py-1 text-[11.5px] text-jade"><StatusMark kind="ok">{q.label}</StatusMark></span>;',
        ),
    ],
)

patch_file(
    "ImageTab.tsx",
    ["StarRating"],
    [
        (
            '严重度 {"★".repeat(s.crisis.severity)}',
            '严重度 <StarRating n={s.crisis.severity} className="ml-1 inline-flex align-middle" />',
        ),
    ],
)

patch_file(
    "SimTab.tsx",
    ["IconStar", "StatusMark"],
    [
        (
            '{top && <span className="shrink-0 text-[10px] font-bold text-gold">★ 最强</span>}',
            '{top && <span className="shrink-0 text-[10px] font-bold text-gold"><StatusMark kind="star">最强</StatusMark></span>}',
        ),
        (
            '{a.top && <span aria-hidden>★</span>}',
            '{a.top && <IconStar size={12} className="mr-0.5 inline" />}',
        ),
        (
            '{topNames.length > 0 && <span><b className="font-bold text-gold">★ 最强</b> {topNames.join("、")}</span>}',
            '{topNames.length > 0 && <span><b className="inline-flex items-center gap-0.5 font-bold text-gold"><IconStar size={12} /> 最强</b> {topNames.join("、")}</span>}',
        ),
    ],
)

patch_file(
    "DiaryCg.tsx",
    ["IconSpark"],
    [
        (
            '{at ? "✦" : "?"}',
            '{at ? <IconSpark size={22} /> : "?"}',
        ),
    ],
)

patch_file(
    "PersonProfile.tsx",
    ["IconSpark"],
    [
        (
            "✦ {n?.identity || wp?.role}",
            '<span className="inline-flex items-center gap-1"><IconSpark size={12} /> {n?.identity || wp?.role}</span>',
        ),
    ],
)

patch_file(
    "AiEventWriter.tsx",
    ["IconSpark"],
    [
        (
            '<span className="block text-[13px] font-bold text-ink">✦ AI 帮写固定事件</span>',
            '<span className="flex items-center gap-1 text-[13px] font-bold text-ink"><IconSpark size={14} /> AI 帮写固定事件</span>',
        ),
        (
            '<p className="text-[13px] font-bold text-ink">✦ AI 帮写固定事件</p>',
            '<p className="flex items-center gap-1 text-[13px] font-bold text-ink"><IconSpark size={14} /> AI 帮写固定事件</p>',
        ),
    ],
)

patch_file(
    "CustomCssPanel.tsx",
    ["StatusMark"],
    [
        (
            'if (!saveGlobal(KEY, cfg)) setMsg("⚠ 存储空间不足，未能保存");',
            'if (!saveGlobal(KEY, cfg)) setMsg("存储空间不足，未能保存");',
        ),
        (
            '{bal ? `⚠ 花括号不配平（${bal > 0 ? `少 ${bal} 个 }` : `多 ${-bal} 个 }`}）`',
            '{bal ? `花括号不配平（${bal > 0 ? `少 ${bal} 个 }` : `多 ${-bal} 个 }`}）`',
        ),
    ],
)

patch_file(
    "AiImageGen.tsx",
    ["IconSpark"],
    [
        (
            '<p className="text-[11.5px] font-bold text-coral">✦ AI 生成</p>',
            '<p className="flex items-center gap-1 text-[11.5px] font-bold text-coral"><IconSpark size={14} /> AI 生成</p>',
        ),
    ],
)

patch_file(
    "BgmPanel.tsx",
    ["StatusMark"],
    [
        (
            '{s.error && <p className="text-[11.5px] text-danger">⚠ {s.error}</p>}',
            '{s.error && <p className="text-[11.5px] text-danger"><StatusMark kind="warn">{s.error}</StatusMark></p>}',
        ),
    ],
)

patch_file(
    "ActionsTab.tsx",
    ["StarRating"],
    [
        (
            '{"★".repeat(tier)}<span className="text-ink-soft/60">{"☆".repeat(5 - tier)}</span>',
            '<StarRating n={tier} />',
        ),
    ],
)

patch_file(
    "ContractDoc.tsx",
    ["IconStar"],
    [
        (
            '<span className="absolute text-[26px] text-[#b0342d] opacity-70">★</span>',
            '<span className="absolute text-[#b0342d] opacity-70"><IconStar size={26} /></span>',
        ),
    ],
)

patch_file(
    "FixedPersonPanel.tsx",
    ["IconCheck"],
    [
        (
            '{saved ? "已保存 ✓" : !ok ? "请先填写姓名" : dirty ? "保存" : "已是最新"}',
            '{saved ? <span className="inline-flex items-center gap-1">已保存 <IconCheck size={12} /></span> : !ok ? "请先填写姓名" : dirty ? "保存" : "已是最新"}',
        ),
        (
            '{saved ? "已保存 ✓" : dirty ? "保存" : "已是最新"}',
            '{saved ? <span className="inline-flex items-center gap-1">已保存 <IconCheck size={12} /></span> : dirty ? "保存" : "已是最新"}',
        ),
    ],
)

patch_file(
    "GameTour.tsx",
    [],
    [
        (
            "带 ✦ 的是剧情事件",
            "带闪光标记的是剧情事件",
        ),
    ],
)

patch_file(
    "ModCarsEditor.tsx",
    ["IconSpark"],
    [
        (
            '{busy ? "生成中…" : "✦ AI 生成"}',
            '{busy ? "生成中…" : <span className="inline-flex items-center gap-1"><IconSpark size={14} /> AI 生成</span>}',
        ),
    ],
)

patch_file(
    "MudChrome.tsx",
    [],
    [
        ("仍可从 ☰ 菜单进入。", "仍可从菜单进入。"),
    ],
)

patch_file(
    "NamePicker.tsx",
    ["IconDice"],
    [
        (
            '<button onClick={() => setRecs(roll())} className="text-[12px] text-jade">🎲 换一批</button>',
            '<button onClick={() => setRecs(roll())} className="inline-flex items-center gap-1 text-[12px] text-jade"><IconDice size={14} /> 换一批</button>',
        ),
    ],
)

patch_file(
    "MapLibraryPanel.tsx",
    ["IconStar"],
    [
        (
            '{p.useOnStart && !other ? "★ " : ""}{p.name}',
            '{p.useOnStart && !other ? <IconStar size={12} className="mr-0.5 inline" /> : null}{p.name}',
        ),
    ],
)

patch_file(
    "MapSpotExtras.tsx",
    ["IconCheck", "IconSpark", "IconStar"],
    [
        (
            '{isStart ? "★ 默认开局起点" : "默认开局起点"}',
            '{isStart ? <span className="inline-flex items-center gap-1"><IconStar size={12} /> 默认开局起点</span> : "默认开局起点"}',
        ),
        (
            '{isImg(e.icon) ? <img src={(e.icon) || undefined} alt="" className="h-6 w-6 object-contain" /> : e.icon || "◈"}',
            '{isImg(e.icon) ? <img src={(e.icon) || undefined} alt="" className="h-6 w-6 object-contain" /> : e.icon ? e.icon : <IconSpark size={16} />}',
        ),
        (
            '{on ? "✓ " : ""}<span className="opacity-60">{o.group}·</span>{o.name}',
            '{on ? <IconCheck size={12} className="mr-0.5 inline" /> : null}<span className="opacity-60">{o.group}·</span>{o.name}',
        ),
    ],
)

patch_file(
    "MapEditorPanel.tsx",
    ["IconSpark"],
    [
        (
            '{loc.icon || "◈"}',
            '{loc.icon || <IconSpark size={16} />}',
        ),
        (
            '<span className="text-[13px] font-bold text-jade">✦</span>',
            '<span className="text-jade"><IconSpark size={13} /></span>',
        ),
        (
            '<span className="text-[14px] leading-none text-coral">✦</span>',
            '<span className="leading-none text-coral"><IconSpark size={14} /></span>',
        ),
    ],
)

patch_file(
    "TopbarView.tsx",
    ["IconMenu"],
    [
        ('name.trim()[0] ?? "★"', 'name.trim()[0] ?? "?"'),
        (
            '<DiyIcon slot="top.menu" size={18}>☰</DiyIcon>',
            '<DiyIcon slot="top.menu" size={18}><IconMenu size={18} /></DiyIcon>',
        ),
    ],
)

patch_file(
    "IconDiyPanel.tsx",
    ["IconMenu"],
    [
        (
            '<DiyIcon slot="top.menu" size={19}>☰</DiyIcon>',
            '<DiyIcon slot="top.menu" size={19}><IconMenu size={19} /></DiyIcon>',
        ),
        (
            '{g === "main" ? "主界面" : "☰ 菜单"}',
            '{g === "main" ? "主界面" : "菜单"}',
        ),
    ],
)

patch_file(
    "WeekReportCard.tsx",
    [],
    [
        ('w.replace(/^⚠\\s*/, "")', 'w.replace(/^\\u26A0\\s*/, "")'),
    ],
)

patch_file(
    "StatsTunePanel.tsx",
    ["StatusMark"],
    [
        (
            '{msg.ok ? "✓ " : "⚠ "}{msg.text}',
            '<StatusMark kind={msg.ok ? "ok" : "warn"}>{msg.text}</StatusMark>',
        ),
    ],
)

patch_file(
    "WorldBookPanel.tsx",
    ["StatusMark"],
    [
        (
            '{msg.ok ? "✓ " : "⚠ "}{msg.text}',
            '<StatusMark kind={msg.ok ? "ok" : "warn"}>{msg.text}</StatusMark>',
        ),
    ],
)

patch_file(
    "ScheduleBoard.tsx",
    ["IconCheck", "StatusMark"],
    [
        (
            '{chosen && <span className="text-[10px] text-jade">✓ 已排</span>}',
            '{chosen && <span className="text-[10px] text-jade"><StatusMark kind="ok">已排</StatusMark></span>}',
        ),
        (
            '{m.name}{chosen && <span className="ml-1 text-[10px] text-jade">✓</span>}',
            '{m.name}{chosen && <span className="ml-1 inline-flex text-[10px] text-jade"><IconCheck size={12} /></span>}',
        ),
        (
            '<p key={i} className="text-[12px] text-danger">⚠ {w}</p>',
            '<p key={i} className="text-[12px] text-danger"><StatusMark kind="warn">{w}</StatusMark></p>',
        ),
    ],
)

patch_file(
    "StoryQuestPanel.tsx",
    ["IconCheck", "IconStar"],
    [
        (
            '>✓</span>',
            '><IconCheck size={16} /></span>',
        ),
        (
            '{e.fav ? "★" : "☆"}',
            '{e.fav ? <IconStar size={14} /> : <IconStar size={14} className="opacity-30" />}',
        ),
    ],
)

patch_file(
    "ModCenter.tsx",
    ["StatusMark"],
    [
        (
            '{warnings.map((w, i) => <p key={i} className="text-[11px] text-gold">⚠ {w}</p>)}',
            '{warnings.map((w, i) => <p key={i} className="text-[11px] text-gold"><StatusMark kind="warn">{w}</StatusMark></p>)}',
        ),
        (
            '{d.ok ? "✓" : "✕"} {d.text}',
            '<StatusMark kind={d.ok ? "ok" : "err"}>{d.text}</StatusMark>',
        ),
        (
            '{h.level === "ok" ? "✓" : h.level === "error" ? "✕" : "⚠"} {h.text}',
            '<StatusMark kind={h.level === "ok" ? "ok" : h.level === "error" ? "err" : "warn"}>{h.text}</StatusMark>',
        ),
        (
            '{refs.map((r, i) => <li key={i}>⚠ {r}</li>)}</ul> : <p className="text-jade">✓ 没有其他 MOD 或存档内容依赖它，可安全关闭 / 卸载</p>)}',
            '{refs.map((r, i) => <li key={i}><StatusMark kind="warn">{r}</StatusMark></li>)}</ul> : <p className="text-jade"><StatusMark kind="ok">没有其他 MOD 或存档内容依赖它，可安全关闭 / 卸载</StatusMark></p>)}',
        ),
    ],
)

patch_file(
    "ModExtEditor.tsx",
    ["StatusMark"],
    [
        (
            '{h.level === "ok" ? "✓" : h.level === "error" ? "✕" : "⚠"} {h.text}',
            '<StatusMark kind={h.level === "ok" ? "ok" : h.level === "error" ? "err" : "warn"}>{h.text}</StatusMark>',
        ),
    ],
)

patch_file(
    "ModPackEditors.tsx",
    ["StarRating"],
    [
        (
            '{[1, 2, 3, 4, 5].map((s) => <th key={s} className="px-0.5 font-semibold text-gold">{"★".repeat(s)}</th>)}',
            '{[1, 2, 3, 4, 5].map((s) => <th key={s} className="px-0.5 font-semibold text-gold"><StarRating n={s} /></th>)}',
        ),
        (
            '<span className="w-12 shrink-0 text-[10.5px] text-gold">{"★".repeat(Math.max(1, Math.min(5, g.star)))}</span>',
            '<span className="w-12 shrink-0 text-[10.5px] text-gold"><StarRating n={Math.max(1, Math.min(5, g.star))} /></span>',
        ),
    ],
)

patch_file(
    "ModCreationFieldsEditor.tsx",
    ["IconLock"],
    [
        (
            '{c.locked && <Badge tone="gold">🔒 锁定</Badge>}',
            '{c.locked && <Badge tone="gold"><span className="inline-flex items-center gap-1"><IconLock size={12} /> 锁定</span></Badge>}',
        ),
        (
            '{f.locked && <Badge tone="gold">🔒 锁定</Badge>}',
            '{f.locked && <Badge tone="gold"><span className="inline-flex items-center gap-1"><IconLock size={12} /> 锁定</span></Badge>}',
        ),
    ],
)

patch_file(
    "personFields.tsx",
    ["IconHeart", "IconHome", "IconSpark", "IconUser", "IconUsers"],
    [
        (
            '<span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-[10px] text-white shadow-sm">✦</span>',
            '<span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-sm"><IconSpark size={12} /></span>',
        ),
        (
            'const RELATION_GLYPH: Record<RelationKey, string> = { 现任: "♡", 前任: "◌", 父母: "⌂", 子女: "✧", 其他: "⋯" };',
            'const RELATION_GLYPH: Record<RelationKey, string> = { 现任: "", 前任: "", 父母: "", 子女: "", 其他: "" };',
        ),
    ],
)

patch_file(
    "NpcTab.tsx",
    ["IconHeart", "IconSpark"],
    [
        (
            '{arc && romanceOn && <p className="mb-1 text-[11.5px] font-semibold text-gold">✦ 固定角色 · 专属情感长线</p>}',
            '{arc && romanceOn && <p className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold text-gold"><IconSpark size={14} /> 固定角色 · 专属情感长线</p>}',
        ),
        (
            '{!dead && isDating && <Chip tone="coral">♥ 恋人</Chip>}',
            '{!dead && isDating && <Chip tone="coral"><span className="inline-flex items-center gap-1"><IconHeart size={12} /> 恋人</span></Chip>}',
        ),
        (
            '<span className="text-gold">✦</span>',
            '<span className="text-gold"><IconSpark size={14} /></span>',
        ),
        (
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-coral/15 text-[12px] text-coral">♥</span>',
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-coral/15 text-coral"><IconHeart size={14} /></span>',
        ),
        (
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-line/60 text-[12px] text-ink-soft">♥</span>',
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-line/60 text-ink-soft"><IconHeart size={14} /></span>',
        ),
        (
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-jade/15 text-[12px] text-jade">✦</span>',
            '<span className="grid h-6 w-6 place-items-center rounded-full bg-jade/15 text-jade"><IconSpark size={14} /></span>',
        ),
    ],
)

patch_file(
    "GameShell.tsx",
    ["IconClock", "IconPin"],
    [
        (
            '{popup.scene.location && <span className="rounded-full bg-paper/80 px-2 py-0.5">📍 {popup.scene.location}</span>}',
            '{popup.scene.location && <span className="inline-flex items-center gap-1 rounded-full bg-paper/80 px-2 py-0.5"><IconPin size={12} /> {popup.scene.location}</span>}',
        ),
        (
            '{popup.scene.time && <span className="rounded-full bg-paper/80 px-2 py-0.5">🕰 {popup.scene.time}</span>}',
            '{popup.scene.time && <span className="inline-flex items-center gap-1 rounded-full bg-paper/80 px-2 py-0.5"><IconClock size={12} /> {popup.scene.time}</span>}',
        ),
    ],
)

patch_file(
    "Ending.tsx",
    ["IconHeart"],
    [
        ("以后也要继续幸福哦 ♡", "以后也要继续幸福哦"),
        ("我一直都在为你骄傲 ♡", "我一直都在为你骄傲"),
        ("下一段故事会温柔地等着你 ♡", "下一段故事会温柔地等着你"),
        (
            '谢谢你一路相伴 <span className="text-[#ef6b9c]">♡</span>',
            '谢谢你一路相伴 <IconHeart size={14} className="inline text-[#ef6b9c]" />',
        ),
        (
            '致 {d.name} <span className="text-[#ef6b9c]">♡</span>',
            '致 {d.name} <IconHeart size={14} className="inline text-[#ef6b9c]" />',
        ),
        (
            '—— {d.commenter} <span className="text-[#ef6b9c]">♡</span>',
            '—— {d.commenter} <IconHeart size={14} className="inline text-[#ef6b9c]" />',
        ),
        (
            '<span className="text-[#ef6b9c]">♡</span>',
            '<IconHeart size={14} className="inline text-[#ef6b9c]" />',
        ),
    ],
)

patch_file(
    "phone/PeekApp.tsx",
    ["IconHeart", "IconLock"],
    [
        (
            '<span className="rounded-full bg-[#bf5af2]/25 px-1.5 text-[10px] font-medium text-[#e3b8ff]">♡ {r.inner.length} 条心声</span>',
            '<span className="inline-flex items-center gap-0.5 rounded-full bg-[#bf5af2]/25 px-1.5 text-[10px] font-medium text-[#e3b8ff]"><IconHeart size={12} /> {r.inner.length} 条心声</span>',
        ),
        (
            '{m.private && <span className="rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[10.5px] text-[#636366]">🔒 仅自己可见</span>}',
            '{m.private && <span className="inline-flex items-center gap-0.5 rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[10.5px] text-[#636366]"><IconLock size={12} /> 仅自己可见</span>}',
        ),
        (
            '{lockedD ? "🔒 " : ""}{d.title}',
            '{lockedD ? <IconLock size={14} className="mr-1 inline" /> : null}{d.title}',
        ),
    ],
)

patch_file(
    "phone/chat.tsx",
    ["IconClose"],
    [
        (
            'className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#b2b2b2] text-[10px] leading-none text-white">✕</button>',
            'className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#b2b2b2] text-white"><IconClose size={10} /></button>',
        ),
    ],
)

patch_file(
    "phone/CoupleApp.tsx",
    ["IconFlower", "IconHeart"],
    [
        (
            'style={{ color: ROSE }} aria-label="装扮">✿</button>',
            'style={{ color: ROSE }} aria-label="装扮"><IconFlower size={14} /></button>',
        ),
        (
            '<span className="text-[18px]" style={{ color: ROSE }}>♡</span>',
            '<span style={{ color: ROSE }}><IconHeart size={18} /></span>',
        ),
        (
            '<span className="text-[9.5px]" style={{ color: SOFT, fontFamily: MONO }}>♡ {n.affinity}</span>',
            '<span className="inline-flex items-center gap-0.5 text-[9.5px]" style={{ color: SOFT, fontFamily: MONO }}><IconHeart size={10} /> {n.affinity}</span>',
        ),
        (
            '<span className="mt-6 text-[14px]" style={{ color: ROSE }}>♥</span>',
            '<span className="mt-6" style={{ color: ROSE }}><IconHeart size={14} /></span>',
        ),
        (
            '{celebrated ? `已和 ${npc.name} 一起过 ♡` : celebrating ? `${npc.name} 正在写信给你…` : `和 ${npc.name} 一起过`}',
            '{celebrated ? `已和 ${npc.name} 一起过` : celebrating ? `${npc.name} 正在写信给你…` : `和 ${npc.name} 一起过`}',
        ),
        (
            '<Tile v="anniv" icon="❀" label="纪念日"',
            '<Tile v="anniv" icon="" label="纪念日"',
        ),
        (
            "右上角 ✿ 可以更换主页背景",
            "右上角花朵按钮可以更换主页背景",
        ),
    ],
)

patch_file(
    "phone/ForumApp.tsx",
    ["IconCheck", "IconClose", "IconHeart", "IconStar"],
    [
        (
            'npcNames.has(u) ? `✓ ${c}` : c',
            'npcNames.has(u) ? c : c',
        ),
        (
            '{f === "认证" ? "✓ 认证" : f === "正主" ? "★ 正主" : f}',
            '{f === "认证" ? <span className="inline-flex items-center gap-0.5"><IconCheck size={10} /> 认证</span> : f === "正主" ? <span className="inline-flex items-center gap-0.5"><IconStar size={10} /> 正主</span> : f}',
        ),
        (
            '<span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#5b6cff]/12 text-[14px] text-[#5b6cff]">♡</span>',
            '<span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#5b6cff]/12 text-[#5b6cff]"><IconHeart size={14} /></span>',
        ),
        (
            '{o.t}{p.vote === i && " ✓"}',
            '{o.t}{p.vote === i && <IconCheck size={12} className="ml-0.5 inline" />}',
        ),
        (
            '{p.liked.has(t.id) ? "♥" : "♡"} {t.likes + (p.liked.has(t.id) ? 1 : 0)}',
            '<span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {t.likes + (p.liked.has(t.id) ? 1 : 0)}</span>',
        ),
        (
            '{p.busy === "star" ? "正主赶来中…" : t.starCame ? "★ 正主已下场" : "★ 正主下场"}',
            '{p.busy === "star" ? "正主赶来中…" : t.starCame ? "正主已下场" : "正主下场"}',
        ),
        (
            '{lk ? "♥" : "♡"} {f.likes + (lk ? 1 : 0)}',
            '<span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {f.likes + (lk ? 1 : 0)}</span>',
        ),
    ],
)

patch_file(
    "phone/WeChatApp.tsx",
    ["IconCheck", "IconHeart"],
    [
        (
            '>♥ {liked ? "已赞" : v.likes}</button>',
            '><span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {liked ? "已赞" : v.likes}</span></button>',
        ),
        (
            '{on ? "✓" : ""}',
            '{on ? <IconCheck size={12} /> : ""}',
        ),
    ],
)

patch_file(
    "phone/BossZhipinApp.tsx",
    ["IconCheck"],
    [
        (
            '{artistOk ? "名气达标 ✓" : `名气门槛 ${job.fameReq}`}',
            '{artistOk ? <span className="inline-flex items-center gap-0.5">名气达标 <IconCheck size={12} /></span> : `名气门槛 ${job.fameReq}`}',
        ),
    ],
)

patch_file(
    "phone/studio/Studio.tsx",
    ["IconCheck"],
    [
        (
            '{ok ? "✓ " : ""}{r.label}',
            '{ok ? <IconCheck size={10} className="mr-0.5 inline" /> : null}{r.label}',
        ),
        (
            '{iconMsg.ok ? "✓ " : "图标不符合要求："}{iconMsg.text}',
            '{iconMsg.ok ? <IconCheck size={12} className="mr-0.5 inline" /> : "图标不符合要求："}{iconMsg.text}',
        ),
        (
            '{done ? "✓" : i + 1}',
            '{done ? <IconCheck size={10} /> : i + 1}',
        ),
    ],
)

patch_file(
    "phone/studio/Slime.tsx",
    ["IconCheck"],
    [
        (
            '{mode === m ? "✓" : ""}',
            '{mode === m ? <IconCheck size={10} /> : ""}',
        ),
    ],
)

patch_file(
    "phone/XianyuApp.tsx",
    ["IconHeart"],
    [
        (
            '<p className="mt-0.5 text-[11px] text-ink-soft">👀 {buzz.views} 浏览 · ❤ {buzz.wants} 想要 · 💬 {buzz.msgs} 留言</p>',
            '<p className="mt-0.5 inline-flex flex-wrap items-center gap-x-1 text-[11px] text-ink-soft">{buzz.views} 浏览 · <IconHeart size={12} /> {buzz.wants} 想要 · {buzz.msgs} 留言</p>',
        ),
    ],
)

patch_file(
    "phone/screenShare.tsx",
    ["IconImage"],
    [
        (
            '<span className="text-[24px]">🖼️</span><span className="text-[13px] font-medium">从相册上传</span>',
            '<IconImage size={24} /><span className="text-[13px] font-medium">从相册上传</span>',
        ),
    ],
)

print("phase4 done")



