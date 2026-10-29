/* ═══════════════ 世界内容池加载器 (ContentPool loader) ═══════════════
 * 解析 world.yaml，暴露强类型内容与「通用」门槛求值器。
 * 本模块不含任何领域中文映射或人物专属公式——中文与阈值全部来自 YAML；
 * 这里只做「读数据 + 通用比较」，符合「内容在池、规则在引擎、参数不入引擎」的契约。
 */
import { parse } from "yaml";
import { slot, liveArray, liveRecord, liveById, memoBy } from "../../mods/live";
import type { GameState as SimState } from "../../game/logic";
import { computeLooks } from "../../game/looks";
import raw from "./world.yaml?raw";
import contractsRaw from "./entertainment-contracts.yaml?raw";
import projectsRaw from "./projects.yaml?raw";
import relationsRaw from "./relations.yaml?raw";
import imageRaw from "./image-crisis.yaml?raw";
import helpRaw from "./help.yaml?raw";
import industryRaw from "./industry.yaml?raw";

export type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export type ReqOp = "gte" | "lte";
export type Requirement = { metric: string; op: ReqOp; value: number; hint: string };

export type OfferSpec = { cats: string[]; maxStar?: number; label: string };

/* 人物「只知道自己相关」的可打听情报（结识后一次性解锁；requires 为更深话题的门槛） */
export type PersonIntel = { id: string; topic: string; text: string; requires?: Requirement[] };

/* 亲属引用：一律直接展示（不设结识门槛）；id 命中花名册且已结识时可点击跳转，否则以 name 显示；确无记录则前端显示「暂无记录」 */
export type FamilyRef = { name: string; id?: string; note?: string };
/* 作品履历：区分幕后（导演/制片/监制）与台前（主演）——制作人挂执导/制作作品，艺人挂主演作品。
 * lead/costars 可引用花名册 id 联动跳转（也可为已退圈的传奇，仅留名字与备注）。确定性静态数据。 */
export type Credit = {
  title: string;
  role: string; // 导演 / 制片 / 监制 / 主演 …（内容池中文，引擎不感知）
  genre?: string; // 类型（电影/剧集/唱片/综艺…）
  year?: number;
  synopsis?: string; // 剧情简介
  lead?: FamilyRef; // 第一主演/主角
  costars?: FamilyRef[]; // 其他主演
  note?: string; // 备注（如「豆瓣封神」「主演已退圈」）
};
export type FamilyContent = { parents?: FamilyRef[]; spouse?: FamilyRef | null; children?: FamilyRef[] };
/* 履历事件：确定性静态数据，只读展示，不由 AI 生成；hidden=后台存在但玩家尚未得知 */
export type ResumeEvent = { year: number; month?: number; type: string; title: string; detail?: string; hidden?: boolean };

export type PersonContent = {
  id: string;
  name: string;
  role: string;
  kind: "staff" | "roam";
  home: string;
  roam: string[];
  bio: string;
  init?: number; // 初始好感（模组世界用）
  ttsVoice?: string; // 专属音色（语音模型的 voice 名）；留空按性别用设置里的默认音色
  wxStart?: boolean; // 开局即是微信好友（并视为已结识），如家人、经纪人
  relation?: string; // 与玩家的关系（档案「与你」栏；缺省则显示「尚未得知」）
  gender?: string; // 性别（档案确定性数据，非推断）
  groups?: string[]; // 人脉分组 id（人脉页面配置里的分组；可多选，缺省按分组规则自动归类）
  org?: string; // 所属组织 id（人脉页面配置里的组织库）
  avatarVariant?: string; // 头像池名（须与「我的头像池」或公共分类名完全一致）；开局从该池抽一张做头像
  age?: number; // 年龄（档案确定性数据，非推断）
  birthday?: { m: number; d: number }; // 生日（选填；留空时系统按人物自动分配）
  tags?: string[]; // 人物标签（背景故事下的小标签）
  presentHint?: string;
  offers?: OfferSpec;
  intel?: PersonIntel[];
  requires: Requirement[];
  // —— 人物档案（确定性、单一真相；缺省字段前端显示「尚未得知」）——
  whereabouts?: string; // 常驻地点覆盖；缺省时由 home 推导
  status?: "alive" | "dead"; // 缺省视为在世
  deathNote?: string;
  family?: FamilyContent;
  ex?: FamilyRef | FamilyRef[] | null; // 前任（情感关系栏「前任」）
  resume?: ResumeEvent[];
  timeline?: import("../../lib/types").NpcTimelineEntry[]; // 人物时间线（作者预设；玩家可在固定人物里覆盖）
  works?: string[]; // 作品栏条目（模组可编辑；credits 缺省时的简版回退）
  worksLabel?: string; // 作品栏标题（缺省「代表作」；如经纪人可写「带过的艺人」、家人写「近况」）
  worksPlain?: boolean; // 条目不加书名号《》（非影视作品时勾选，如人名、事件）
  credits?: Credit[]; // 详版代表作（含角色分工/剧情/主演联动）
  stats?: Partial<Record<string, number>>; // 八维能力（缺省字段前端显示「尚未得知」）
};

/* ═══ 条件邂逅事件 ═══
 * 仿「进入地点触发 NPC 特殊事件」的逻辑：须与该人物同处一地（前端只在在场人物的行动条里给出），
 * 且满足下列条件——requires 复用通用门槛（week 生涯周数≈阅历/年岁、fame/reputation/stats.* 等）；
 * minRel 校验你与 TA 的关系状态（双方状态）。once 为一次性。
 * effects 为纯数值增减；seed 为触发后落入对话框、交给 AI 叙事的种子（AI 只在资源库设定内演绎）。 */
export type Encounter = {
  id: string;
  personId: string;
  label: string;
  seed: string;
  once?: boolean;
  requires?: Requirement[];
  minRel?: number;
  effects?: { rel?: number; stress?: number; energy?: number; fame?: number; reputation?: number };
};

