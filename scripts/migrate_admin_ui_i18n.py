#!/usr/bin/env python3
"""Migrate scoped admin UI strings to adminUi i18n parts + useTranslation."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PARTS = ROOT / "scripts" / "i18n-parts"

SCOPE = [
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

SKIP = re.compile(r"(adminTheme|navigationBadges|\.module\.)")

# --- navigation (semantic keys) ---
NAV_ZH = {
    "groups": {
        "admin-content": "内容管理",
        "admin-platform": "平台运营",
        "admin-account": "账户与权限",
        "admin-ai": "AI 与配置",
        "operator-overview": "数据分析",
        "operator-growth": "增长运营",
        "operator-content": "内容运营",
        "operator-platform": "平台配置",
        "admin-limited": "内容管理",
    },
    "items": {
        "announcements": "公告管理",
        "banners": "轮播图管理",
        "bannerHome": "首页轮播图",
        "bannerActivity": "活动轮播图",
        "themes": "题材管理",
        "documents": "文档管理",
        "comments": "评论管理",
        "points": "织梦豆管理",
        "pointsActivity": "活动奖励",
        "pointsSpecial": "特殊织梦豆",
        "dailyTasks": "每日任务管理",
        "lottery": "抽奖活动",
        "shareRatio": "分成比例",
        "diamonds": "KK币管理",
        "subscriptions": "会员管理",
        "membershipRecords": "会员状态记录",
        "membershipKeyGeneration": "兑换卡生成",
        "membershipKeyRecords": "兑换卡使用记录",
        "users": "用户角色",
        "withdraw": "提现管理",
        "withdrawApplications": "提现申请",
        "withdrawVerify": "创作者认证",
        "withdrawCreatorEarnings": "创作者收益提现",
        "aiModelCenter": "AI 模型中心",
        "aiModels": "模型与计费",
        "aiUsage": "用量与成本",
        "aiRuntime": "运行配置",
        "assetCenter": "素材中心",
        "avatars": "公共头像",
        "artStyles": "画风管理",
        "components": "组件管理",
        "stats": "数据概览",
        "reports": "运营报表",
        "promotions": "推广活动",
        "promotionList": "管理活动",
        "promotionCreate": "新增活动",
        "promotionTicker": "首页滚动通知",
        "promotionReviews": "投稿审核",
        "recruitment": "用户招募",
        "promoters": "推广者",
        "specialAuthors": "特殊作者",
        "platformWorks": "平台作品",
        "platformWorksList": "作品列表",
        "platformWorksAppeals": "发布申诉",
        "contentReports": "内容举报",
        "contentReportReviews": "举报审核",
        "contentReportPenalties": "处罚记录",
        "appeals": "申诉复核",
        "publishQueue": "发布队列",
        "platformBenefits": "平台权益",
        "locations": "地点库",
        "locationAssets": "地点素材库",
        "audioLibrary": "音频库",
        "feedback": "意见反馈",
        "businessCoop": "商务合作",
        "gameIssues": "作品问题",
    },
}

SHELL_ZH = {
    "logout": "退出登录",
    "brandAdmin": "管理面板",
    "brandOperator": "运营中心",
    "backHome": "返回首页",
    "openUserMenu": "打开用户菜单",
}

COMMON_EN = {
    "保存": "Save",
    "取消": "Cancel",
    "搜索": "Search",
    "刷新": "Refresh",
    "关闭": "Close",
    "加载中…": "Loading…",
    "加载失败": "Failed to load",
    "保存失败": "Failed to save",
    "上一页": "Previous",
    "下一页": "Next",
}

STRING_RE = re.compile(
    r"(?P<q>['\"`])(?P<body>(?:\\.|(?!\1)(?:[^\n\\]))*?[\u4e00-\u9fff](?:\\.|(?!\1)(?:[^\n\\]))*?)\1"
)


def collect_files() -> list[Path]:
    out: list[Path] = []
    for item in SCOPE:
        p = SRC / item
        if not p.exists():
            continue
        if p.is_file():
            if p.suffix in (".ts", ".tsx") and not SKIP.search(p.name):
                out.append(p)
            continue
        for fp in p.rglob("*"):
            if fp.suffix in (".ts", ".tsx") and not SKIP.search(str(fp)):
                out.append(fp)
    return sorted(set(out))


def module_key(fp: Path) -> str:
    rel = fp.relative_to(SRC).as_posix().replace(".tsx", "").replace(".ts", "")
    return re.sub(r"[^a-zA-Z0-9]+", "_", rel)


def leaf_key(zh: str) -> str:
    h = hashlib.md5(zh.encode()).hexdigest()[:8]
    return f"t{h}"


def zh_to_en(zh: str, cache: dict) -> str:
    if zh in cache:
        return cache[zh]
    if zh in COMMON_EN:
        cache[zh] = COMMON_EN[zh]
        return cache[zh]
    try:
        from deep_translator import GoogleTranslator

        en = GoogleTranslator(source="zh-CN", target="en").translate(zh)
        cache[zh] = en or zh
        time.sleep(0.05)
        return cache[zh]
    except Exception:
        cache[zh] = zh
        return zh


def zh_to_ja(zh: str, cache: dict) -> str:
    if zh in cache:
        return cache[zh]
    try:
        from deep_translator import GoogleTranslator

        ja = GoogleTranslator(source="zh-CN", target="ja").translate(zh)
        # Polite admin tone: prefer です/ます endings where obvious
        cache[zh] = ja or zh
        time.sleep(0.05)
        return cache[zh]
    except Exception:
        cache[zh] = zh
        return zh


def set_path(tree: dict, path: list[str], value: str) -> None:
    cur = tree
    for p in path[:-1]:
        cur = cur.setdefault(p, {})
    cur[path[-1]] = value


def extract_line_strings(line: str) -> list[tuple[str, str]]:
    if re.match(r"^\s*(//|\*|/\*)", line) or "功能注释" in line:
        return []
    out = []
    for m in STRING_RE.finditer(line):
        body = m.group("body")
        if re.search(r"eslint|FIXME|TODO", body):
            continue
        out.append((m.group(0), body))
    return out


def patch_navigation() -> None:
    fp = SRC / "components/admin-shell/adminNavigation.tsx"
    text = fp.read_text(encoding="utf-8")
    if "TFunction" in text:
        return
    text = text.replace(
        "import type { MenuProps } from 'antd';",
        "import type { MenuProps } from 'antd';\nimport type { TFunction } from 'i18next';",
    )
    text = text.replace(
        "const adminGroups = (badges: Record<string, number>): AdminNavigationGroup[] => [",
        "const adminGroups = (badges: Record<string, number>, t: TFunction): AdminNavigationGroup[] => [",
    )
    text = text.replace(
        "const operatorGroups = (isAdmin: boolean, badges: Record<string, number>): AdminNavigationGroup[] => [",
        "const operatorGroups = (isAdmin: boolean, badges: Record<string, number>, t: TFunction): AdminNavigationGroup[] => [",
    )
    text = text.replace(
        "export const getAdminNavigation = (",
        "export const getAdminNavigation = (",
    )
    text = re.sub(
        r"export const getAdminNavigation = \(\s*mode: AdminShellMode,\s*options: \{ isAdmin\?: boolean; userId\?: string; badges\?: Record<string, number> \} = {},\s*\):",
        "export const getAdminNavigation = (\n  mode: AdminShellMode,\n  options: { isAdmin?: boolean; userId?: string; badges?: Record<string, number> } = {},\n  t: TFunction,\n):",
        text,
    )
    text = text.replace(
        "if (mode === 'operator') return operatorGroups(Boolean(options.isAdmin), badges);",
        "if (mode === 'operator') return operatorGroups(Boolean(options.isAdmin), badges, t);",
    )
    text = text.replace(
        "return [{ key: 'admin-limited', label: '内容管理', items: [{ key: 'comments', label: '评论管理', path: '/admin/comments', icon: <CommentOutlined /> }] }];",
        "return [{ key: 'admin-limited', label: t('adminUi.nav.groups.admin-limited'), items: [{ key: 'comments', label: t('adminUi.nav.items.comments'), path: '/admin/comments', icon: <CommentOutlined /> }] }];",
    )
    text = text.replace(
        "return adminGroups(badges);",
        "return adminGroups(badges, t);",
    )
    fp.write_text(text, encoding="utf-8")


def replace_labels_in_navigation() -> None:
    fp = SRC / "components/admin-shell/adminNavigation.tsx"
    text = fp.read_text(encoding="utf-8")
    for section, mapping in [("groups", NAV_ZH["groups"]), ("items", NAV_ZH["items"])]:
        for key, zh in mapping.items():
            text = re.sub(
                rf"(key: '{re.escape(key)}',\s*)label: '{re.escape(zh)}'",
                rf"\1label: t('adminUi.nav.{section}.{key}')",
                text,
            )
    fp.write_text(text, encoding="utf-8")


def patch_admin_shell() -> None:
    fp = SRC / "components/admin-shell/AdminShell.tsx"
    text = fp.read_text(encoding="utf-8")
    if "useTranslation" not in text:
        text = text.replace(
            "import React, { useEffect, useMemo, useState } from 'react';",
            "import React, { useEffect, useMemo, useState } from 'react';\nimport { useTranslation } from 'react-i18next';",
        )
        text = text.replace(
            "const AdminShell: React.FC<AdminShellProps> = ({ mode, activeKey, children, userId, badges }) => {",
            "const AdminShell: React.FC<AdminShellProps> = ({ mode, activeKey, children, userId, badges }) => {\n  const { t } = useTranslation();",
        )
    text = text.replace(
        "getAdminNavigation(mode, {",
        "getAdminNavigation(mode, {",
    )
    text = text.replace(
        """    () => getAdminNavigation(mode, {
      isAdmin: isAdminRole(authUser?.role),
      userId: userId ?? authUser?.userId,
      badges,
    }),
    [authUser?.role, authUser?.userId, badges, mode, userId],""",
        """    () => getAdminNavigation(mode, {
      isAdmin: isAdminRole(authUser?.role),
      userId: userId ?? authUser?.userId,
      badges,
    }, t),
    [authUser?.role, authUser?.userId, badges, mode, userId, t],""",
    )
    repl = {
        "label: '退出登录'": "label: t('adminUi.shell.logout')",
        "mode === 'admin' ? '管理面板' : '运营中心'": "mode === 'admin' ? t('adminUi.shell.brandAdmin') : t('adminUi.shell.brandOperator')",
        ">\n                返回首页\n": ">\n                {t('adminUi.shell.backHome')}\n",
        "aria-label=\"打开用户菜单\"": "aria-label={t('adminUi.shell.openUserMenu')}",
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    fp.write_text(text, encoding="utf-8")


def process_files(strings_zh: dict[str, str]) -> tuple[list[str], int]:
    changed: list[str] = []
    total = 0
  # skip navigation file for generic pass
    skip_nav = SRC / "components/admin-shell/adminNavigation.tsx"

    for fp in collect_files():
        if fp == skip_nav:
            continue
        rel_mod = module_key(fp)
        text = fp.read_text(encoding="utf-8")
        original = text
        lines = text.splitlines(keepends=True)
        file_repl = 0

        for i, line in enumerate(lines):
            if re.match(r"^\s*(//|\*|/\*)", line) or "功能注释" in line:
                continue
            for full, body in extract_line_strings(line):
                lk = leaf_key(body)
                i18n_key = f"adminUi.{rel_mod}.{lk}"
                strings_zh[i18n_key] = body

                if "${" in body:
                    # template: keep literal for now if complex
                    if full.startswith("`"):
                        new = f"{{t('{i18n_key}')}}"
                    else:
                        continue
                else:
                    if full.startswith("'"):
                        new = f"{{t('{i18n_key}')}}"
                    elif full.startswith('"'):
                        new = f"{{t('{i18n_key}')}}"
                    else:
                        new = f"{{t('{i18n_key}')}}"

                # only replace in JSX / common patterns
                if "toast." in line or "<" in line or "placeholder=" in line or "aria-label=" in line or "title=" in line or "return " in line or "option" in line or "throw new Error" in line:
                    lines[i] = lines[i].replace(full, new, 1)
                    file_repl += 1

        new_text = "".join(lines)
        if file_repl and fp.suffix == ".tsx" and "useTranslation" not in new_text:
            new_text = new_text.replace(
                "import React",
                "import React",
                1,
            )
            if "from 'react-i18next'" not in new_text:
                new_text = re.sub(
                    r"(^import .+;\n)(?!import )",
                    r"\1import { useTranslation } from 'react-i18next';\n",
                    new_text,
                    count=1,
                    flags=re.M,
                )
            m = re.search(r"(const \w+[^=]*=\s*\([^)]*\)\s*=>\s*\{)", new_text)
            if m and "const { t }" not in new_text:
                new_text = new_text[: m.end()] + "\n  const { t } = useTranslation();" + new_text[m.end() :]

        if new_text != original:
            fp.write_text(new_text, encoding="utf-8")
            changed.append(fp.relative_to(ROOT).as_posix())
            total += file_repl
    return changed, total


def build_tree(strings_flat: dict[str, str]) -> dict:
    tree: dict = {}
    for k, v in strings_flat.items():
        assert k.startswith("adminUi.")
        parts = k.split(".")[1:]
        set_path(tree, parts, v)
    return tree


def main() -> None:
    try:
        import deep_translator  # noqa: F401
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "deep-translator", "-q"])

    strings_zh: dict[str, str] = {}

    patch_navigation()
    replace_labels_in_navigation()
    patch_admin_shell()

    changed, total = process_files(strings_zh)

    # shell + nav keys
    for k, v in SHELL_ZH.items():
        strings_zh[f"adminUi.shell.{k}"] = v
    for sec, mapping in NAV_ZH.items():
        for k, v in mapping.items():
            strings_zh[f"adminUi.nav.{sec}.{k}"] = v

    zh_tree = {"adminUi": build_tree(strings_zh)}
    en_cache: dict[str, str] = {}
    ja_cache: dict[str, str] = {}

    def translate_tree(node: dict, lang: str) -> dict:
        out: dict = {}
        for k, v in node.items():
            if isinstance(v, dict):
                out[k] = translate_tree(v, lang)
            else:
                out[k] = zh_to_en(v, en_cache) if lang == "en" else zh_to_ja(v, ja_cache)
        return out

    en_tree = {"adminUi": translate_tree(zh_tree["adminUi"], "en")}
    ja_tree = {"adminUi": translate_tree(zh_tree["adminUi"], "ja")}

    PARTS.mkdir(parents=True, exist_ok=True)
    (PARTS / "admin.zh.json").write_text(json.dumps(zh_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PARTS / "admin.en.json").write_text(json.dumps(en_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PARTS / "admin.ja.json").write_text(json.dumps(ja_tree, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "changedFiles": len(changed),
                "replacements": total,
                "stringKeys": len(strings_zh),
                "sampleChanged": changed[:15],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
