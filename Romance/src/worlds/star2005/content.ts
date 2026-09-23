/* ═══════════════ 世界内容池加载器 (ContentPool loader) ═══════════════
 * 解析 world.yaml，暴露强类型内容与「通用」门槛求值器。
 * 本模块不含任何领域中文映射或人物专属公式——中文与阈值全部来自 YAML；
 * 这里只做「读数据 + 通用比较」，符合「内容在池、规则在引擎、参数不入引擎」的契约。
 */
import { parse } from "yaml";
import { computeLooks, type GameState as SimState } from "../../game/logic";
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

/* 亲属引用：id 命中花名册且已结识时可点击跳转，否则以 name 显示；缺省则前端渲染「尚未得知」 */
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
  relation?: string; // 与玩家的关系（档案「与你」栏；缺省则显示「尚未得知」）
  gender?: string; // 性别（档案确定性数据，非推断）
  age?: number; // 年龄（档案确定性数据，非推断）
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
  works?: string[]; // 代表作（片名，取自内容池；credits 缺省时的简版回退）
  credits?: Credit[]; // 详版代表作（含角色分工/剧情/主演联动）
  stats?: Partial<Record<string, number>>; // 八维能力（缺省字段前端显示「尚未得知」）
};

/* ═══ 条件邂逅事件 ═══
 * 仿「进入地点触发 NPC 特殊事件」的逻辑：须与该人物同处一地（前端只在在场人物的行动条里给出），
 * 且满足下列条件——requires 复用通用门槛（week 生涯周数≈阅历/年岁、fame/reputation/stats.* 等）；
 * needTrait 校验你的初始特质（性格）；minRel 校验你与 TA 的关系状态（双方状态）。once 为一次性。
 * effects 为纯数值增减；seed 为触发后落入对话框、交给 AI 叙事的种子（AI 只在资源库设定内演绎）。 */
export type Encounter = {
  id: string;
  personId: string;
  label: string;
  seed: string;
  once?: boolean;
  requires?: Requirement[];
  needTrait?: string;
  minRel?: number;
  effects?: { rel?: number; stress?: number; energy?: number; fame?: number; reputation?: number };
};