export const RAW_ENCOUNTERS: Encounter[] = [
  {
    id: "enc_suqing_latecall",
    personId: "suqing",
    label: "深夜长谈",
    seed: "深夜的白栀咖啡馆只剩你和苏晴，她看出你这阵子撑得辛苦，替你续了杯热的，陪你说了很久的话。请据此描写这段推心置腹的深谈，并落到你被抚慰后的状态。",
    once: true,
    minRel: 40,
    requires: [{ metric: "week", op: "gte", value: 6, hint: "第 6 周后" }],
    effects: { rel: 5, stress: -12 },
  },
  {
    id: "enc_linyi_pep",
    personId: "linyi",
    label: "私下叮嘱",
    seed: "林宜把你叫到一旁，压低声音把这行的规矩和眼下的门道细细交代了一遍。请描写这段经纪人对新人的私下点拨。",
    once: true,
    requires: [{ metric: "week", op: "gte", value: 3, hint: "第 3 周后" }],
    effects: { rel: 3, reputation: 2 },
  },
  {
    id: "enc_shenman_lesson",
    personId: "shenman",
    label: "戏路点拨",
    seed: "沈曼看了你一场戏后没有走，反而留下来逐句拆解你的处理，指出你还差在哪里。请描写这段前辈对后辈的当面指点。",
    once: true,
    requires: [{ metric: "stats.yanji", op: "gte", value: 260, hint: "演技≥260" }],
    effects: { reputation: 4, stress: 3 },
  },
  {
    id: "enc_linzhixia_duet",
    personId: "linzhixia",
    label: "即兴合唱",
    seed: "录音棚里林知夏起了个调子，回头看你，示意你接下去。你们就这样即兴合了一整首。请描写这段默契的即兴合唱。",
    once: true,
    minRel: 20,
    requires: [{ metric: "stats.geyi", op: "gte", value: 200, hint: "歌艺≥200" }],
    effects: { rel: 5, energy: -6, fame: 3 },
  },
  {
    id: "enc_guchen_redcarpet",
    personId: "guchen",
    label: "红毯并肩",
    seed: "红毯尽头闪光灯连成一片，顾辰忽然放慢脚步，等你与他并肩走完全程。请描写这一幕被全场镜头捕捉的同框时刻。",
    once: true,
    minRel: 30,
    requires: [{ metric: "fame", op: "gte", value: 150, hint: "名气≥150" }],
    effects: { rel: 6, fame: 10, stress: 5 },
  },
  {
    id: "enc_songshixu_dinner",
    personId: "songshixu",
    label: "饭局试探",
    seed: "宋时序设了一桌不动声色的饭局，席间几句话都在掂量你的分量与底线。请描写这场暗流涌动的资本试探。",
    once: true,
    minRel: 20,
    requires: [{ metric: "looks", op: "gte", value: 600, hint: "容貌≥600" }],
    effects: { rel: 5, stress: 6 },
  },
];

/* 当前世界的邂逅事件（模组槽 encounters；非娱乐圈世界未声明=无） */
export const ENCOUNTERS: Encounter[] = liveArray(() => slot("encounters", () => RAW_ENCOUNTERS, () => []));
const encByPerson = memoBy(() => slot<Encounter[]>("encounters", () => RAW_ENCOUNTERS, () => []), (list) =>
  list.reduce((acc, e) => {
    (acc[e.personId] ??= []).push(e);
    return acc;
  }, {} as Record<string, Encounter[]>));

export function encountersOf(personId: string): Encounter[] {
  return encByPerson()[personId] ?? [];
}

/* —— 试镜/项目相关支线（纯内容/事件数据）——
 * 仅录入文案、触发条件与续接指引，不在此处接入引擎裁决逻辑。
 * scene：按段落逐条排布的叙述与对白；continuation：给玩家/叙述层的自由续接与硬规则约束。 */
export type SideQuest = {
  id: string;
  code: string;          // 展示编号，如「支线01」
  title: string;
  condition: string;     // 触发条件
  scene: string[];       // 场景叙述 + 对白（逐段）
  continuationKind: "自由续接" | "任务" | "续接";
  continuation: string;  // 续接指引与硬约束
  keywords?: string[];   // 关键词触发：玩家行动/台词里提到即自动展开
  conds?: import("../../lib/types").FixedCond[]; // 条件触发：全部满足即自动展开
};

/* 支线人物表：每段桥段里出场的角色定位。演绎时按定位从你的人脉里选出真实 NPC
 * （名字 / 身份 / 好感 / 记忆一并交给叙事层）；人脉里暂无合适的人，则以陌生配角登场。 */
export type QuestRole = { role: string; match: RegExp | string; stranger: string }; // 模组 JSON 中 match 写正则源字符串
const R_AGENT: QuestRole = { role: "经纪人", match: "经纪", stranger: "临时对接的经纪助理" };
const R_CASTING: QuestRole = { role: "选角负责人", match: "选角|副导|导演", stranger: "片方选角负责人" };
const R_PRODUCER: QuestRole = { role: "制片方", match: "制片|监制|出品|投资", stranger: "片方制片" };
export const RAW_SIDEQUEST_CAST: Record<string, QuestRole[]> = {
  sq01_toolate: [R_CASTING, R_AGENT],
  sq02_sixpm: [R_CASTING, R_AGENT],
  sq03_dontfold: [R_AGENT, R_CASTING],
  sq04_askfeedback: [R_CASTING, R_AGENT],
  sq05_dateset: [R_PRODUCER, R_AGENT],
  sq06_nosign: [R_PRODUCER, R_AGENT],
  sq07_wrapcall: [R_PRODUCER, R_AGENT],
  sq08_reshoot: [R_PRODUCER, R_CASTING],
  sq09_settle: [R_PRODUCER, R_AGENT],
};

