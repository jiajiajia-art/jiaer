#!/usr/bin/env python3
"""Apply adminUi i18n to scoped admin files. Writes admin.{zh,en,ja}.json parts only."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PARTS = ROOT / "scripts" / "i18n-parts"

SCOPE: list[str] = [
    "components/admin",
    "components/admin-shell",
    "page/AdminPanel.tsx",
    "components/PromotionAdminManager.tsx",
    "components/WithdrawAdminManager.tsx",
    "components/CreatorIncentiveAdminManager.tsx",
    "components/DailyTasksAdminManager.tsx",
    "components/SubscriptionAdminManager.tsx",
    "components/ActivityBannerManager.tsx",
    "components/AdminBannerManager.tsx",
    "components/CreatorEarnings",
]

SKIP_FILES = re.compile(r"(adminTheme|navigationBadges|\.module\.)")

STRING_RE = re.compile(
    r"(?P<q>['\"`])(?P<body>(?:\\.|(?!\1)[\s\S])*?[\u4e00-\u9fff](?:\\.|(?!\1)[\s\S])*?)\1"
)

COMMENT_LINE = re.compile(r"^\s*(//|/\*|\*)")
FUNC_COMMENT = re.compile(r"功能注释")

USE_TRANSLATION_IMPORT = "import { useTranslation } from 'react-i18next';"
I18N_IMPORT = "import i18n from 'i18next';"


def collect_files() -> list[Path]:
    out: list[Path] = []
    for item in SCOPE:
        p = SRC / item
        if not p.exists():
            continue
        if p.is_file():
            if p.suffix in {".ts", ".tsx"} and not SKIP_FILES.search(p.name):
                out.append(p)
            continue
        for fp in p.rglob("*"):
            if fp.suffix not in {".ts", ".tsx"}:
                continue
            if SKIP_FILES.search(str(fp)):
                continue
            out.append(fp)
    return sorted(set(out))


def is_inside_comment_line(line: str) -> bool:
    if COMMENT_LINE.match(line):
        return True
    if FUNC_COMMENT.search(line):
        return True
    return False


def slug_for_zh(zh: str) -> str:
    h = hashlib.sha1(zh.encode("utf-8")).hexdigest()[:10]
    return f"k{h}"


def categorize_key(zh: str, file_rel: str) -> str:
    """Stable key path under adminUi."""
    module = (
        file_rel.replace("src/", "")
        .replace(".tsx", "")
        .replace(".ts", "")
        .replace("/", ".")
        .replace("\\", ".")
    )
    return f"{module}.{slug_for_zh(zh)}"


def extract_strings(text: str) -> list[tuple[int, str, str]]:
    """Return (line_no, full_match, body) for Chinese string literals."""
    hits: list[tuple[int, str, str]] = []
    for i, line in enumerate(text.splitlines(), start=1):
        if is_inside_comment_line(line):
            continue
        for m in STRING_RE.finditer(line):
            body = m.group("body")
            if "\\u" in body and not re.search(r"[\u4e00-\u9fff]", body):
                continue
            if re.search(r"eslint|FIXME|TODO", body):
                continue
            hits.append((i, m.group(0), body))
    return hits


def body_to_t_expr(body: str, key: str) -> str:
    """Convert string body with optional {{var}} from ${...} in template literals."""
    if "${" in body:
        # Convert `text ${foo} more` -> t('key', { foo })
        parts = re.split(r"\$\{([^}]+)\}", body)
        if len(parts) == 1:
            return f"{{t('{key}')}}"
        # rebuild i18n string with {{name}} and values
        i18n_body = ""
        vars_map: dict[str, str] = {}
        idx = 0
        i = 0
        while i < len(parts):
            if i % 2 == 0:
                i18n_body += parts[i]
            else:
                expr = parts[i].strip()
                var_name = f"v{idx}"
                vars_map[var_name] = expr
                i18n_body += f"{{{{{var_name}}}}}"
                idx += 1
            i += 1
        if vars_map:
            args = ", ".join(f"{k}: {v}" for k, v in vars_map.items())
            return f"{{t('{key}', {{ {args} }})}}"
        return f"{{t('{key}')}}"
    return f"{{t('{key}')}}"


def ensure_hook_import(text: str, is_tsx: bool) -> str:
    if not is_tsx:
        return text
    if "useTranslation" in text:
        return text
    # insert after last import
    imports = list(re.finditer(r"^import .+$", text, flags=re.M))
    if not imports:
        return USE_TRANSLATION_IMPORT + "\n" + text
    last = imports[-1]
    insert_at = last.end()
    return text[:insert_at] + "\n" + USE_TRANSLATION_IMPORT + text[insert_at:]


def ensure_t_in_component(text: str) -> str:
    if "const { t } = useTranslation()" in text or "const {t} = useTranslation()" in text:
        return text
    if "useTranslation()" not in text:
        # insert after first const X: React.FC or function Component
        m = re.search(
            r"(const\s+\w+\s*:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*\{)",
            text,
        )
        if not m:
            m = re.search(r"(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)", text)
        if m:
            return text[: m.end()] + "\n  const { t } = useTranslation();" + text[m.end() :]
    return text


def set_nested(tree: dict, path: str, value: str) -> None:
    parts = path.split(".")
    cur = tree
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def translate_en_ja(zh: str, target: str) -> str:
    try:
        from deep_translator import GoogleTranslator  # type: ignore

        if target == "en":
            return GoogleTranslator(source="zh-CN", target="en").translate(zh)
        return GoogleTranslator(source="zh-CN", target="ja").translate(zh)
    except Exception:
        return zh


def process_file(fp: Path, strings_map: dict[str, str]) -> tuple[str, int]:
    rel = str(fp.relative_to(ROOT)).replace("\\", "/")
    is_tsx = fp.suffix == ".tsx"
    text = fp.read_text(encoding="utf-8")
    original = text
    hits = extract_strings(text)
    if not hits:
        return text, 0

    # Special file: adminNavigation uses t param, skip auto (handled separately)
    if rel.endswith("components/admin-shell/adminNavigation.tsx"):
        return text, 0

    lines = text.splitlines(keepends=True)
    count = 0
    # Process bottom-up by line to preserve offsets
    by_line: dict[int, list[tuple[str, str, str]]] = {}
    for line_no, full, body in hits:
        by_line.setdefault(line_no, []).append((full, body, full))

    for line_no in sorted(by_line.keys(), reverse=True):
        line = lines[line_no - 1]
        for full, body, _ in by_line[line_no]:
            key_path = categorize_key(body, rel)
            flat_key = f"adminUi.{key_path}"
            strings_map[flat_key] = body
            replacement = body_to_t_expr(body, flat_key)
            # If line is purely a string assignment at module level, skip (needs manual)
            if re.search(r"^(const|let)\s+\w+.*=\s*" + re.escape(full), line.strip()):
                # module-level label maps — replace value only if inside component later
                if "useTranslation" not in text:
                    continue
            if full.startswith("`"):
                new_piece = replacement
            elif full.startswith("'"):
                new_piece = replacement.strip("{}")  # inside JSX already has braces from body_to_t_expr
                if "{" not in line and ">" in line:
                    new_piece = replacement
                else:
                    new_piece = replacement
            else:
                new_piece = replacement
            if full in line:
                line = line.replace(full, new_piece, 1)
                count += 1
        lines[line_no - 1] = line

    text = "".join(lines)
    if count and is_tsx and "React.FC" in text or "function " in text:
        text = ensure_hook_import(text, is_tsx)
        text = ensure_t_in_component(text)
    if text != original:
        fp.write_text(text, encoding="utf-8")
    return text, count


def build_json_tree(strings_map: dict[str, str]) -> dict:
    tree: dict = {}
    for flat_key, zh in strings_map.items():
        assert flat_key.startswith("adminUi.")
        path = flat_key[len("adminUi.") :]
        set_nested(tree, path, zh)
    return {"adminUi": tree}


def merge_nav_manual(tree: dict) -> None:
    nav_path = PARTS / "_admin_nav.zh.json"
    if nav_path.exists():
        nav = json.loads(nav_path.read_text(encoding="utf-8"))
        tree.setdefault("adminUi", {}).setdefault("nav", {}).update(nav.get("nav", nav))


def main() -> None:
    files = collect_files()
    strings_map: dict[str, str] = {}
    changed: list[str] = []
    total = 0
    for fp in files:
        _, n = process_file(fp, strings_map)
        if n:
            changed.append(str(fp.relative_to(ROOT)))
            total += n

    # Load manual overrides / nav
    zh_tree = build_json_tree(strings_map)
    merge_nav_manual(zh_tree)

    en_tree = {"adminUi": {}}
    ja_tree = {"adminUi": {}}

    def walk_translate(node_zh, node_en, node_ja, prefix=""):
        if isinstance(node_zh, str):
            node_en_val = translate_en_ja(node_zh, "en")
            node_ja_val = translate_en_ja(node_zh, "ja")
            if prefix:
                set_nested(en_tree["adminUi"], prefix, node_en_val)
                set_nested(ja_tree["adminUi"], prefix, node_ja_val)
            return
        for k, v in node_zh.items():
            walk_translate(v, node_en, node_ja, f"{prefix}.{k}" if prefix else k)

    walk_translate(zh_tree.get("adminUi", {}), en_tree["adminUi"], ja_tree["adminUi"])

    PARTS.mkdir(parents=True, exist_ok=True)
    (PARTS / "admin.zh.json").write_text(
        json.dumps(zh_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (PARTS / "admin.en.json").write_text(
        json.dumps(en_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (PARTS / "admin.ja.json").write_text(
        json.dumps(ja_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        json.dumps(
            {
                "changedFiles": len(changed),
                "replacements": total,
                "stringKeys": len(strings_map),
                "changedSample": changed[:20],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
