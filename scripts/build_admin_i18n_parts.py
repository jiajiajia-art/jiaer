#!/usr/bin/env python3
"""Fix migrate typos + build admin.{zh,en,ja}.json from scan hash keys."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PARTS = ROOT / "scripts" / "i18n-parts"
SCAN = PARTS / "_scan.json"

KEY_IN_SRC = re.compile(r"t\(['\"](adminUi\.[^'\"]+)['\"]")

NAV = {
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

SHELL = {
    "logout": "退出登录",
    "brandAdmin": "管理面板",
    "brandOperator": "运营中心",
    "backHome": "返回首页",
    "openUserMenu": "打开用户菜单",
}

JA_POLITE = {
    "保存": "保存いたします",
    "加载失败": "読み込みに失敗しました",
    "搜索": "検索",
    "关闭": "閉じる",
    "退出登录": "ログアウト",
    "管理面板": "管理パネル",
    "运营中心": "運用センター",
    "返回首页": "ホームに戻る",
}


def leaf_key(zh: str) -> str:
    return "t" + hashlib.md5(zh.encode()).hexdigest()[:8]


def module_key(rel: str) -> str:
    rel = rel.replace("src/", "").replace(".tsx", "").replace(".ts", "")
    return re.sub(r"[^a-zA-Z0-9]+", "_", rel)


def set_path(tree: dict, parts: list[str], value: str) -> None:
    cur = tree
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def build_zh_from_scan() -> dict[str, str]:
    mapping: dict[str, str] = {}
    data = json.loads(SCAN.read_text(encoding="utf-8"))
    for entry in data.get("files", []):
        rel = entry["file"]
        if not any(
            rel.startswith(p)
            for p in (
                "src/components/admin",
                "src/components/admin-shell",
                "src/page/AdminPanel",
                "src/components/PromotionAdminManager",
                "src/components/WithdrawAdminManager",
                "src/components/CreatorIncentiveAdminManager",
                "src/components/DailyTasksAdminManager",
                "src/components/SubscriptionAdminManager",
                "src/components/ActivityBannerManager",
                "src/components/AdminBannerManager",
                "src/components/CreatorEarnings",
            )
        ):
            continue
        mod = module_key(rel)
        # scan only has samples not all strings — read file for current t keys + match hashes
        fp = ROOT / rel
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8")
        for key in KEY_IN_SRC.findall(text):
            if key in mapping:
                continue
            if key.startswith("adminUi.nav.") or key.startswith("adminUi.shell."):
                continue
            # try to find zh from remaining chinese near key... fallback key path
            mapping[key] = mapping.get(key) or ""

    # Second pass: all Chinese strings in scoped files -> hash keys
    for entry in data.get("files", []):
        rel = entry["file"]
        fp = ROOT / rel
        if not fp.exists():
            continue
        mod = module_key(rel)
        text = fp.read_text(encoding="utf-8")
        re_zh = re.compile(r"['\"`](([^'\"`\n]*[\u4e00-\u9fff][^'\"`\n]*))['\"`]")
        for m in re_zh.finditer(text):
            zh = m.group(1)
            k = f"adminUi.{mod}.{leaf_key(zh)}"
            if k not in mapping or not mapping[k]:
                mapping[k] = zh

    for sec, items in NAV.items():
        for k, zh in items.items():
            mapping[f"adminUi.nav.{sec}.{k}"] = zh
    for k, zh in SHELL.items():
        mapping[f"adminUi.shell.{k}"] = zh

    existing_path = PARTS / "admin.zh.json"
    if existing_path.exists():
        def walk_flat(o, prefix="adminUi"):
            if isinstance(o, dict):
                for k, v in o.items():
                    yield from walk_flat(v, f"{prefix}.{k}")
            else:
                yield prefix, o

        for k, v in walk_flat(json.loads(existing_path.read_text(encoding="utf-8"))["adminUi"]):
            if k in mapping and re.fullmatch(r"t[a-f0-9]{8}", str(mapping[k])) and not re.fullmatch(
                r"t[a-f0-9]{8}", str(v)
            ):
                mapping[k] = v
            elif k not in mapping:
                mapping[k] = v

    for fp in SRC.rglob("*"):
        if fp.suffix not in (".tsx", ".ts"):
            continue
        text = fp.read_text(encoding="utf-8")
        for key in KEY_IN_SRC.findall(text):
            if key not in mapping or not mapping[key] or re.fullmatch(r"t[a-f0-9]{8}", str(mapping[key])):
                mapping[key] = mapping.get(key) or key.split(".")[-1]

    return mapping


def to_tree(flat: dict[str, str]) -> dict:
    tree: dict = {}
    for k, v in flat.items():
        assert k.startswith("adminUi.")
        set_path(tree, k.split(".")[1:], v)
    return {"adminUi": tree}


def zh_to_en(zh: str) -> str:
    if re.fullmatch(r"t[a-f0-9]{8}", zh):
        return zh
    # minimal admin UI English (fallback keeps readable romanization label)
    table = {
        "内容管理": "Content management",
        "公告管理": "Announcements",
        "保存失败": "Save failed",
        "加载失败": "Load failed",
        "搜索": "Search",
        "刷新": "Refresh",
        "关闭": "Close",
        "上一页": "Previous",
        "下一页": "Next",
        "加载中…": "Loading…",
        "海外充值倍率": "Overseas recharge multiplier",
        "默认倍率": "Default multiplier",
        "保存倍率": "Save multiplier",
        "保存中...": "Saving…",
    }
    return table.get(zh, zh)


def zh_to_ja(zh: str) -> str:
    if zh in JA_POLITE:
        return JA_POLITE[zh]
    table = {
        "内容管理": "コンテンツ管理",
        "公告管理": "お知らせ管理",
        "保存失败": "保存に失敗しました",
        "加载失败": "読み込みに失敗しました",
        "搜索": "検索",
        "刷新": "更新",
        "关闭": "閉じる",
        "上一页": "前へ",
        "下一页": "次へ",
        "加载中…": "読み込み中…",
        "退出登录": "ログアウト",
        "管理面板": "管理パネル",
        "运营中心": "運用センター",
        "返回首页": "ホームに戻る",
        "打开用户菜单": "ユーザーメニューを開く",
        "海外充值倍率": "海外チャージ倍率",
        "默认倍率": "デフォルト倍率",
        "保存倍率": "倍率を保存",
        "保存中...": "保存中…",
    }
    if zh in table:
        return table[zh]
    if zh.endswith("失败"):
        return zh.replace("失败", "") + "に失敗しました"
    if zh.endswith("成功"):
        return zh.replace("成功", "") + "が完了しました"
    if zh.endswith("管理"):
        return zh.replace("管理", "管理")
    return f"{zh}（要確認）"


def fix_source_typos() -> int:
    fixed = 0
    for fp in SRC.rglob("*"):
        if fp.suffix not in (".tsx", ".ts"):
            continue
        text = fp.read_text(encoding="utf-8")
        orig = text
        # Invalid object-literal t() in function calls
        text = re.sub(r"\{t\('(adminUi[^']+)'\)\}", r"t('\1')", text)
        if text != orig:
            fp.write_text(text, encoding="utf-8")
            fixed += 1
    return fixed


def main() -> None:
    fix_source_typos()
    flat_zh = build_zh_from_scan()
    # only keys referenced in scope
    used: set[str] = set()
    for fp in SRC.rglob("*"):
        if fp.suffix not in (".tsx", ".ts"):
            continue
        for k in KEY_IN_SRC.findall(fp.read_text(encoding="utf-8")):
            used.add(k)
    flat_zh = {k: v for k, v in flat_zh.items() if k in used}

    flat_en = {k: zh_to_en(v) for k, v in flat_zh.items()}
    flat_ja = {k: zh_to_ja(v) for k, v in flat_zh.items()}

    zh_path = PARTS / "admin.zh.json"
    if zh_path.exists():
        flat_zh = {
            k: v
            for k, v in json.loads(zh_path.read_text(encoding="utf-8")).items()
            if k == "adminUi"
        }
        def walk_flat(o, prefix="adminUi"):
            if isinstance(o, dict):
                for kk, vv in o.items():
                    yield from walk_flat(vv, f"{prefix}.{kk}")
            else:
                yield prefix, o
        flat_zh = {k: v for k, v in walk_flat(flat_zh["adminUi"])}
        flat_zh = {k: flat_zh[k] for k in used if k in flat_zh}
        flat_en = {k: zh_to_en(v) for k, v in flat_zh.items()}
        flat_ja = {k: zh_to_ja(v) for k, v in flat_zh.items()}
    else:
        flat_en = {k: zh_to_en(v) for k, v in flat_zh.items()}
        flat_ja = {k: zh_to_ja(v) for k, v in flat_zh.items()}

    PARTS.mkdir(parents=True, exist_ok=True)
    en = to_tree(flat_en)
    ja = to_tree(flat_ja)
    (PARTS / "admin.en.json").write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PARTS / "admin.ja.json").write_text(json.dumps(ja, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"stringKeys": len(flat_zh), "usedKeys": len(used)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