export const RAW_SIDEQUESTS: SideQuest[] = [
  {
    id: "sq01_toolate",
    keywords: ["加时间", "来不及", "延长试镜"],
    code: "支线01",
    title: "今天真的来不及",
    condition: "请求追加时间遭拒，试镜窗口实际结束；仍可留资料。",
    scene: [
      "“后面还有人，今天不加了。”",
      "负责人把本子合上。",
      "她站了半秒，把原本准备好的后半句话咽回去。对方已经起身，再追着演，也不会有人替她开机。",
      "“资料能留吗？”",
      "“放左边。之后有合适的再联系。”",
      "她把照片抽出来，确认背面的号码没写错。纸角被掌心的汗压弯了一点，她抹平，才放下。",
      "出了门，经纪人问她结束没有。",
      "她先打了“没让演完”，停了停，又补上一句。",
      "“我现在回去。下午还有能报的吗？”",
    ],
    continuationKind: "自由续接",
    continuation:
      "可留资料、请求可公开反馈、查其他机会、回去训练或休息。留资料仅进入候选库，不保证回电。若玩家没提出留资料，删掉相应对白；不能代替玩家决定。",
  },
  {
    id: "sq02_sixpm",
    keywords: ["补交", "录像", "补录"],
    code: "支线02",
    title: "给她留到六点",
    condition:
      "项目确实允许补交试镜录像，负责人接受该方案；截止时间与交付方式已登记。以下以今日 18 点、交实体录像带为本模板条件，来不及则不得触发。",
    scene: [
      "“现场不补了。你能录一段的话，六点前送来。”",
      "她抬头：“只要刚才这场？”",
      "“对。不是让你再拍一部戏。画面看得清，声音听得见。”",
      "她看了眼时间。",
      "机会是有了，摄像机还没有。",
      "她翻开通讯录，又停住。认识的人里谁能借设备，谁只是交换过一个号码，她得分清楚。",
    ],
    continuationKind: "任务",
    continuation:
      "在截止前完成合法设备预约、录制、交付。设备必须来自现有可借/可租资源，全部费用和行动槽先预览；本模板只有当天剩余槽足够时才注册。交付成功回正常评审，不保送；部分完成可询问是否延期，只有对方正式同意才改截止；过期记未交付，回其他项目池。对方可以只答应收资料，不保证看片或提供反馈。",
  },
  {
    id: "sq03_dontfold",
    keywords: ["等结果", "还没回复", "等通知"],
    code: "支线03",
    title: "先别替自己落选",
    condition: "评审仍待定，已过预计答复时间但正式截止未到。",
    scene: [
      "她今天第三次打开那条短信。",
      "还是“有结果通知”。",
      "经纪人接起电话，听她说完，问：“他们说不要了？”",
      "“没有。”",
      "“那就是还没定。我去问进度，你先别把其他事全停了。”",
      "她把空出来的日程往下翻。为了等这通电话，她连一节本来能上的课都没约。",
      "“问到告诉我。”",
      "“会的。手机开着。”",
    ],
    continuationKind: "续接",
    continuation:
      "可查进度、安排不冲突行动、请求明确期限、退出候选；到截止仍无录用通知则结为「本次未获确认」，不编造内定原因，也不能永久吊住玩家。不得代玩家自动放弃其他已确认工作。",
  },
  {
    id: "sq04_askfeedback",
    keywords: ["落选", "没选上", "反馈"],
    code: "支线04",
    title: "没选上，还问不问",
    condition: "正式落选，尚未获得评审反馈。",
    scene: [
      "“这次没定你。”",
      "她把听筒往耳边压了压。",
      "“是哪里不合适？”",
      "“我手上只有结果。你要问，我可以转达，但不一定回复。”",
      "她看着台词背面那条折痕。昨天回来时，她还怕弄丢，把它夹进了最常用的本子里。",
      "“那麻烦问一下。”",
      "对方应了声。她没再问选上的是谁。",
      "挂断电话，她把本子翻到新的一页。下一次试镜的地址还没抄。",
    ],
    continuationKind: "续接",
    continuation:
      "问反馈形成有期限的小任务，只有实际答复才能生成原因；可不问而另投，也可准备下一次开放试镜。不能让导演因她落选后的懂事立刻追回给女主角。与陆曜的来往依据真实联系记录单独发展，不因失去本角色切断全部关系。",
  },
  {
    id: "sq05_dateset",
    keywords: ["机动日", "待命", "档期"],
    code: "支线05",
    title: "钱没加，日期定了",
    condition: "女主提出改善机动日条件；对方无法加预算，但有权缩小待命范围，并已给出确定书面方案。",
    scene: [
      "“钱加不了。机动日可以限定到周四，不往后顺延。”",
      "她把两份说明摆在一起。原来那句“另行通知”划掉了，旁边补了日期。",
      "经纪人问：“这个能不能接受？”",
      "她没有马上拿笔。",
      "少等几天，确实能排别的事。但钱还是原来的钱。",
      "“我把账再算一遍。”",
    ],
    continuationKind: "续接",
    continuation:
      "玩家可接受、继续谈其他可行条件、拒绝或在截止前考虑。接受仅表示接受新条件，最终签署才生成工作义务；继续谈不保证再次让步。同一事实下反复要求涨价，不重新抽签。",
  },
  {
    id: "sq06_nosign",
    keywords: ["不签", "没签", "报价"],
    code: "支线06",
    title: "没签，也是真的没了",
    condition: "合同未签成且报价关闭；女主不承担未签合同的违约。",
    scene: [
      "“那这次先不合作了。”",
      "电话挂了。",
      "她看着桌上的签字笔。刚才还能谈的时候，她觉得那一天怎么都不能白等。现在机会真的没了，又忍不住想，是不是再退一点就成了。",
      "经纪人把工作说明收起来：“其他的还看吗？”",
      "“看。”",
      "她把笔放回去。",
      "“先看日期。”",
    ],
    continuationKind: "续接",
    continuation:
      "查现有通告、训练、做兼职或调整职业目标。记清「因条件未达成拒签」，不记成「耍大牌」；公开争议必须另有真实传播来源。将来同负责人有新项目可以再次申请，不自动永久封杀，也不保证重新邀请。",
  },
  {
    id: "sq07_wrapcall",
    keywords: ["杀青", "拍完了", "收工"],
    code: "支线07",
    title: "杀青以后，还有一通电话",
    condition: "实际完成本次拍摄；合同与流程确有资料核对环节，作品尚未发行。",
    scene: [
      "她刚把拍摄用的鞋脱下来，手机又响了。",
      "“是我。你留的名字，字幕就照这个写？”",
      "她报了一遍。",
      "对方复述到最后一个字，读错了音。她赶紧纠正，又解释是哪一个字。",
      "“好，我备注。”",
      "电话短得没来得及说别的。",
      "她把鞋放进袋子，拿起手机，重新看了眼那通来电。",
      "名字能写进去。",
      "片子还没播，她先把这个号码存了。",
    ],
    continuationKind: "续接",
    continuation:
      "核对署名、尾款、发行进度；真实发行后才生成观众反馈和作品收益。也可联系已经认识的搭档、继续申请新工作。不得因拍完一场戏自动增加公共名气或把配角写成主角。",
  },
  {
    id: "sq08_reshoot",
    keywords: ["补拍", "重拍"],
    code: "支线08",
    title: "能补，但不是现在",
    condition: "工作未完成，项目仍有合同内的合法补拍余量；不是单纯 AI 生成失败。",
    scene: [
      "“今天先到这儿。剩下的镜头另排。”",
      "她没动：“是刚才那条要重来吗？”",
      "负责人把要补的地方指给她。她顺着看完，才把本子接回来。",
      "“通知什么时候到？”",
      "“等排期。确定了发你。”",
      "她走到门外，先找经纪人确认合同里的机动日期。今天没拍完已经是事实，不能连后面什么时候来都含糊着。",
    ],
    continuationKind: "续接",
    continuation:
      "登记实际未完镜头、负责人和通知截止；确认合法补拍档期后安排准备或休息。超出合同范围必须协商，不无期限占用日程；补拍成功→支线07，仍失败→按既有项目规则结案→支线09。",
  },
  {
    id: "sq09_settle",
    keywords: ["合作结束", "解约", "散伙"],
    code: "支线09",
    title: "这场没过，她还得把账问完",
    condition: "项目正式确认本次合作失败或结束；具体责任尚需按实际合同核对。",
    scene: [
      "“后面不用来了。”",
      "她握着手机，先问：“已经拍的部分呢？”",
      "“结算找制片核。具体能留多少镜头，现在说不了。”",
      "她应了一声，把联系人记下来。写到一半，笔没水了。",
      "她在纸角划了两下，换了一支。",
      "电话里的人问还有没有别的事。",
      "“没有了，谢谢。”",
      "挂断以后，她坐了一会儿，才把那张纸拍平。工作没做成，拍了几天、该结多少、还要退什么，总得说清楚。",
    ],
    continuationKind: "续接",
    continuation:
      "核实结算与责任、处理真实违约、针对实际反馈训练、接现有低门槛项目；存在有效争议证据才可申诉。失败不默认欠款、不抹去已履约部分、不自动获得「受害者翻盘」标签。下一次同类工作可引用这次具体问题，不能凭空记恨全行业。",
  },
];

export const SIDEQUEST_CAST: Record<string, QuestRole[]> = liveRecord(() => slot("sideQuestCast", () => RAW_SIDEQUEST_CAST, () => ({})));
export const SIDEQUESTS: SideQuest[] = liveArray(() => slot("sideQuests", () => RAW_SIDEQUESTS, () => []));
export const SIDEQUEST_BY_ID: Record<string, SideQuest> = liveById(() => slot("sideQuests", () => RAW_SIDEQUESTS, () => []));

