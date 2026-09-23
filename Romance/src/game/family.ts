/* 双亲档案：由玩家设定（姓名 / 父母职业 / 阶层 / 家世）确定性推导出父母的完整档案。
 * 仅用于展示与开局叙事，不参与数值结算；同一存档每次生成结果一致。 */
import type { Npc, Player } from "../lib/types";

export type ParentProfile = {
  relation: "父亲" | "母亲";
  name: string;
  age: number;
  job: string;
  personality: string;
  origin: string; // 籍贯 / 出身
  bond: string; // 与你的关系底色
  attitude: string; // 对你入行的态度
  bio: string; // 一段小传
};

/* 稳定散列：字符串 → 32 位无符号整数 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// 注意：调用处的种子多为 hash 结果的带符号位移（如 `ms >> 2`），可能为负。
// 负数取模在 JS 中得负索引 → arr[负] 为 undefined（曾导致「沈undefined」）。
// 这里归一到 [0, len) 区间，兼容负数与超大种子。
const pick = <T,>(arr: T[], seed: number): T => arr[((Math.trunc(seed) % arr.length) + arr.length) % arr.length];

const FATHER_GIVEN = ["建国", "志远", "国栋", "长海", "正邦", "德全", "守义", "文轩", "怀山", "承宗", "立诚", "鸿飞"];
const MOTHER_GIVEN = ["秀兰", "淑芬", "惠珍", "美玲", "雅琴", "婉如", "桂英", "月华", "静宜", "碧云", "凤仪", "曼青"];
const MOTHER_SUR = ["林", "苏", "沈", "许", "杜", "宋", "叶", "唐", "夏", "白", "顾", "章"];

const FATHER_PERSONA = ["沉默寡言却极有主见", "严厉方正、不苟言笑", "温厚爱笑、事事替人着想", "固执要强、认死理", "洒脱豁达、爱讲道理", "内敛克制、心事不外露"];
const MOTHER_PERSONA = ["温柔细腻、心疼儿女", "精明能干、家里的主心骨", "要强好胜、望女成凤", "慈爱包容、从不重话", "敏感多虑、爱操心", "开朗健谈、人缘极好"];
const ORIGINS = ["江南水乡的老城厢", "北方一座工业小城", "临海的渔港小镇", "内陆的省会旧城区", "西南山城的老街", "中原一处安静的县城"];

/* 职业关键词 → 小传素材 */
function jobFlavor(job: string): string {
  if (/军|警|武/.test(job)) return "半生戎马，规矩刻进了骨子里，家里的作息比部队还准时。";
  if (/高管|企业|老板|经理|商/.test(job)) return "在商海里摸爬滚打多年，谈笑间自有一股不容置疑的气场。";
  if (/教授|教师|老师|学者|研究/.test(job)) return "书卷气浓，家里最多的就是书，最看重的就是一个「正」字。";
  if (/医|护/.test(job)) return "见惯了生老病死，反倒把日子过得格外通透踏实。";
  if (/工程|技术|工/.test(job)) return "手上有活、心里有谱，信奉一分耕耘一分收获。";
  if (/记者|编辑|媒体|报/.test(job)) return "笔头厉害、见识广，最懂这世道的人情冷暖。";
  if (/名角|梨园|戏|艺|演/.test(job)) return "一辈子扑在台上，对「登台」二字有说不尽的爱与怕。";
  if (/农|种|养/.test(job)) return "土里刨食大半辈子，最朴素也最要强，就盼儿女能出人头地。";
  return "在自己的岗位上勤勤恳恳，把这个家撑得妥妥当当。";
}

