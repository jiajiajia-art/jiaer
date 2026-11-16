# -*- coding: utf-8 -*-
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Load zh from lib.zh if exists, else build inline
# This script only writes en/ja from zh template when zh is source of truth.

zh = {
  "galgameLib": {
    "common": {
      "genericError": "发生错误",
      "player": "玩家",
      "you": "你",
      "unknownNpc": "未知角色",
      "protagonist": "主角",
      "traveler": "旅人",
      "chooseAction": "请选择你的行动",
      "formInvalid": "表单无效",
      "emDash": "—",
    },
    "avatar": {
      "gender": {"male": "男", "female": "女", "universal": "通用"},
      "age": {"child": "儿童", "adult": "成人", "elder": "老年"},
      "background": {"ancient": "古代", "modern": "现代", "fantasy": "西幻"},
      "kind": {"private": "私人", "public": "公共", "system": "系统"},
      "cardTitle": "头像 {{n}}",
      "matchPriorityDesc": "手动锁定始终最高；库来源顺序与「通用」兜底按当前剧本配置（缺省=公共库优先并启用通用），系统默认头像始终最终回退",
    },
    "avatarStyle": {"A": "日系视觉小说风格", "B": "乙女向", "C": "暗黑风格", "D": "古风水彩风格"},
    "avatarGen": {
      "sessionUnavailable": "会话不可用",
      "npcSessionUnavailable": "会话或角色不可用",
      "timeout": "头像生成超时（{{seconds}}s），请稍后重试",
      "failed": "头像生成失败",
      "cancelled": "已取消头像生成",
    },
    "writingStyle": {
      "group": {"style": "文风", "viewpoint": "视角", "technique": "描写手法", "plot": "剧情指导"},
      "pace": {"slow": "慢", "medium": "中", "fast": "快"},
      "preset": {
        "vernacular": {"label": "白话风", "hint": "口语自然、少文言堆砌"},
        "female_oriented": {"label": "女频风", "hint": "情感与关系线优先"},
        "literary": {"label": "文学风", "hint": "意象与氛围更重"},
        "wuxia_classic": {"label": "古典武侠风", "hint": "门派江湖语感"},
        "benevolent": {"label": "仁慈视角", "hint": "偏宽容、少极端恶意"},
        "neutral_observer": {"label": "中立旁观", "hint": "少强加对错评判"},
        "intimate_second": {"label": "亲近第二人称", "hint": "拉近与「你」的距离"},
        "character_centric": {"label": "角色中心", "hint": "以人物动机推动描写"},
        "character_molding": {"label": "角色塑造", "hint": "强化性格与细节习惯"},
        "sensory_detail": {"label": "感官细节", "hint": "视听触味等具体描写"},
        "dialogue_heavy": {"label": "对话推进", "hint": "多用对白带剧情"},
        "plot_push": {"label": "剧情推进", "hint": "每轮有明确进展"},
        "slow_burn": {"label": "细水长流", "hint": "允许铺垫与留白"},
        "choice_consequence": {"label": "选择有后果", "hint": "强化因果与代价"},
      },
    },
    "gameStart": {
      "currentRouteSection": "目前选择路线",
      "currentRouteHint": "展示当前开场路线；切换后将按新路线约束后续叙事",
      "changeRouteConfirmTitle": "更换路线",
      "changeRouteConfirmMessage": "确认切换到该开场路线？后续叙事将按新路线约束。",
      "changeRouteConfirmOk": "确认更换",
      "fallbackRouteTitle": "开场路线",
      "storylinePickLabel": "故事线选择",
      "fallbackPlayerName": "旅人",
      "selectStoryline": "请选择故事线",
      "configInvalid": "开局配置无效",
      "nameRequired": "请填写角色姓名",
      "nameTooLong": "姓名不能超过{{max}}字",
      "selectGender": "请选择性别",
      "finishStorylineFirst": "请先完成故事线选择",
      "openingTooLong": "开场白过长",
      "paceInvalid": "文风节奏无效",
      "storylineMissing": "故事线不存在",
      "storylineIndexed": "故事线 {{n}}",
    },
    "worldBook": {
      "titleRequired": "请填写标题",
      "titleTooLong": "标题不能超过40字",
      "contentTooLong": "内容过长",
      "keywordsTooLong": "触发关键词不能超过100字",
      "pasteRequired": "请粘贴世界书内容",
      "importUnrecognized": "未识别到可导入内容",
      "jsonParseFailed": "JSON 解析失败，请检查格式",
      "jsonNoArray": "JSON 中未找到条目数组",
      "noValidEntries": "没有可导入的有效条目",
      "selectWorldBook": "请选择世界书",
      "warehouseNoEntries": "该世界书没有可导入的条目",
      "warehouseNoValidEntries": "该世界书没有可导入的有效条目",
      "entryIndexed": "条目 {{n}}",
      "importEntryIndexed": "导入条目 {{n}}",
      "systemIndexed": "系统 {{n}}",
      "defaultTitle": "世界书",
      "template": {
        "court_basic": {"name": "宫廷常识", "description": "礼仪、称谓与宫规摘要"},
        "jianghu_basic": {"name": "江湖门派", "description": "门派规矩与恩怨基调"},
      },
    },
    "squareAvatar": {
      "minSide": "边长不得低于 {{min}}px（当前 {{w}}×{{h}}）",
      "cannotReadSize": "无法读取图片尺寸",
      "canvasUnavailable": "画布不可用",
      "exportFailed": "导出头像失败",
      "requirements": "推荐 {{target}}×{{target}}px，最低 {{min}}×{{min}}px；PNG/JPG/WebP/GIF；非 1:1 须先裁剪（不可拉伸变形）。",
      "status": {"unqualified": "不合格", "qualified": "合格", "needsCrop": "需裁切"},
      "cannotReadDimensions": "无法读取尺寸",
      "notSquareTooSmall": "非 1:1 且最短边 {{minSide}}px < {{minRequired}}px，裁切后仍不够",
      "notSquareCurrent": "当前 {{w}}×{{h}}，非 1:1",
    },
    "streamError": {
      "networkDisconnected": "网络中断，生成连接已断开，请点击重试。",
      "generating": "内容正在生成中，请稍候。",
      "incomplete": "生成结果不完整，请重试。",
      "dirtyResidue": "生成内容含无法展示的残留标记，请重试。",
      "contentFilter": "生成内容触发了模型安全审核，请点击重试；若反复出现，可换一种行动或弱化敏感描写。",
      "sessionBusy": "当前内容正在生成中，请稍后再试",
    },
    "characterProfile": {
      "nameRequired": "请填写姓名",
      "nameTooLong": "姓名不能超过{{max}}字",
      "genderRequired": "请选择性别（男/女）",
      "relationshipRequired": "请填写关系",
      "relationshipTooLong": "关系不能超过{{max}}字",
      "summaryRequired": "请填写简介",
      "summaryTooLong": "简介不能超过{{max}}字",
      "attitudeRequired": "请填写对你的态度",
      "attitudeTooLong": "态度不能超过{{max}}字",
      "detailedBioTooLong": "详细简介不能超过{{max}}字",
      "importanceInvalid": "重要程度无效",
      "survivalInvalid": "存活状态无效",
      "favorNotNumber": "好感度必须是数字",
    },
    "playerCard": {
      "attrsInvalid": "属性格式无效",
      "attrsTooMany": "属性项不能超过{{max}}个",
      "attrNameEmpty": "属性名不能为空",
      "attrNameTooLong": "属性名不能超过{{max}}字",
      "attrMustBeNumber": "属性「{{key}}」必须是数字",
      "nameRequired": "请填写姓名",
      "nameTooLong": "姓名不能超过{{max}}字",
      "genderInvalid": "请选择有效性别",
      "personaTooLong": "人设不能超过{{max}}字",
      "notFound": "角色卡不存在",
      "forbidden": "无权导入该角色卡",
      "invalid": "角色卡无效",
    },
    "privateChat": {
      "contentRequired": "请输入内容",
      "contentTooLong": "消息不能超过{{max}}字",
      "invalidMessage": "无效消息",
      "messageNotFound": "消息不存在",
      "replyGenerating": "私聊回复生成中，请稍候",
    },
    "ideaFullWork": {
      "missingFileId": "缺少 fileId",
      "failPartial": "{{label}}仅成功 {{completed}}/{{total}} 张",
      "failIncomplete": "{{label}}未完成",
      "failStart": "{{label}}任务启动失败",
      "failPoll": "{{label}}生成未完成（{{status}}）",
      "failGeneric": "{{label}}生成失败",
      "labelPortraits": "角色立绘",
      "labelScenes": "场景背景",
      "coverFailed": "封面生成失败",
    },
    "compressImage": {
      "cannotProcess": "无法处理图片",
      "selectValid": "请选择有效图片",
      "formatUnsupported": "仅支持常见图片格式（JPEG/PNG/WebP/GIF）",
      "webpUnsupported": "浏览器无法导出 WebP，请换一张图或换浏览器重试",
      "stillTooLarge": "图片压缩后仍超过 {{kb}}KB，请换更小的图",
    },
    "poster": {
      "coverLoadFailed": "封面图加载失败",
      "coverExportFailed": "封面导出失败",
      "titleMissing": "缺少海报标题",
      "coverFetchFailed": "封面图拉取失败 ({{status}})",
      "coverSizeInvalid": "封面尺寸无效",
      "canvasUnavailable": "画布不可用",
      "titleProbe": "标题",
    },
    "novel": {"opening": "开篇", "chapterIndexed": "第{{n}}章"},
    "playChoice": {
      "stayAndObserve": "{{player}}留在{{scene}}仔细观察四周",
      "goSeekClue": "{{player}}立刻前往{{scene}}寻找破绽",
      "leaveScene": "{{player}}转身离开{{scene}}另寻出路",
      "talkToNpc": "{{player}}上前与{{npc}}交谈探听消息",
      "followNpc": "{{player}}跟着{{npc}}去往别处查探",
      "watchNpc": "{{player}}旁观{{npc}}的动静再决定去向",
      "steadyThenChoose": "{{player}}先稳住局面再选下一条去路",
      "walkAround": "{{player}}四处走走看看有没有转机",
      "alternateRoute": "{{player}}另寻一条可行去向（{{n}}）",
      "here": "此处",
    },
    "utils": {
      "applicableThemeMin": "请至少选择 1 个适用题材",
      "listing": {
        "unpublished": "未上架",
        "pending_review": "审核中",
        "rejected": "未通过",
        "delisted": "已下架",
        "taken_down": "已下架",
        "deleted": "已下架",
      },
      "creatorLifecycle": {
        "draft": "草稿",
        "private_share": "已私有分享",
        "pending": "发布审核中",
        "rejected": "未通过",
        "update_pending": "更新审核中",
        "unpublished": "已下架",
        "published": "已公开发布",
      },
      "publishAppealDefault": "该作品已被运营下架，请修改后提交重新发布申诉。",
      "adminDiamond": {
        "amountInvalid": "KK币数量必须大于 0 且最多保留两位小数",
        "amountTooLarge": "KK币数量超过可处理范围",
        "balanceOverflow": "变更后的KK币余额不能超过安全整数范围",
        "deductExceeds": "扣减数量不能超过当前余额 {{balance}} KK币",
        "expiryInvalid": "限时KK币有效期必须为 1 至 3650 天",
      },
      "activityBanner": {
        "invalidFormat": "活动时间格式无效",
        "startBeforeEnd": "活动开始时间必须早于结束时间",
      },
      "profileCrypto": {
        "missingKey": "缺少前端密钥配置: VITE_CREATOR_PROFILE_AES_KEY_B64",
        "badFormat": "加密数据格式错误",
        "badIv": "加密数据 IV 无效",
      },
      "miniProgram": {
        "engineCustom": "自定义",
        "engineSt": "自由",
        "engineIvg": "互动影游",
        "currentModeFallback": "当前模式",
        "pcOnly": "小程序端当前仅支持 AI文游 模式创作，{{label}} 请前往 PC 端操作。PC 端地址：{{url}}，请在电脑浏览器打开。",
      },
    },
  }
}

# en mirrors structure — import from pre-built JSON file when present
en_path = os.path.join(HERE, "lib.en.json")
if os.path.isfile(en_path):
    with open(en_path, encoding="utf-8") as f:
        en = json.load(f)
else:
    en = json.loads(json.dumps(zh))  # placeholder

ja = json.loads(json.dumps(en))

def leaf_keys(obj, prefix=""):
    if isinstance(obj, str):
        return [prefix]
    if isinstance(obj, dict):
        out = []
        for k, v in obj.items():
            out.extend(leaf_keys(v, f"{prefix}.{k}" if prefix else k))
        return out
    return []

for name, data in [("lib.zh.json", zh), ("lib.en.json", en), ("lib.ja.json", ja)]:
    with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("wrote", len(leaf_keys(zh)), "keys")