export type RoomItem = { id: string; name: string; icon: string; desc: string; linksProjects?: boolean; price?: number; use?: { msg?: string } };
/* 居家/在场活动：可点选的日常小事，增益全为纯数值增减（引擎不认识具体活动语义） */
export type RoomActivity = {
  id: string;
  name: string;
  icon?: string;
  desc: string;
  msg: string;
  energy?: number;
  stress?: number;
  fame?: number;
  money?: number; // 现金增减（负=花钱，正=挣钱）；不足时该活动无法进行
  stat?: string;
  statDelta?: number;
  requiresItem?: string;
  lockedMsg?: string;
};
/* 通行条件：requires 由通用求值器判定，note 为未达标时的解释文案 */
export type RoomAccess = { requires?: Requirement[]; note: string };
export type RoomContent = {
  name?: string; // 显示名（模组世界用；娱乐圈取 game/data LOCATIONS）
  exits: Partial<Record<Dir, string>>;
  desc: string;
  intro?: string;
  items?: RoomItem[];
  activities?: RoomActivity[]; // 在此地可点选的日常活动（缺省=无）
  hours?: string; // 营业/开放时段（展示用）
  openDays?: number[]; // 开放的星期（1=周一 … 7=周日）；缺省=每日开放
  tint?: string; // 地点背景图色调键（jade|coral|gold|ink|plum）
  access?: RoomAccess; // 通行门槛（缺省=无门槛）
  // —— 多级嵌套子地点（地点树）——
  parent?: string; // 父地点 id（空 = 顶层地点）；层级不限
  order?: number; // 在父地点「子地点入口」里的排序
  bg?: string; // 此地背景图（优先于舆图照片）
  bgm?: string; // 进入此地自动切换的背景音乐（模组曲目 id，或 platform: 平台曲目 id）
  upLabel?: string; // 返回上层的文案，如「走出禅房，回到后院」
  hidden?: boolean; // 隐藏：不在上层入口里出现（到访过 / 已解锁后才显示）
  locked?: boolean; // 上锁：需写入规则变量 unlock:<地点id> ≥ 1 才能进入（解锁父地点不会连带解锁它）
  lockNote?: string; // 上锁时的提示文案
  noNpcVisit?: boolean; // 不允许 NPC 自主走进来
  inheritEvents?: boolean; // 沿用父地点的在场活动（缺省=各层独立）
};
/* 交通方式：fareMul 乘基础车费（hops×feePerHop），timeMul 乘基础耗时；ownCar=需自有座驾 */
export type TransportMode = { id: string; label: string; fareMul: number; timeMul: number; note: string; fee?: number /* 作者配置：公共交通每趟票价（优先于 fareMul；自有座驾不收） */; ownCar?: boolean; icon?: string };
export type TravelContent = {
  minutesPerHop: number; feePerHop: number; energyPerHop: number; apPerTurn?: number; apPerMove?: number; dayStartMinute?: number; dayEndMinute?: number;
  advanceDays?: number; // 每次「推进」前进的天数（缺省 1；推进单位为「日」时生效）
  advanceUnit?: "day" | "week" | "month" | "year"; // 推进单位（缺省 日）
  advanceCount?: number; // 周/月/年模式下每次推进几个单位（1~12，缺省 1）
  advanceStory?: boolean; // 推进后是否由 AI 生成日程叙事（缺省开启）
  advanceWords?: number; // 推进叙事字数（缺省 500）
  modes?: TransportMode[]; // 本世界的出行方式（缺省=不启用交通系统，只显示「前往」）
  defaultMode?: string; // 默认选中的方式 id
  carShop?: string; // 买车的地点 id（出行面板提示「去哪买车」；缺省=无提示）
  pickTitle?: string; // 出行面板选择区标题（缺省「怎么去」）
  currency?: string; // 车费货币符号（缺省「¥」）
  freeLabel?: string; // 不收费时的文案（缺省「免费」）
};

export type CalendarContent = {
  eraName: string;
  startYear: number;
  startDate: string;
  careerWeeks: number;
  weekdayNames: string[];
  monthLabel: string;
  dayLabel: string;
};

export type WorldContent = {
  calendar: CalendarContent;
  directions: Record<Dir, string>;
  travel: TravelContent;
  metricLabels: Record<string, string>;
  roomStatus: Record<string, string>; // 营业状态文案（open/closed/busy/event…）
  rooms: Record<string, RoomContent>;
  people: PersonContent[];
};

export const WORLD = parse(raw) as WorldContent;

/* 日历 / 出行参数：模组未声明时沿用引擎默认（即娱乐圈原值） */
const calendarNow = memoBy(() => slot<CalendarContent>("calendar", () => WORLD.calendar), (c) => c);
export const CALENDAR: CalendarContent = liveRecord(() => {
  const c = calendarNow();
  const sd = slot<string | undefined>("startDate", () => undefined); // 简写：「2005.01.03」或「2005-01-03」
  return sd ? { ...c, startDate: sd.replace(/[./]/g, "-") } : c;
});
export const DIR_LABEL = WORLD.directions;
export const ROOMS = WORLD.rooms;
export const TRAVEL: TravelContent = liveRecord(() => slot("travel", () => WORLD.travel));
export const ROOM_STATUS_LABELS = WORLD.roomStatus;
export const itemsOfRoom = (roomId: string): RoomItem[] => WORLD.rooms[roomId]?.items ?? [];
/* 全局物品索引（跨房间），供背包/行囊按 id 还原物品信息 */
export const ALL_ITEMS: RoomItem[] = Object.values(WORLD.rooms).flatMap((r) => r.items ?? []);
export const itemById = (id: string): RoomItem | undefined => ALL_ITEMS.find((i) => i.id === id);
export const activitiesOfRoom = (roomId: string): RoomActivity[] => WORLD.rooms[roomId]?.activities ?? [];
/* 首次踏入某房间的一次性剧情叙述（内容池提供，引擎不写死） */
export const introOf = (roomId: string): string | undefined => WORLD.rooms[roomId]?.intro;
export const intelOfPerson = (personId: string): PersonIntel[] => PERSON_BY_ID[personId]?.intel ?? [];
/* 人物档案访问器（纯读取内容池；引擎与 UI 都不写死人物真相） */
export const profileOf = (personId: string): PersonContent | undefined => PERSON_BY_ID[personId];
export const resumeOf = (personId: string): ResumeEvent[] => PERSON_BY_ID[personId]?.resume ?? [];
export const creditsOf = (personId: string): Credit[] => PERSON_BY_ID[personId]?.credits ?? [];
export const isDeadPerson = (personId: string): boolean => PERSON_BY_ID[personId]?.status === "dead";
export const PEOPLE = WORLD.people;
export const PERSON_BY_ID: Record<string, PersonContent> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