/* 对你入行的态度：贴合阶层 + 职业，与开局叙事口径一致 */
function attitudeOf(relation: "父亲" | "母亲", klass: string, job: string, seed: number): string {
  const wealthy = /殷实|名门|贵族/.test(klass) || /高管|企业|老板|军|名角/.test(job);
  const scholarly = /书香|教授|教师|老师|学者|记者|编辑/.test(job);
  if (wealthy) {
    return relation === "父亲"
      ? "本盼着你安稳继承家业、走一条体面的正途，觉得抛头露面「不是我们这样人家该做的事」——嘴上反对，心里却也偷偷剪下你的每一次报道。"
      : "怕你在圈子里受委屈、被人指指点点，宁愿你嫁得安稳、过太平日子；可只要你回家，她仍会把最好的都留给你。";
  }
  if (scholarly) {
    return relation === "父亲"
      ? "担心娱乐圈浮沉无根、糟蹂了你的前程，总念叨「一技傍身才踏实」——却在你第一次上电视那晚，红着眼守到了最后一秒。"
      : "怕这条路太苦、太不由人，劝你「读书才是正道」；但你每回失落，她又是第一个说「不行就回家，妈养你」的人。";
  }
  // 草根 / 工薪 / 清贫
  return relation === "父亲"
    ? "半信半疑，怕你被人骗、白吃苦，嘴硬说「别做梦了」——转头却把攒了多年的私房钱塞给你当盘缠。"
    : "起初死活不同意，怕你受苦；可看你是真心热爱，也只能一边抹泪一边给你收拾行李，叮嘱你按时吃饭。";
}

function findExtra(player: Player, label: string): string | undefined {
  return player.extra?.find((e) => e.label === label)?.value;
}

export function familyProfiles(player: Player): ParentProfile[] {
  const surname = (player.name || "林").trim().charAt(0) || "林";
  const playerAge = parseInt(String(player.age).replace(/[^\d]/g, ""), 10);
  const baseAge = Number.isFinite(playerAge) && playerAge > 0 ? playerAge : 20;
  const klass = player.klass || "中产";

  const fatherJob = findExtra(player, "父亲职业") || "退役军官";
  const motherJob = findExtra(player, "母亲职业") || "上市公司高管";

  const fs = hash(`${player.name}|父|${fatherJob}`);
  const ms = hash(`${player.name}|母|${motherJob}`);

  const father: ParentProfile = {
    relation: "父亲",
    name: `${surname}${pick(FATHER_GIVEN, fs)}`,
    age: baseAge + 24 + (fs % 9),
    job: fatherJob,
    personality: pick(FATHER_PERSONA, fs >> 3),
    origin: pick(ORIGINS, fs >> 6),
    bond: pick(["严父", "慈父", "沉默的靠山", "老小孩"], fs >> 9),
    attitude: attitudeOf("父亲", klass, fatherJob, fs),
    bio: `${pick(ORIGINS, fs >> 6)}人，做「${fatherJob}」大半辈子。${jobFlavor(fatherJob)}`,
  };
  const mother: ParentProfile = {
    relation: "母亲",
    name: `${pick(MOTHER_SUR, ms)}${pick(MOTHER_GIVEN, ms >> 2)}`,
    age: baseAge + 22 + (ms % 8),
    job: motherJob,
    personality: pick(MOTHER_PERSONA, ms >> 3),
    origin: pick(ORIGINS, ms >> 6),
    bond: pick(["慈母", "严母", "无话不谈的知己", "刀子嘴豆腐心"], ms >> 9),
    attitude: attitudeOf("母亲", klass, motherJob, ms),
    bio: `${pick(ORIGINS, ms >> 6)}人，现从事「${motherJob}」。${jobFlavor(motherJob)}`,
  };
  return [father, mother];
}

/* 双亲档案的固定人物 id：与其他 NPC 统一登记进花名册（game.npcs / metPeople），
 * 从而复用同一套「人脉」详情面板，而非另起一套独立档案。 */
export const FAMILY_NPC_IDS = ["family-father", "family-mother"] as const;

/* 双亲 → 统一 Npc 卡片：把确定性推导的档案折叠成与圈内人物同构的花名册条目。
 * 好感开局给到亲密区间（不镜像引擎 s.rel，故保留自身值）；背景故事整合性格 / 关系底色 / 态度。 */
export function familyNpcs(player: Player): Npc[] {
  return familyProfiles(player).map((f, i) => ({
    id: FAMILY_NPC_IDS[i],
    name: f.name,
    age: String(f.age),
    identity: f.job,
    relation: f.relation,
    avatar: "",
    bio: `${f.bio}\n\n性格${f.personality}；于你而言，是${f.bond}。\n\n${f.attitude}`,
    mood: "牵挂",
    affinity: 90,
    dims: [
      { label: "信任", value: 95 },
      { label: "爱慕", value: 0 },
      { label: "友善", value: 80 },
      { label: "敌意", value: 0 },
    ],
    tags: [f.bond, `籍贯 · ${f.origin}`],
    attrs: [],
    affinityHistory: [],
    interactions: [],
  }));
}