export const ENCOUNTERS: Encounter[] = [
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
    needTrait: "voice",
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

const ENC_BY_PERSON: Record<string, Encounter[]> = ENCOUNTERS.reduce((acc, e) => {
  (acc[e.personId] ??= []).push(e);
  return acc;
}, {} as Record<string, Encounter[]>);

export function encountersOf(personId: string): Encounter[] {
  return ENC_BY_PERSON[personId] ?? [];
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
};

export const SIDEQUESTS: SideQuest[] = [
  {
    id: "sq01_toolate",
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

export const SIDEQUEST_BY_ID: Record<string, SideQuest> = Object.fromEntries(
  SIDEQUESTS.map((q) => [q.id, q]),
);

export type RoomItem = { id: string; name: string; icon: string; desc: string; linksProjects?: boolean; price?: number };
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
  exits: Partial<Record<Dir, string>>;
  desc: string;
  intro?: string;
  items?: RoomItem[];
  activities?: RoomActivity[]; // 在此地可点选的日常活动（缺省=无）
  hours?: string; // 营业/开放时段（展示用）
  openDays?: number[]; // 开放的星期（1=周一 … 7=周日）；缺省=每日开放
  tint?: string; // 地点背景图色调键（jade|coral|gold|ink|plum）
  access?: RoomAccess; // 通行门槛（缺省=无门槛）
};
export type TravelContent = { minutesPerHop: number; feePerHop: number; energyPerHop: number; dayStartMinute?: number; dayEndMinute?: number };

export type CalendarContent = {
  eraName: string;
  startYear: number;
  startDate: string;
  careerWeeks: number;
  weekdayNames: string[];
  monthLabel: string;
  dayLabel: string;
};

type WorldContent = {
  calendar: CalendarContent;
  directions: Record<Dir, string>;
  travel: TravelContent;
  metricLabels: Record<string, string>;
  roomStatus: Record<string, string>; // 营业状态文案（open/closed/busy/event…）
  rooms: Record<string, RoomContent>;
  people: PersonContent[];
};

export const WORLD = parse(raw) as WorldContent;

export const CALENDAR = WORLD.calendar;
export const DIR_LABEL = WORLD.directions;
export const ROOMS = WORLD.rooms;
export const TRAVEL = WORLD.travel;
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
};
type ContractsContent = {
  natures: NatureContent[];
  meta: Record<string, ContractMeta>;
  negotiation: NegotiationContent;
  signing: SigningContract[];
};

export const CONTRACTS = parse(contractsRaw) as ContractsContent;
export const SIGNING_CONTRACTS: SigningContract[] = CONTRACTS.signing;
export const NATURE_BY_ID: Record<string, NatureContent> = Object.fromEntries(
  CONTRACTS.natures.map((n) => [n.id, n]),
);
export const NEGOTIATION = CONTRACTS.negotiation;

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
export const IMAGE_CRISIS = parse(imageRaw) as ImageCrisisContent;
export const PERSONAS = IMAGE_CRISIS.personas;
export const PUBLIC_ACTS = IMAGE_CRISIS.publicActs;
export const CRISES = IMAGE_CRISIS.crises;
export const CRISIS_RESPONSES = IMAGE_CRISIS.responses;
export const PERSONA_BY_ID: Record<string, PersonaContent> = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
export const CRISIS_BY_ID: Record<string, CrisisContent> = Object.fromEntries(CRISES.map((c) => [c.id, c]));

/* —— 游戏资料库（help 文档，供知识库检索）—— */
export type HelpDoc = { id: string; title: string; keywords: string[]; body: string };
type HelpContent = { intro: string; era: string; docs: HelpDoc[] };
const HELP = parse(helpRaw) as HelpContent;
export const HELP_DOCS: HelpDoc[] = HELP.docs;
export const HELP_INTRO: string = HELP.intro;

/* —— 娱乐圈生态（公司名号 / 剧目 / 代言品牌）—— 引擎按序号取用，中文只在此 —— */
export type CompanyBoss = { name: string; title: string; age: number; style: string; quote: string; bio: string };
export type CompanyContent = { name: string; prestige: number; blurb: string; boss?: CompanyBoss };
export type AwardSpec = { ceremony: string; category: string; gender: string; metric: string };
type IndustryContent = { companies: CompanyContent[]; movies: string[]; ads: string[]; awards: AwardSpec[]; starEvents: Record<string, string[]> };
const INDUSTRY = parse(industryRaw) as IndustryContent;
export const COMPANIES: CompanyContent[] = INDUSTRY.companies;
export const MOVIE_TITLES: string[] = INDUSTRY.movies;
export const AD_BRANDS: string[] = INDUSTRY.ads;
export const AWARDS: AwardSpec[] = INDUSTRY.awards;
export const STAR_EVENTS: Record<string, string[]> = INDUSTRY.starEvents ?? {};
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
  return m;
}

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
type ProjectsContent = {
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

export const PROJECTS_POOL = parse(projectsRaw) as ProjectsContent;
export const PROJECT_TEMPLATES = PROJECTS_POOL.projects;
export const PROJECT_TPL_BY_ID: Record<string, ProjectTemplate> = Object.fromEntries(
  PROJECT_TEMPLATES.map((p) => [p.id, p]),
);
export const PRODUCER = PROJECTS_POOL.producer;
export const NEGOTIATE = PROJECTS_POOL.negotiate;

/* ═══════════════ 娱乐圈关系内容池 (relations) ═══════════════ */
export type RelDimension = { id: string; label: string; hint: string };
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
  trust: { init: number; min: number; max: number };
};

export const RELATIONS = parse(relationsRaw) as RelationsContent;
export const REL_DIM_BY_ID: Record<string, RelDimension> = Object.fromEntries(
  RELATIONS.dimensions.map((d) => [d.id, d]),
);
export const romanticCapOf = (pid: string): number =>
  RELATIONS.romanticCap.byPerson[pid] ?? RELATIONS.romanticCap.default;