/* ═══════════════ 通告/合同内容池 (entertainment-contracts) ═══════════════ */
export type NatureContent = { id: string; label: string; hint: string };
export type ContractMeta = { nature: string; tradeoff: string };
export type NegOutcome = { label: string; payMul: number; fameMul: number; note: string };
export type NegotiationContent = {
  standbyBonus: number;
  formalMargin: number;
  waitMargin: number;
  standbyTrust: number;
  snatchChance: number;
  outcomes: Record<string, NegOutcome>;
};
/* 开局候选经纪合约（三份；建角最后一步签署，参数落到开局数值） */
export type SigningContract = {
  id: string;
  factionId?: string; // 绑定的开局阵营：签下即加入该阵营
  company: string;
  companyStyle: string;
  focusLabel: string;
  tone: string;
  icon: string;
  baseSalary: number;
  revenueShare: number;
  penalty: number;
  exclusive: string;
  signBonus: number;
  trust: number;
  reputation: number;
  blurb: string;
  /* 由世界观经纪公司生成时附带：公司声望与掌舵人 */
  prestige?: number;
  boss?: CompanyBoss;
};
/* 开局合约方向规则：公司简介命中 match（正则）即判为该方向；世界观可在 contracts.focusRules 自定义 */
export type FocusRule = { match: string; label: string; tone?: string; exclusive?: string };
export type ContractsContent = {
  focusRules?: FocusRule[];
  natures: NatureContent[];
  meta: Record<string, ContractMeta>;
  negotiation: NegotiationContent;
  signing: SigningContract[];
};

export const RAW_CONTRACTS = parse(contractsRaw) as ContractsContent;
/* 模组槽 contracts：未声明=无开局经纪合约 / 无通告性质说明（议价参数沿用引擎默认） */
const contractsNow = () => slot<ContractsContent>("contracts", () => RAW_CONTRACTS, () => ({ natures: [], meta: {}, negotiation: RAW_CONTRACTS.negotiation, signing: [] }));
export const CONTRACTS: ContractsContent = liveRecord(contractsNow);
export const SIGNING_CONTRACTS: SigningContract[] = liveArray(() => contractsNow().signing ?? []);
export const NATURE_BY_ID: Record<string, NatureContent> = liveById(() => contractsNow().natures ?? []);
export const NEGOTIATION: NegotiationContent = liveRecord(() => contractsNow().negotiation ?? RAW_CONTRACTS.negotiation);

/* —— 人设与危机内容池 —— */
export type PersonaContent = { id: string; label: string; icon: string; audience: string; desc: string };
export type PublicActContent = { id: string; label: string; icon: string; energy: number; fameGain: number; fits: string[]; desc: string };
export type ActOutcomeSpec = { brandMatch: number; audience: number; controversy: number; blackFans?: number; streakBonusEvery?: number; streakBonusMatch?: number };
export type CrisisVoices = { pro: string[]; con: string[] };
export type CrisisContent = { id: string; label: string; icon: string; severity: number; desc: string; baseEvidence?: "clear" | "mixed" | "none"; voices: CrisisVoices };
export type CrisisDiff = { rep: number; fame: number; controversy: number; blackFans: number; trust: number; brandMatch: number; audience: number };
export type ResponseContent = {
  id: string; label: string; icon: string; desc: string;
  base: number; evidenceSens: number; timingSens: number; integritySens: number;
  trustSens?: number; costMoney?: number;
  tiers: { good: CrisisDiff; mixed: CrisisDiff; bad: CrisisDiff };
};
export type ImageCrisisContent = {
  unlock: { fame: number; note: string };
  fanTiers: { perFame: number; coreFromMatch: number; antiPerBlack: number; labels: { core: string; casual: string; anti: string } };
  personas: PersonaContent[];
  publicActs: PublicActContent[];
  actOutcome: { consistent: ActOutcomeSpec; neutral: ActOutcomeSpec; reversal: ActOutcomeSpec; crisisAtControversy: number };
  crises: CrisisContent[];
  responses: ResponseContent[];
  resolve: {
    weights: { evidence: number; timing: number; integrity: number; severity: number; controversy: number; trust: number };
    timingFastDays: number; goodAt: number; badBelow: number;
  };
};
export const RAW_IMAGE_CRISIS = parse(imageRaw) as ImageCrisisContent;
/* 模组槽 imageCrisis：未声明=无人设 / 公开行动 / 危机（参数沿用引擎默认，界面隐藏） */
const imageNow = () => slot<ImageCrisisContent>("imageCrisis", () => RAW_IMAGE_CRISIS, () => ({ ...RAW_IMAGE_CRISIS, personas: [], publicActs: [], crises: [], responses: [] }));
export const IMAGE_CRISIS: ImageCrisisContent = liveRecord(imageNow);
export const PERSONAS: PersonaContent[] = liveArray(() => imageNow().personas);
export const PUBLIC_ACTS: PublicActContent[] = liveArray(() => imageNow().publicActs);
export const CRISES: CrisisContent[] = liveArray(() => imageNow().crises);
export const CRISIS_RESPONSES: ResponseContent[] = liveArray(() => imageNow().responses);
export const PERSONA_BY_ID: Record<string, PersonaContent> = liveById(() => imageNow().personas);
export const CRISIS_BY_ID: Record<string, CrisisContent> = liveById(() => imageNow().crises);

/* —— 游戏资料库（help 文档，供知识库检索）—— */
export type HelpDoc = { id: string; title: string; keywords: string[]; body: string };
export type HelpContent = { intro: string; era?: string; docs: HelpDoc[] };
export const RAW_HELP = parse(helpRaw) as HelpContent;
/* 模组槽 help：未声明=资料库为空 */
export const helpNow = () => slot<HelpContent>("help", () => RAW_HELP, () => ({ intro: "", era: "", docs: [] }));
export const HELP_DOCS: HelpDoc[] = liveArray(() => helpNow().docs ?? []);
export const helpIntro = (): string => helpNow().intro ?? "";

/* —— 娱乐圈生态（公司名号 / 剧目 / 代言品牌）—— 引擎按序号取用，中文只在此 —— */
export type CompanyBoss = { name: string; title: string; age: number; style: string; quote: string; bio: string };
export type CompanyContent = { name: string; prestige: number; blurb: string; boss?: CompanyBoss; focus?: string; exclusive?: string; tone?: string };
export type AwardSpec = { ceremony: string; category: string; gender: string; metric: string };
/* 圈内生成参数（全部可选，缺省=引擎默认） */
export type IndustryGen = { npcCount?: number; minPerCompany?: number; fameMin?: number; fameMax?: number; statMin?: number; statMax?: number; debutBaseYear?: number; debutSpan?: number; coupleRate?: number };
export type IndustryContent = { companies: CompanyContent[]; movies: string[]; ads: string[]; awards: AwardSpec[]; starEvents?: Record<string, string[]>; gen?: IndustryGen };
export const RAW_INDUSTRY = parse(industryRaw) as IndustryContent;
/* 模组槽 industry：未声明=无公司 / 奖项 / 圈内动态（片名与品牌给中性占位，取模不崩） */
const industryNow = () => slot<IndustryContent>("industry", () => RAW_INDUSTRY, () => ({ companies: [], movies: ["作品"], ads: ["品牌"], awards: [], starEvents: {} }));
const nonEmpty = (a: string[] | undefined, fb: string) => (a && a.length ? a : [fb]);
export const COMPANIES: CompanyContent[] = liveArray(() => industryNow().companies ?? []);
export const MOVIE_TITLES: string[] = liveArray(() => nonEmpty(industryNow().movies, "作品"));
export const AD_BRANDS: string[] = liveArray(() => nonEmpty(industryNow().ads, "品牌"));
export const AWARDS: AwardSpec[] = liveArray(() => industryNow().awards ?? []);
export const industryGen = (): IndustryGen => industryNow().gen ?? {};
export const STAR_EVENTS: Record<string, string[]> = liveRecord(() => industryNow().starEvents ?? {});
/* 引擎公司 id（co_N）→ 展示名/简介；越界时回退，绝不崩 */
export function companyMeta(companyId?: string): CompanyContent {
  const i = Number(String(companyId ?? "").replace(/^co_/, ""));
  return COMPANIES[i] ?? { name: "自由艺人", prestige: 40, blurb: "" };
}

