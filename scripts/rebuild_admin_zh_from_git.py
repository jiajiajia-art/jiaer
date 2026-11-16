#!/usr/bin/env python3
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTS = ROOT / "scripts" / "i18n-parts"

STRING_RE = re.compile(
    r"'([^'\n]*[\u4e00-\u9fff][^'\n]*)'|\"([^\"\n]*[\u4e00-\u9fff][^\"\n]*)\"|`([^`\n]*[\u4e00-\u9fff][^`\n]*)`"
)
KEY_RE = re.compile(r"t\(['\"](adminUi\.[^'\"]+)['\"]")


def module_key(rel: str) -> str:
    rel = rel.replace("src/", "").replace(".tsx", "").replace(".ts", "")
    return re.sub(r"[^a-zA-Z0-9]+", "_", rel)


def leaf(zh: str) -> str:
    return "t" + hashlib.md5(zh.encode()).hexdigest()[:8]


def git_file(rel: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "show", f"HEAD:{rel}"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        ).decode("utf-8")
    except Exception:
        return None


def collect_zh_from_git() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for fp in ROOT.glob("src/**/*.tsx"):
        rel = fp.relative_to(ROOT).as_posix()
        if "adminUi" not in fp.read_text(encoding="utf-8") and rel.startswith("src/components/admin") is False:
            continue
    # all keys in parts
    zh_data = json.loads((PARTS / "admin.zh.json").read_text(encoding="utf-8"))

    def walk(o, prefix=""):
        if isinstance(o, dict):
            for k, v in o.items():
                yield from walk(v, f"{prefix}.{k}" if prefix else k)
        else:
            yield prefix, o

    keys = [k for k, _ in walk(zh_data["adminUi"]) if k.startswith("adminUi.") or True]

    # rebuild from git versions of each scoped module file
    scoped = list(ROOT.glob("src/components/admin/**/*.tsx"))
    scoped += list(ROOT.glob("src/components/admin-shell/*.tsx"))
    scoped += [
        ROOT / "src/page/AdminPanel.tsx",
        ROOT / "src/components/PromotionAdminManager.tsx",
        ROOT / "src/components/WithdrawAdminManager.tsx",
        ROOT / "src/components/CreatorIncentiveAdminManager.tsx",
        ROOT / "src/components/DailyTasksAdminManager.tsx",
        ROOT / "src/components/SubscriptionAdminManager.tsx",
        ROOT / "src/components/ActivityBannerManager.tsx",
        ROOT / "src/components/AdminBannerManager.tsx",
    ]
    scoped += list(ROOT.glob("src/components/CreatorEarnings/**/*.tsx"))

    for fp in scoped:
        if not fp.exists():
            continue
        rel = fp.relative_to(ROOT).as_posix()
        old = git_file(rel) or fp.read_text(encoding="utf-8")
        mod = module_key(rel)
        for line in old.splitlines():
            if line.strip().startswith("//") or "功能注释" in line:
                continue
            for m in STRING_RE.finditer(line):
                zh = m.group(1) or m.group(2) or m.group(3)
                k = f"adminUi.{mod}.{leaf(zh)}"
                mapping[k] = zh

    return mapping


def flat_tree(tree: dict, prefix="adminUi") -> dict[str, str]:
    out = {}
    for k, v in tree.items():
        key = f"{prefix}.{k}"
        if isinstance(v, dict):
            out.update(flat_tree(v, key))
        else:
            out[key] = v
    return out


def nest_tree(flat: dict[str, str]) -> dict:
    root: dict = {"adminUi": {}}

    def setp(parts, val):
        cur = root["adminUi"]
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = val

    for k, v in flat.items():
        assert k.startswith("adminUi.")
        setp(k.split(".")[1:], v)
    return root


def used_keys() -> set[str]:
    used: set[str] = set()
    for fp in ROOT.rglob("src/**/*.tsx"):
        used.update(KEY_RE.findall(fp.read_text(encoding="utf-8")))
    for fp in ROOT.rglob("src/**/*.ts"):
        used.update(KEY_RE.findall(fp.read_text(encoding="utf-8")))
    return used


def main():
    current = flat_tree(json.loads((PARTS / "admin.zh.json").read_text(encoding="utf-8"))["adminUi"])
    rebuilt = collect_zh_from_git()
    merged = {**current, **rebuilt}
    for k, v in list(merged.items()):
        if re.fullmatch(r"t[a-f0-9]{8}", str(v)) and k in rebuilt:
            merged[k] = rebuilt[k]
    used = used_keys()
    merged = {k: v for k, v in merged.items() if k in used}
    fixed = sum(1 for v in merged.values() if not re.fullmatch(r"t[a-f0-9]{8}", str(v)))
    root = nest_tree(merged)
    (PARTS / "admin.zh.json").write_text(json.dumps(root, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

  # sync en/ja for fixed keys only via simple copy rules
    en = json.loads((PARTS / "admin.en.json").read_text(encoding="utf-8"))
    ja = json.loads((PARTS / "admin.ja.json").read_text(encoding="utf-8"))
    en_flat = flat_tree(en["adminUi"])
    ja_flat = flat_tree(ja["adminUi"])
    for k, zh in merged.items():
        if k not in en_flat or en_flat[k] == ja_flat.get(k) or re.fullmatch(r"t[a-f0-9]{8}", str(en_flat.get(k, ""))):
            en_flat[k] = zh  # keep zh temporarily for untranslated - rebuild script will re-run build
        if k not in ja_flat or re.fullmatch(r"t[a-f0-9]{8}", str(ja_flat.get(k, ""))):
            ja_flat[k] = zh
    (PARTS / "admin.en.json").write_text(json.dumps(nest_tree(en_flat), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PARTS / "admin.ja.json").write_text(json.dumps(nest_tree(ja_flat), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"keys": len(merged), "withRealZh": fixed}, ensure_ascii=False))


if __name__ == "__main__":
    main()
