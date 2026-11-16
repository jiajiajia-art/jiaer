#!/usr/bin/env python3
"""Safe GameSettingEditor i18n migration."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GSE = ROOT / "src/components/GameSettingEditor"
LOCALE_ZH = ROOT / "src/i18n/locales/zh.json"
LOCALE_EN = ROOT / "src/i18n/locales/en.json"
LOCALE_JA = ROOT / "src/i18n/locales/ja.json"
PARTS = ROOT / "scripts/i18n-parts"

SKIP = re.compile(r"功能注释|效果图|创作界面切图|eslint|FIXME|TODO")
ZH = re.compile(r"[\u4e00-\u9fff]")
DEBUG = re.compile(r"===|\[Character|console\.|fetch 失败|✗|→|原始\)|带cache")
SIMPLE_STR = re.compile(r"""(?P<q>['"])(?P<c>(?:\\.|(?!\1).)*?)\1""")


def leaf_map(obj, prefix=""):
    m = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            m.update(leaf_map(v, f"{prefix}.{k}" if prefix else k))
    elif isinstance(obj, str) and ZH.search(obj):
        m[obj] = prefix
    return m


def get_path(loc, key_path: str) -> str | None:
    o = loc
    for p in key_path.split("."):
        if not isinstance(o, dict) or p not in o:
            return None
        o = o[p]
    return o if isinstance(o, str) else None


def strip_comments(text: str) -> str:
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j == -1 else j
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j == -1:
                break
            i = j + 2
            continue
        if text[i] in "'\"`":
            q = text[i]
            out.append(q)
            i += 1
            while i < n:
                c = text[i]
                out.append(c)
                i += 1
                if c == "\\" and i < n:
                    out.append(text[i])
                    i += 1
                    continue
                if c == q:
                    break
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def remove_fallbacks(text: str) -> str:
    text = re.sub(
        r"(ctx\.t)\?\.\(([^)]+)\)\s*\|\|\s*['\"`][^'\"`\n]*['\"`]",
        r"\1(\2)",
        text,
    )
    text = re.sub(
        r"\bt\(([^)]+)\)\s*\|\|\s*['\"`][^'\"`\n]*['\"`]",
        r"t(\1)",
        text,
    )
    text = re.sub(r"ctx\.t\?\.", "ctx.t.", text)
    return text


def i18n_import(fp: Path) -> str:
    depth = len(fp.relative_to(ROOT / "src").parts) - 1
    return "/".join([".."] * depth) + "/i18n"


def file_prefix(fp: Path) -> str:
    rel = fp.relative_to(GSE).as_posix()
    rel = rel.replace(".tsx", "").replace(".ts", "")
    return ".".join(s[0].lower() + s[1:] if s else s for s in rel.split("/"))


def new_key(fp: Path, zh: str, used: set[str]) -> str:
    h = hashlib.sha1(zh.encode("utf-8")).hexdigest()[:10]
    base = f"gameSettingEditor.{file_prefix(fp)}.s{h}"
    n = 2
    k = base
    while k in used:
        k = f"{base}_{n}"
        n += 1
    used.add(k)
    return k


def set_nested(root: dict, key_path: str, value: str) -> None:
    parts = key_path.split(".")[1:]  # drop gameSettingEditor
    cur = root.setdefault("gameSettingEditor", {})
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def should_skip_string(zh: str, context_line: str) -> bool:
    if SKIP.search(zh):
        return True
    if DEBUG.search(context_line) or DEBUG.search(zh):
        return True
    if "gameSettingEditor" in zh:
        return True
    if len(zh) > 200:
        return True
    return False


def replace_line(line: str, zh_to_key: dict, new_map: dict, handler: bool) -> str:
    if line.lstrip().startswith("//") or line.lstrip().startswith("*"):
        return line
    if re.search(r"t\(\s*['\"`]gameSettingEditor", line):
        return line

    def sub(m):
        q, c = m.group("q"), m.group("c")
        if not ZH.search(c) or should_skip_string(c, line):
            return m.group(0)
        if "${" in c:
            return m.group(0)
        key = zh_to_key.get(c) or new_map.get(c)
        if not key:
            return m.group(0)
        if handler:
            return f"(ctx.t ?? i18n.t)('{key}')"
        return f"t('{key}')"

    return SIMPLE_STR.sub(sub, line)


def ensure_imports(text: str, fp: Path, handler: bool) -> str:
    needs_t = bool(re.search(r"(?<![\w.])t\(['\"]", text)) and fp.suffix == ".tsx"
    needs_i18n = handler or (fp.suffix == ".ts" and "i18n.t(" in text)

    if needs_t and "useTranslation" not in text:
        first = text.find("\n", text.find("import ")) + 1
        text = text[:first] + "import { useTranslation } from 'react-i18next';\n" + text[first:]

    if needs_t and "const { t } = useTranslation()" not in text:
        m = re.search(
            r"(const \w+: React\.FC[^=]+= \(\{[\s\S]*?\}\) => \{)",
            text,
        )
        if not m:
            m = re.search(r"(= \(\{[\s\S]*?\}\) => \{)", text)
        if m:
            text = text[: m.end()] + "\n    const { t } = useTranslation();\n" + text[m.end() :]

    if needs_i18n and "import i18n from" not in text:
        text = f"import i18n from '{i18n_import(fp)}';\n" + text

    if fp.suffix == ".ts" and not handler:
        text = re.sub(r"(?<![\w.])t\(", "i18n.t(", text)

    return text


EN_OVERRIDES: dict[str, str] = {}
JA_OVERRIDES: dict[str, str] = {}


def en_for(zh: str, en_locale, key: str | None) -> str:
    if key:
        v = get_path(en_locale, key)
        if v and v != key:
            return v
    return EN_OVERRIDES.get(zh, zh)


def ja_for(zh: str, ja_locale, key: str | None) -> str:
    if key:
        v = get_path(ja_locale, key)
        if v and v != key:
            return v
    if zh in JA_OVERRIDES:
        return JA_OVERRIDES[zh]
    if zh.endswith("，请稍后重试") or zh.endswith("，请重试"):
        return zh.replace("，", "。").replace("请", "お手数ですが").replace("稍后重试", "しばらくしてからもう一度お試しください")
    if zh.endswith("成功"):
        return zh[:-2] + "が完了しました"
    if zh.endswith("失败"):
        return zh[:-2] + "に失敗しました"
    return zh


def count_hits(files):
    n = 0
    for fp in files:
        body = strip_comments(fp.read_text(encoding="utf-8"))
        for m in SIMPLE_STR.finditer(body):
            c = m.group("c")
            if ZH.search(c) and not SKIP.search(c):
                n += 1
    return n


def main():
    zh_locale = json.loads(LOCALE_ZH.read_text(encoding="utf-8"))
    en_locale = json.loads(LOCALE_EN.read_text(encoding="utf-8"))
    ja_locale = json.loads(LOCALE_JA.read_text(encoding="utf-8"))
    zh_to_key = leaf_map(zh_locale)

    files = sorted(
        p for p in GSE.rglob("*") if p.suffix in (".ts", ".tsx") and "typeAdapter.example" not in p.name
    )

    # Pass 0: remove fallbacks
    for fp in files:
        raw = fp.read_text(encoding="utf-8")
        cleaned = remove_fallbacks(raw)
        if cleaned != raw:
            fp.write_text(cleaned, encoding="utf-8")

    # Collect strings still hardcoded
    new_strings: dict[str, str] = {}
    used: set[str] = set()
    for fp in files:
        text = strip_comments(fp.read_text(encoding="utf-8"))
        for line in text.splitlines():
            for m in SIMPLE_STR.finditer(line):
                c = m.group("c")
                if not ZH.search(c) or should_skip_string(c, line):
                    continue
                if c in zh_to_key:
                    continue
                if c not in new_strings:
                    new_strings[c] = new_key(fp, c, used)

    zh_part: dict = {}
    en_part: dict = {}
    ja_part: dict = {}
    for zh, kp in sorted(new_strings.items(), key=lambda x: x[1]):
        exist = zh_to_key.get(zh)
        set_nested(zh_part, kp, zh)
        set_nested(en_part, kp, en_for(zh, en_locale, exist))
        set_nested(ja_part, kp, ja_for(zh, ja_locale, exist))

    changed = []
    for fp in files:
        raw = fp.read_text(encoding="utf-8")
        handler = fp.name == "handlers.ts"
        lines = [replace_line(ln, zh_to_key, new_strings, handler) for ln in raw.splitlines(keepends=True)]
        new_text = "".join(lines)
        new_text = ensure_imports(new_text, fp, handler)
        if new_text != raw:
            fp.write_text(new_text, encoding="utf-8")
            changed.append(fp.relative_to(GSE).as_posix())

    PARTS.mkdir(parents=True, exist_ok=True)
    (PARTS / "gameSetting.zh.json").write_text(
        json.dumps(zh_part if zh_part else {"gameSettingEditor": {}}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (PARTS / "gameSetting.en.json").write_text(
        json.dumps(en_part if en_part else {"gameSettingEditor": {}}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (PARTS / "gameSetting.ja.json").write_text(
        json.dumps(ja_part if ja_part else {"gameSettingEditor": {}}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    leaf_count = 0

    def leaves(o):
        nonlocal leaf_count
        if isinstance(o, dict):
            for v in o.values():
                leaves(v)
        elif isinstance(o, str):
            leaf_count += 1

    leaves(zh_part.get("gameSettingEditor", {}))

    print(
        json.dumps(
            {
                "newKeys": leaf_count,
                "changedFiles": len(changed),
                "remainingHits": count_hits(files),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