/* 年度奖项得主：按 gender + metric 从艺人中确定性挑选，落实到具体 NPC。
 * metric → 排序口径；平局用 fame 兜底。引擎不感知奖项中文，这里只读 sim.npcs 数值。 */
const AWARD_METRIC: Record<string, string> = { acting: "yanji", singing: "geyi", fame: "fame" };
export type AwardResult = { ceremony: string; category: string; winnerId: string; winnerName: string; work: string | null };
export function industryAwards(sim: SimState): AwardResult[] {
  const used = new Set<string>();
  const results: AwardResult[] = [];
  for (const a of AWARDS) {
    const metric = AWARD_METRIC[a.metric] ?? "fame";
    const score = (n: SimState["npcs"][number]) =>
      metric === "fame" ? n.fame : (n.stats as Record<string, number>)[metric] ?? n.fame;
    const pool = sim.npcs
      .filter((n) => n.gender === a.gender && !used.has(n.id))
      .sort((x, y) => score(y) - score(x) || y.fame - x.fame);
    const w = pool[0];
    if (!w) continue;
    used.add(w.id);
    // 获奖作品：确定性地取该艺人代表作之一（表演/歌唱类奖项才挂作品，人气类留空）
    const works = (w.works ?? []).map((idx) => MOVIE_TITLES[idx % MOVIE_TITLES.length]);
    const work = a.metric !== "fame" && works.length ? works[w.fame % works.length] : null;
    results.push({ ceremony: a.ceremony, category: a.category, winnerId: w.id, winnerName: w.name, work });
  }
  return results;
}

/* 圈内动态渲染：把引擎存的抽象事件（kind + 参与者 id + 抽签）落成当年语感的中文八卦。
 * 引擎不感知这些文案；这里只按 kind 取模板、pick 稳定选一条、填入艺人名。 */
export type StarBuzzView = { week: number; text: string };
export function renderStarBuzz(sim: SimState): StarBuzzView[] {
  const nameOf = (id: string | null) => (id ? sim.npcs.find((n) => n.id === id)?.name ?? "" : "");
  const buzz = (sim as SimState & { starBuzz?: { week: number; kind: string; aId: string; bId: string | null; pick: number }[] }).starBuzz ?? [];
  const out: StarBuzzView[] = [];
  for (const b of buzz) {
    const pool = STAR_EVENTS[b.kind];
    if (!pool || !pool.length) continue;
    const a = nameOf(b.aId);
    if (!a) continue;
    const other = nameOf(b.bId);
    // 需要 {b} 的模板缺少对方时跳过，避免出现空名
    const tpl = pool[b.pick % pool.length];
    if (tpl.includes("{b}") && !other) continue;
    out.push({ week: b.week, text: tpl.replace(/\{a\}/g, a).replace(/\{b\}/g, other) });
  }
  return out.reverse(); // 最近的排在最前
}

/* 某张通告的性质与取舍（内容池未登记时返回空，引擎不写死中文） */
export function contractInfo(gigId: string): { natureLabel: string; tradeoff: string } | null {
  const m = CONTRACTS.meta[gigId];
  if (!m) return null;
  return { natureLabel: NATURE_BY_ID[m.nature]?.label ?? m.nature, tradeoff: m.tradeoff };
}

/* 由引擎状态派生的可比较指标（门槛只引用这些键，引擎不认识具体人物） */
function worldMetrics(s: SimState): Record<string, number> {
  const m: Record<string, number> = {
    week: s.week,
    fame: s.fame,
    reputation: s.reputation,
    blackFans: s.blackFans,
    works: s.works,
    looks: computeLooks(s),
    energy: s.energy,
    stress: s.stress,
  };
  for (const k of Object.keys(s.stats)) m["stats." + k] = s.stats[k as keyof typeof s.stats];
  // 自定义属性与八维平级：门槛可写 metric = "c:<属性id>"（通告 / 邂逅 / 地点 / 情报通用）
  for (const [k, v] of Object.entries(s.cattrs ?? {})) m["c:" + k] = v;
  // 规则变量与所在位置：flag:<变量>；at:<地点id> = 正好在这里；in:<地点id> = 在这一枝（含子地点）里
  for (const [k, v] of Object.entries(s.flags ?? {})) m["flag:" + k] = v;
  for (const id of roomPathProvider(s.room)) m["in:" + id] = 1;
  if (s.room) m["at:" + s.room] = 1;
  return m;
}

/* 地点路径由地图层注入（本文件不直接依赖注册表，避免循环引用） */
// 循环引用下 mud.ts 可能在本文件求值完之前就调用 setRoomPathProvider：用函数声明（随提升即初始化）承载注入值，避免 let 的暂时性死区
function roomPathProvider(id?: string): string[] { return roomPathProvider.f ? roomPathProvider.f(id) : id ? [id] : []; }
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace roomPathProvider { let f: ((id?: string) => string[]) | undefined; }
export function setRoomPathProvider(f: (id?: string) => string[]) { roomPathProvider.f = f; }

/* 通用门槛求值：全部满足则 ok；hint 拼接每条要求（gte 未达标附上差值） */
export function evalRequires(reqs: Requirement[], s: SimState): { ok: boolean; hint: string } {
  const M = worldMetrics(s);
  let ok = true;
  const parts: string[] = [];
  for (const r of reqs) {
    const have = M[r.metric] ?? 0;
    const pass = r.op === "lte" ? have <= r.value : have >= r.value;
    if (!pass) ok = false;
    const gap = !pass && r.op === "gte" ? `（差 ${Math.max(0, Math.ceil(r.value - have))}）` : "";
    parts.push(r.hint + gap);
  }
  return { ok, hint: parts.join("·") };
}

/* ═══════════════ 项目/通告全生命周期内容池 (projects) ═══════════════ */
export type RoleSlotContent = {
  roleType: string;
  rewardMultiplier: number;
  downgradeType: string;
  downgradeMultiplier: number;
  requirements: Requirement[];
};
export type CompetitorContent = { name: string; main: number; sub: number; fit: number; prep: number; trust: number; rep: number };
export type ProjectTemplate = {
  id: string;
  category: string;
  title: string;
  synopsis: string;
  source: string;
  starLevel: number;
  baseQuality: number;
  managerNpcId: string;
  openWeek: number;
  deadlineWeek: number;
  workDayCount: number;
  releaseDelayDays: number;
  feeYuan: number;
  advanceRate: number;
  breachRate: number;
  exclusivityTags: string[];
  mainStat: string;
  subStat: string;
  fit: number;
  followUps: string[];
  roleSlot: RoleSlotContent;
  competitor: CompetitorContent;
};
export type QualityTier = { id: string; min: number; label: string; payMul: number; growthMul: number; trust: number; rep: number };
export type WorkStrategy = { id: string; label: string; energy: number; stress: number; floor: number; ceil: number; desc: string };
export type ProjectsContent = {
  statusLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  roleTypeLabels: Record<string, string>;
  audition: Record<string, number>;
  crash: { baseChance: number; minChance: number; stressGate: number; energyGate: number; perfPenalty: number; tinengThreshold: number; tinengRelief: number; friendReliefMin: number; friendRelief: number; datingRelief: number };
  quality: { wBase: number; wPerf: number; wFulfil: number; wTrust: number; wPrep: number; wFit: number; crashPenalty: number; tiers: QualityTier[] };
  workStrategies: WorkStrategy[];
  starThresholds: Record<string, { fame: number; ability: number }>;
  releaseDelays: Record<string, number>;
  releaseFame: Record<string, number>;
  releaseQBonus: number;
  releaseRepBase: number;
  growthMain: Record<string, number>;
  growthSub: Record<string, number>;
  publicity: { maxUses: number; costYuan: number; stress: number; indexPer: number; labels: Record<string, string> };
  buzz: { wQ: number; wFame: number; wPublicity: number; smallMin: number; smallBonus: number; bigMin: number; bigBonus: number; labels: Record<string, string> };
  onSet: OnSetContent;
  producer: ProducerContent;
  negotiate: NegotiateContent;
  projects: ProjectTemplate[];
};

export type NegotiateContent = {
  friendMin: number; baseChance: number; perFriend: number; perTrust: number; maxChance: number;
  raiseRate: number; partialRate: number; partialBand: number;
  labels: Record<string, string>;
};

export type OnSetOutcome = { perf: number; stress: number; rep: number; note: string };
export type OnSetEvent = { id: string; label: string; stat: string; threshold: number; pass: OnSetOutcome; fail: OnSetOutcome };
export type OnSetContent = { triggerChance: number; byCategory: Record<string, OnSetEvent[]> };

export type ProducerQuestion = { id: string; label: string; reveals: string[]; requires?: string[] };
export type ProducerContent = {
  meetEnergyCost: number;
  labels: Record<string, string>;
  masks: Record<string, string>;
  questions: ProducerQuestion[];
};

export const RAW_PROJECTS = parse(projectsRaw) as ProjectsContent;
/* 模组槽 projects：未声明=无项目模板 / 制片人（规则参数沿用引擎默认） */
const projectsNow = () => slot<ProjectsContent>("projects", () => RAW_PROJECTS, () => ({ ...RAW_PROJECTS, projects: [] }));
export const PROJECTS_POOL: ProjectsContent = liveRecord(projectsNow);
export const PROJECT_TEMPLATES: ProjectTemplate[] = liveArray(() => projectsNow().projects ?? []);
export const PROJECT_TPL_BY_ID: Record<string, ProjectTemplate> = liveById(() => projectsNow().projects ?? []);
export const PRODUCER: ProducerContent = liveRecord(() => projectsNow().producer ?? RAW_PROJECTS.producer);
export const NEGOTIATE: NegotiateContent = liveRecord(() => projectsNow().negotiate ?? RAW_PROJECTS.negotiate);

/* ═══════════════ 娱乐圈关系内容池 (relations) ═══════════════ */
export type RelDimension = { id: string; label: string; hint: string };
export type PartnerPerk = {
  pid: string; label?: string;
  /* 工作玩法规则（引擎内置，只对有工作委托系统的世界观生效；其他世界观留空，改用下面通用的 fx） */
  rate?: number; minStar?: number; gigType?: string; bizMult?: number; payBonus?: number;
  /* 地点触发：填了 loc 的条目只在到访该地点时生效（地点 id，可用正则如 "apartment|home"），不参与工作结算 */
  id?: string; // 可选稳定 id（用于记录触发次数；不填按 恋人@地点@名称）
  msgMode?: "append" | "replace"; // 剧情要点：接在地点原文后（缺省）/ 整段替换原文
  loc?: string; msg?: string;
  /* 数值增减（通用，两种触发方式都可用；工作结算时在工作成功后生效）：key 见 PerkKey 说明；delta 可正可负 */
  fx?: { key: string; delta: number }[];
  /** @deprecated 旧写法，仍兼容：等同 fx 里的 stress / reputation / fame / affinity */
  stress?: number; reputation?: number; fame?: number; affinity?: number;
  /* 附加条件（两种触发方式通用；全部可选，不填 = 不限制；同时满足才触发） */
  when?: PerkWhen;
};
/** 伴侣加成触发条件：各世界观通用的主角状态门槛 */
/* 属性键（所有世界观通用）：
 *   stat:<能力id>  本世界观的能力（叫法 / 停用按「角色属性」配置）   attr:<属性id>  自定义属性
 *   affinity 与该恋人的好感   week 当前周（只用于条件）   stress 压力   energy 行动力
 *   fame / reputation / blackFans / looks：引擎内置项（娱乐圈默认；looks 只读，只用于条件） */
export type PerkReq = { key: string; op: ">=" | "<="; value: number };
export type PerkWhen = {
  req?: PerkReq[]; // 通用条件：属性 ≥ / ≤ 某值，全部满足
  /** @deprecated 旧写法，仍兼容 */
  minWeek?: number; minFame?: number; minReputation?: number; minLooks?: number;
  maxBlackFans?: number; minAffinity?: number; maxStress?: number;
  chance?: number; // 触发概率 0~100（缺省 100）
  maxTimes?: number; // 整局最多触发几次（缺省不限）
  cooldownDays?: number; // 两次触发至少间隔几天
  perWeek?: number; // 每周最多触发几次
};
export type RelationsContent = {
  dimensions: RelDimension[];
  mood: { init: number; min: number; max: number; coldDays: number; decayPerDay: number; warmFloor: number };
  contact: {
    energyCost: number; cooldownDays: number; friendship: number; trust: number;
    moodLift: number; romanticCasual: number; romanticIfDating: number;
    stressRelief: number; stressReliefDating: number;
    labels: { button: string; cooldown: string; lowEnergy: string; done: string };
  };
  confess: {
    friendshipMin: number; romanticMin: number;
    labels: { button: string; locked: string; done: string; alreadyDating: string; hardLocked: string };
  };
  romanticCap: { default: number; byPerson: Record<string, number> };
  partnerPerks?: PartnerPerk[]; // 伴侣加成（工作 / 通告类结算；没有该玩法的世界观留空即可）
  affinityCap?: { default?: number; byPerson?: Record<string, number> }; // 好感上限；缺省与心动上限相同
  trust: { init: number; min: number; max: number };
  /* 以下可选，缺省 = 引擎默认（所有世界观通用） */
  bridge?: import("../../game/bridge").BridgeSlot; // 牵线玩法：次数 / 关闭 / 改写或新增方式
  wedding?: { cost?: number; minAffinity?: number }; // 婚礼费用（按当前钱包货币）与好感门槛，默认 30000 / 80
};

export const RAW_RELATIONS = parse(relationsRaw) as RelationsContent;
/* 模组槽 relations：未声明时沿用引擎默认参数 */
/* 模组只写部分字段（如只配婚礼 / 牵线）时，其余沿用默认，避免缺 confess / dimensions 而失效 */
export const RELATIONS: RelationsContent = liveRecord(() => {
  const v = slot("relations", () => RAW_RELATIONS);
  return v === RAW_RELATIONS ? v : { ...RAW_RELATIONS, ...v, confess: { ...RAW_RELATIONS.confess, ...v?.confess } };
});
export const REL_DIM_BY_ID: Record<string, RelDimension> = liveById(() => RELATIONS.dimensions);
export const romanticCapOf = (pid: string): number =>
  RELATIONS.romanticCap.byPerson[pid] ?? RELATIONS.romanticCap.default;
/** 好感（s.rel）上限：relations.affinityCap 可单独配置，缺省沿用心动上限（各世界观通用，不写死角色 id） */
/** 当前恋人带来的通告加成（按 relations.partnerPerks；不写死角色） */
export function partnerPerksFor(isPartner: (pid: string) => boolean, gig: { star: number; type: string }): PartnerPerk[] {
  return (RELATIONS.partnerPerks ?? []).filter((p) => {
    if (!p?.pid || p.loc || !isPartner(p.pid)) return false;
    if (p.minStar != null && gig.star < p.minStar) return false;
    if (p.gigType) { try { if (!new RegExp(p.gigType).test(gig.type)) return false; } catch { return false; } }
    return true;
  });
}
/** 到访某地点时，当前恋人带来的加成（relations.partnerPerks 中填了 loc 的条目；不写死角色） */
export function partnerLocPerksFor(isPartner: (pid: string) => boolean, locId: string): PartnerPerk[] {
  return (RELATIONS.partnerPerks ?? []).filter((p) => {
    if (!p?.pid || !p.loc || !isPartner(p.pid)) return false;
    try { return new RegExp(`^(?:${p.loc})$`).test(locId); } catch { return p.loc === locId; }
  });
}
export const affinityCapOf = (pid: string): number =>
  RELATIONS.affinityCap?.byPerson?.[pid] ?? RELATIONS.affinityCap?.default ?? romanticCapOf(pid);

/* 开局经纪合约：从本世界观「行业生态」里真实存在的经纪公司生成，条款按公司声望推算。
 * 高声望 = 保底高、分成低、违约金高、管得严；低声望 = 保底薄、分成高、更自由。
 * 合约槽里同名公司的手写条款优先（作者可精调）；世界观没有公司时退回合约槽的 signing。 */
const DEFAULT_FOCUS: FocusRule[] = [
  { match: "电影|影视|银幕|戏", label: "影视向", tone: "coral", exclusive: "影视资源优先；戏约须经公司报备" },
  { match: "音乐|唱片|歌", label: "音乐向", tone: "jade", exclusive: "音乐作品独家发行；影视商务较自由" },
  { match: "代言|商业|红毯|品牌", label: "商业向", tone: "gold", exclusive: "商务代言独家；接戏须避开代言竞品" },
  { match: "综艺|话题|风口", label: "综艺向", tone: "gold", exclusive: "综艺与话题营销由公司统一安排" },
  { match: "偶像|练习生|团体|粉丝", label: "偶像向", tone: "coral", exclusive: "团体活动优先；恋爱须向公司报备" },
];
const safeRe = (src: string) => { try { return new RegExp(src); } catch { return null; } };
function focusOf(c: CompanyContent, p: number): { label: string; tone: string; exclusive: string } {
  const rules = contractsNow().focusRules?.length ? contractsNow().focusRules! : DEFAULT_FOCUS;
  const hit = c.focus ? rules.find((r) => r.label === c.focus) : rules.find((r) => safeRe(r.match)?.test(c.blurb));
  return {
    label: c.focus ?? hit?.label ?? "综合向",
    tone: c.tone ?? hit?.tone ?? "jade",
    exclusive: c.exclusive ?? hit?.exclusive ?? (p > 0.6 ? "全约独家；季度有回本考核" : "经纪约独家；个人发展较自由"),
  };
}
const round = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
function offerOf(c: CompanyContent, i: number): SigningContract {
  const p = Math.max(0, Math.min(100, c.prestige)) / 100;
  const f = focusOf(c, p);
  const jitter = () => 0.9 + Math.random() * 0.2;
  const style = c.boss?.style ? `${c.boss.title ?? "老板"}·${c.boss.name} · ${c.boss.style}` : `业内声望 ${c.prestige}`;
  return {
    id: `co_${i}`,
    company: c.name,
    companyStyle: style,
    focusLabel: f.label,
    tone: f.tone,
    icon: "",
    baseSalary: round((3000 + p * 7000) * jitter(), 500),
    revenueShare: Math.round(50 - p * 28),
    penalty: round((40000 + p * 200000) * jitter(), 10000),
    exclusive: f.exclusive,
    signBonus: round((5000 + p * 40000) * jitter(), 1000),
    trust: Math.round(8 + p * 12),
    reputation: Math.round(p * 6 - 1),
    blurb: c.blurb,
    prestige: c.prestige,
    boss: c.boss,
  };
}
/* 开局合约绑定阵营：创作者配置了开局势力时，递合约的就是这些势力本身（签哪家 = 加入哪个阵营）。
 * 与公司表同名的沿用该公司的声望 / 手写条款，否则按势力初始声望生成条款。 */
export type FactionOfferSrc = { id: string; name: string; desc?: string; rep?: number };
export function factionSigningOffers(factions: FactionOfferSrc[]): SigningContract[] {
  const hand = new Map(SIGNING_CONTRACTS.map((x) => [x.company, x]));
  return factions.map((f) => {
    const i = COMPANIES.findIndex((c) => c.name === f.name);
    const co: CompanyContent = i >= 0 ? COMPANIES[i] : { name: f.name, prestige: Math.max(10, Math.min(90, (f.rep ?? 20) + 30)), blurb: f.desc ?? "" };
    const h = hand.get(co.name);
    const base = h ? { ...h, prestige: co.prestige, boss: co.boss } : offerOf(co, i >= 0 ? i : 0);
    return { ...base, id: i >= 0 ? `co_${i}` : `fac_${f.id}`, blurb: base.blurb || f.desc || "", factionId: f.id };
  });
}

/* 抽 count 份：声望高/中/低各取一家，保证选择有取舍 */
export function rollSigningOffers(count = 3): SigningContract[] {
  const cos = COMPANIES.map((c, i) => ({ c, i }));
  if (!cos.length) return [...SIGNING_CONTRACTS];
  const hand = new Map(SIGNING_CONTRACTS.map((x) => [x.company, x]));
  const sorted = [...cos].sort((a, b) => b.c.prestige - a.c.prestige);
  const n = Math.min(count, sorted.length);
  const picks = Array.from({ length: n }, (_, k) => {
    const lo = Math.floor((k * sorted.length) / n), hi = Math.floor(((k + 1) * sorted.length) / n);
    return sorted[lo + Math.floor(Math.random() * Math.max(1, hi - lo))];
  });
  return picks.map(({ c, i }) => {
    const h = hand.get(c.name);
    return h ? { ...h, id: `co_${i}`, prestige: c.prestige, boss: c.boss } : offerOf(c, i);
  });
}
