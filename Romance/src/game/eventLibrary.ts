import type { FixedEvent } from "../lib/types";

/* 事件库：从策划案《素人出道模拟》抽取的预设固定事件，供编辑器一键导入。
 * - 12.2 支线与随机事件池：12 个主事件模板（每个含主动应对 / 谨慎退出 / 到期结果）
 * - 13.2 九位人物七节点事件链：节点 1 依相识条件，2~7 由前一节点激活（locked + nextIds）
 * id 均以 lib_ 开头且稳定，重复导入时据此去重。 */

export type LibraryKind = "random" | "chain" | "npc" | "career";
export const LIBRARY_KINDS: { id: LibraryKind; label: string }[] = [
  { id: "random", label: "随机事件" },
  { id: "chain", label: "人物链" },
  { id: "npc", label: "NPC 之间" },
  { id: "career", label: "职业库" },
];
export type LibraryGroup = { id: string; kind: LibraryKind; title: string; desc: string; events: FixedEvent[] };

/* —— 12.2 支线与随机事件池 —— */
const RANDOM: FixedEvent[] = [
  {
    id: "lib_rnd_missed", name: "失约补救", once: true,
    conds: [{ kind: "metric", key: "week", op: "gte", value: 3 }],
    prompt: "主角因档期冲突错过了一次已约好的见面或排练。对方等了很久，消息里带着失望。请演绎这一幕，并给出选择：主动登门道歉并提出具体补偿时间（主动应对）／发消息简短致歉、暂不打扰（谨慎退出）。若一周内未回应，对方会默认被轻视。",
    effects: [{ kind: "metric", key: "stress", delta: 3 }],
  },
  {
    id: "lib_rnd_credit", name: "署名协商", once: true,
    conds: [{ kind: "metric", key: "works", op: "gte", value: 1 }],
    prompt: "一份作品的宣传物料上，主角的署名位置或称谓与合同约定不符。请演绎主角发现问题的场景，并给出选择：带合同找制片方当面协商（主动应对）／先记录证据、等作品上线后再提（谨慎退出）。到期结果须依据合同条款，而非临场情绪。",
    effects: [{ kind: "metric", key: "stress", delta: 2 }],
  },
  {
    id: "lib_rnd_costume", name: "服装损坏", once: true,
    conds: [{ kind: "metric", key: "fame", op: "gte", value: 30 }],
    prompt: "拍摄前，主角借来的一件演出服被意外勾破。必须记录借衣来源与责任方。请演绎慌乱的后台，并给出选择：自费找裁缝连夜修补（主动应对）／照价赔偿给出借方（谨慎退出）／与造型团队交涉责任（交涉）。不同选择决定是否产生债务。",
    effects: [{ kind: "metric", key: "money", delta: -300 }, { kind: "metric", key: "stress", delta: 4 }],
  },
  {
    id: "lib_rnd_rescue", name: "节目救场", once: true,
    conds: [{ kind: "metric", key: "fame", op: "gte", value: 60 }],
    prompt: "一档节目的嘉宾临时缺席，录制现场出现真实空缺，导演组急需有人顶上。请演绎紧张的录制间，并给出选择：接下救场、临场发挥（主动应对）／婉拒、不冒险（谨慎退出）。成功会留下履约证据与好评；失败会留下可解释的评价，但不会被反复刷出。",
    effects: [{ kind: "metric", key: "fame", delta: 8 }, { kind: "metric", key: "stress", delta: 5 }],
  },
  {
    id: "lib_rnd_delay", name: "排播延期", once: true,
    conds: [{ kind: "metric", key: "works", op: "gte", value: 1 }],
    prompt: "主角参与的作品被通知排播延期，原定的宣传期全部作废。请演绎接到电话的那一刻，并给出选择：主动联系宣传方调整计划（主动应对）／接受安排，把时间转投训练（谨慎退出）。日程须显示真实等待天数与原因。",
    effects: [{ kind: "metric", key: "stress", delta: 3 }],
  },
  {
    id: "lib_rnd_onset", name: "片场争执", once: true,
    conds: [{ kind: "metric", key: "fame", op: "gte", value: 40 }],
    prompt: "片场里副导演与摄影组为一场戏的机位起了争执，气氛僵住，所有人都在等。请演绎这一幕，并给出选择：主动提出折中的走位方案（主动应对）／安静候场，不卷入（谨慎退出）。结果影响主角在剧组的评价。",
    effects: [{ kind: "metric", key: "stress", delta: 3 }],
  },
  {
    id: "lib_rnd_demoleak", name: "Demo泄露", once: true,
    conds: [{ kind: "rel", key: "linzhixia", op: "gte", value: 20 }],
    prompt: "一首尚未发行的 Demo 在网上流传。真相是：一名已登记的工作人员误寄了邮件——证据来自寄件回执与收件人确认，不能临时改成所有恋人都可疑。请演绎主角与林知夏得知消息后的反应，并给出选择：一起调取回执、公开说明（主动应对）／暂不回应、等法务处理（谨慎退出）。",
    effects: [{ kind: "metric", key: "stress", delta: 6 }],
  },
  {
    id: "lib_rnd_misquote", name: "记者误引", once: true,
    conds: [{ kind: "metric", key: "fame", op: "gte", value: 80 }],
    prompt: "一篇采访稿断章取义，把主角的话写成了对前辈的不敬，评论区开始发酵。请演绎主角刷到报道的瞬间，并给出选择：拿录音要求更正并公开澄清（主动应对）／低调不回应，等热度过去（谨慎退出）。到期未处理会累积黑粉。",
    effects: [{ kind: "metric", key: "blackFans", delta: 2 }, { kind: "metric", key: "reputation", delta: -2 }],
  },
  {
    id: "lib_rnd_fanletter", name: "歌迷来信", once: true,
    conds: [{ kind: "metric", key: "fame", op: "gte", value: 50 }],
    prompt: "公司转来一封手写信：一位歌迷说主角的作品陪她度过了最难的一段日子。请温柔地演绎主角读信的夜晚，并给出选择：亲笔回信（主动应对）／把信收好，作为继续努力的理由（谨慎退出）。",
    effects: [{ kind: "metric", key: "stress", delta: -6 }, { kind: "metric", key: "reputation", delta: 1 }],
  },
  {
    id: "lib_rnd_family", name: "亲友求助", once: true,
    conds: [{ kind: "metric", key: "money", op: "gte", value: 2000 }],
    prompt: "老家的亲戚打来电话，吞吞吐吐地开口借钱。请演绎这通电话，并给出选择：借出一笔明确金额并约定归还（主动应对）／说明自己的难处、婉拒（谨慎退出）。不要替玩家决定亲情的分量。",
    effects: [{ kind: "metric", key: "stress", delta: 4 }],
  },
  {
    id: "lib_rnd_fatigue", name: "身体疲劳", once: true,
    conds: [{ kind: "metric", key: "stress", op: "gte", value: 70 }],
    prompt: "连轴转的行程让主角在化妆间里差点站不稳，镜子里的脸色很差。请演绎这一幕，并给出选择：向经纪方申请休息一天（谨慎退出）／咬牙撑过今天的通告（主动应对，但压力继续累积）。压力 ≥ 90 时须提示崩溃风险。",
    effects: [{ kind: "metric", key: "energy", delta: -10 }],
  },
  {
    id: "lib_rnd_lease", name: "租约提醒", once: true,
    time: { kind: "day", day: 28 },
    conds: [{ kind: "location", key: "apartment" }],
    prompt: "天光小区的物业在门缝里塞了一张续租通知，下月房租即将到期。请演绎主角回到公寓看到通知的场景，并给出选择：按时续租（主动应对）／开始看更便宜的房子（谨慎退出）。到期未处理会产生滞纳金。",
    effects: [{ kind: "metric", key: "stress", delta: 2 }],
  },
];

/* —— 13.2 九位人物七节点事件链 —— */
type Line = { pid: string; name: string; nodes: [string, string, string, string, string, string, string]; first: string };
const LINES: Line[] = [
  { pid: "luyao", name: "陆曜", first: "同场试镜", nodes: ["结识：同场试镜", "共同经历：完成合演", "分歧：竞争主角", "承诺：约定公平争取", "代价选择：揭露违规或保留证据", "关系协商：对手或伙伴", "回收：共同领奖或保持职业距离"] },
  { pid: "suqing", name: "苏晴", first: "同练或咖啡馆偶遇", nodes: ["结识：同练或咖啡馆", "共同经历：替补互助", "分歧：曝光分配不均", "承诺：不拿朋友炒作", "代价选择：工作与陪伴撞档", "关系协商：确认挚友或降温", "回收：首映席位与最后一封短信"] },
  { pid: "linzhixia", name: "林知夏", first: "听到一段已授权的 Demo", nodes: ["结识：听到授权 Demo", "共同经历：排练试唱", "分歧：署名和分成", "承诺：签原创协议", "代价选择：拒绝买断或接受条件", "关系协商：长期搭档或一次合作", "回收：实体唱片署名和分账"] },
  { pid: "shenman", name: "沈曼", first: "一次合格的试镜", nodes: ["结识：合格试镜", "共同经历：片场指导", "分歧：捷径与专业", "承诺：按约完成准备", "代价选择：补拍或赶商业活动", "关系协商：师友或普通同事", "回收：作品评价与推荐信"] },
  { pid: "guchen", name: "顾沉", first: "合法场合的同场", nodes: ["结识：合法同场", "共同经历：共同录音或拍摄", "分歧：媒体误会", "承诺：尊重私人界限", "代价选择：公开澄清或保留隐私", "关系协商：明确交往或朋友", "回收：合约期满后的相处约定"] },
  { pid: "songshixu", name: "宋时序", first: "一份品牌邀约", nodes: ["结识：品牌邀约", "共同经历：审阅投资方案", "分歧：回报与控制权", "承诺：书面边界", "代价选择：接受资金或自筹", "关系协商：事业合作与恋爱分开确认", "回收：股份、版权与关系独立结算"] },
  { pid: "wenyuan", name: "闻予安", first: "一个公益项目", nodes: ["结识：公益项目", "共同经历：核对执行账目", "分歧：公众身份压力", "承诺：按程序办事", "代价选择：拒绝插队资源", "关系协商：私交或交往与职务隔离", "回收：公开项目完成及私人约定"] },
  { pid: "jiangxu", name: "江叙白", first: "公寓设备维修", nodes: ["结识：公寓设备维修", "共同经历：帮录参赛带", "分歧：生活节奏分离", "承诺：不失联的具体约定", "代价选择：重要演出与创业节点撞档", "关系协商：确认日常边界", "回收：搬家、继续相邻或正式交往"] },
  { pid: "zhouyan", name: "周砚川", first: "一次品牌试装", nodes: ["结识：品牌试装", "共同经历：完成样册", "分歧：家庭责任与档期", "承诺：尊重已有责任", "代价选择：危机时支持或退开", "关系协商：成熟合作或交往", "回收：品牌成果与未来安排"] },
];

const NODE_RULE = [
  "这是关系的第一次正式交集，不要让对方立刻熟络。",
  "两人共同完成一件具体的事，关系从客气走向默契。",
  "双方在一件具体的事上产生真实分歧，不要用吃醋或误会草草带过。",
  "主角与对方立下一个具体、可兑现的承诺，并让它被记录下来。",
  "主角必须付出一个真实代价：损失一个可接的商业夜晚、支付补拍成本、降低短期曝光、或保留版权但放弃预付款，四选一并明确写出。",
  "两人坦诚协商这段关系的定义；若对方明确拒绝恋爱，工作或友情分支继续。",
  "依据此前的真实选择兑现、分开或维持合作，不要自动替玩家决定婚姻。",
];

function chain(l: Line): FixedEvent[] {
  const id = (i: number) => `lib_${l.pid}_${i + 1}`;
  return l.nodes.map((title, i): FixedEvent => {
    const conds: FixedEvent["conds"] = [];
    if (i === 1) conds.push({ kind: "rel", key: l.pid, op: "gte", value: 20 });
    if (i === 3) conds.push({ kind: "rel", key: l.pid, op: "gte", value: 35 });
    if (i === 5) conds.push({ kind: "rel", key: l.pid, op: "gte", value: 60 });
    if (i === 6) conds.push({ kind: "metric", key: "week", op: "gte", value: 79 });
    const effects: FixedEvent["effects"] = [{ kind: "rel", key: l.pid, delta: 5 }, { kind: "metric", key: "energy", delta: -8 }];
    if (i !== 1 && i !== 2) effects.push({ kind: "metric", key: "money", delta: -80 });
    return {
      id: id(i),
      name: `${l.name} · ${i + 1}/7 ${title}`,
      once: true,
      locked: i > 0,
      conds,
      effects,
      nextIds: i < 6 ? [id(i + 1)] : undefined,
      prompt: `【${l.name}线 · 第 ${i + 1} 节点｜${title}】${i === 0 ? `契机：${l.first}。` : ""}${NODE_RULE[i]}请演绎这一幕的场景与对白，给出至少一个主动应对与一个谨慎退出的选择，并交代明确的到期结果。`,
    };
  });
}

/* —— NPC 之间的事件：世界不围着主角转，人物彼此也有往来、合作与摩擦 ——
 * 主角可能只是旁观者、被卷入者，或完全不知情（由 AI 以传闻 / 新闻 / 朋友转述呈现）。 */
type NpcPair = { a: string; b: string; an: string; bn: string; name: string; scene: string; at?: string; gate: number; fx?: [number, number] };
const PAIRS: NpcPair[] = [
  { a: "luyao", b: "suqing", an: "陆曜", bn: "苏晴", name: "综艺搭档", scene: "两人被同一档户外综艺绑定为搭档，镜头前默契、镜头外却为分镜和曝光量暗暗较劲", gate: 10, fx: [2, 2] },
  { a: "linzhixia", b: "jiangxu", an: "林知夏", bn: "江叙白", name: "修好的调音台", scene: "林知夏的老调音台坏了，江叙白熬夜修好，两人在录音棚聊起了各自没完成的梦想", at: "dieyin", gate: 15, fx: [3, 3] },
  { a: "guchen", b: "shenman", an: "顾沉", bn: "沈曼", name: "新片选角", scene: "沈曼筹备一部严肃文艺片，想请顾沉出演；顾沉犹豫是否该为口碑放下商业档期", gate: 20 },
  { a: "songshixu", b: "zhouyan", an: "宋时序", bn: "周砚川", name: "品牌投资之争", scene: "宋时序的资本看中了周砚川的服装品牌「序岸」，周砚川坚持不让渡控制权，谈判桌上火药味十足", at: "lounge", gate: 20 },
  { a: "wenyuan", b: "suqing", an: "闻予安", bn: "苏晴", name: "公益义演", scene: "闻予安邀请苏晴担任公益义演主持，苏晴担心被说成作秀，两人为宣传口径反复推敲", gate: 15, fx: [2, 2] },
  { a: "luyao", b: "guchen", an: "陆曜", bn: "顾沉", name: "前后辈较劲", scene: "颁奖礼后台，陆曜被媒体问到是否想成为下一个顾沉；顾沉淡淡一句回应在圈内传开", at: "redcarpet", gate: 25 },
  { a: "shenman", b: "linzhixia", an: "沈曼", bn: "林知夏", name: "电影配乐", scene: "沈曼请林知夏为新片写主题曲，两人为一句歌词的署名与修改权来回拉扯", gate: 20 },
  { a: "zhouyan", b: "suqing", an: "周砚川", bn: "苏晴", name: "代言试装", scene: "周砚川的品牌请苏晴拍春夏样册，拍摄途中周砚川接到家中电话匆匆离场", at: "wardrobe", gate: 15 },
  { a: "songshixu", b: "guchen", an: "宋时序", bn: "顾沉", name: "资本与天王", scene: "宋时序试图入股顾沉的制作团队，被顾沉以「保护团队」为由婉拒，消息被小报写成两人不和", gate: 30 },
  { a: "jiangxu", b: "wenyuan", an: "江叙白", bn: "闻予安", name: "社区改造", scene: "天光小区要做适老化改造，江叙白出设计、闻予安对接公益资金，两人在居委会争论预算细节", at: "apartment", gate: 10, fx: [2, 2] },
  { a: "linzhixia", b: "luyao", an: "林知夏", bn: "陆曜", name: "合唱邀约", scene: "陆曜想发一首合唱单曲拉近歌迷，林知夏担心被当成流量工具，录音前夜两人谈崩又和好", gate: 20 },
  { a: "suqing", b: "shenman", an: "苏晴", bn: "沈曼", name: "试镜指导", scene: "苏晴私下请沈曼指导试镜片段，沈曼毫不留情地指出她太依赖综艺式的表情", at: "academy", gate: 15, fx: [3, 1] },
  { a: "zhouyan", b: "songshixu", an: "周砚川", bn: "宋时序", name: "旧识重逢", scene: "一场慈善晚宴上，人们才发现周砚川与宋时序曾是同一所学校的旧识，两人的寒暄里藏着多年前未说开的心结", at: "lounge", gate: 30 },
  { a: "guchen", b: "jiangxu", an: "顾沉", bn: "江叙白", name: "深夜录音棚", scene: "顾沉的录音设备临时出故障，经人介绍找到江叙白，两个不善言辞的人在凌晨的棚里聊了一整夜", at: "dieyin", gate: 25 },
];
const NPC_EVENTS: FixedEvent[] = PAIRS.map((p) => ({
  id: `lib_npc_${p.a}_${p.b}`,
  name: `${p.an} × ${p.bn} · ${p.name}`,
  once: true,
  conds: [
    { kind: "rel", key: p.a, op: "gte", value: p.gate },
    ...(p.at ? [{ kind: "location" as const, key: p.at }] : [{ kind: "metric" as const, key: "fame", op: "gte" as const, value: p.gate * 3 }]),
  ],
  effects: p.fx ? [{ kind: "rel", key: p.a, delta: p.fx[0] }, { kind: "rel", key: p.b, delta: p.fx[1] }] : undefined,
  prompt: `【NPC 之间｜${p.an} × ${p.bn}】${p.scene}。这是两位人物之间独立发生的故事，不要让它围着主角转。${p.at ? "主角恰好在场，可以旁观、插话或悄悄离开" : "主角只是从新闻、传闻或朋友口中得知此事"}；请给出至少一个介入选择与一个不介入选择，并说明这件事会如何改变两人之间的关系。`,
}));

/* —— 职业库：高自由度的人生分支。主角不必只走艺人路线，可兼职、转幕后或跨界。
 * 每个职业两步：机会出现（入行）→ 由入行激活的进阶事件（需相应能力）。 */
type Career = { key: string; title: string; cat: string; at: string; hint: string; stat: string; need: number; pay: number; step2: string };
const CAREERS: Career[] = [
  { key: "assist", title: "艺人私人助理", cat: "幕后运营", at: "agency", hint: "启星事务所缺一位跟组助理，包食宿，能近距离看懂这一行怎么运转", stat: "caizhi", need: 120, pay: 4000, step2: "被提拔为执行经纪，开始独立对接通告" },
  { key: "pr", title: "宣传企划专员", cat: "幕后运营", at: "yuntai", hint: "云台传媒城的宣传部在招企划，要会写话题、懂舆论", stat: "koucai", need: 150, pay: 5500, step2: "主导一次作品宣发，话题冲上热搜" },
  { key: "makeup", title: "妆发造型师", cat: "幕后", at: "beauty", hint: "昭华形象管理中心的首席造型师看中主角的审美，问愿不愿意来做学徒", stat: "yitai", need: 150, pay: 7000, step2: "为一位一线艺人打造红毯造型，被时尚媒体点名" },
  { key: "photo", title: "摄影摄像", cat: "幕后", at: "cancan", hint: "璀璨广告中心的摄影棚缺人手，器材齐全，按项目结算", stat: "caizhi", need: 130, pay: 8000, step2: "独立掌镜一组杂志封面" },
  { key: "editor", title: "后期剪辑", cat: "幕后", at: "fuguang", hint: "浮光影视基地的后期组在赶片，愿意带一个肯熬夜的新人", stat: "caizhi", need: 140, pay: 6500, step2: "剪出的预告片被导演直接采用" },
  { key: "writer", title: "编剧 / 编审", cat: "幕后", at: "bookstore", hint: "墨痕书店的读书会上，一位制片人读到主角写的短篇，邀请她进编剧组", stat: "caizhi", need: 200, pay: 11000, step2: "以联合编剧身份获得第一个署名" },
  { key: "vocal", title: "声乐老师", cat: "教学", at: "dieyin", hint: "迭音音乐工坊在找能带练习生的声乐老师，按课时计费", stat: "geyi", need: 220, pay: 8000, step2: "带出的学员在选秀中晋级，工作坊请她开大师课" },
  { key: "dance", title: "舞蹈老师", cat: "教学", at: "gym", hint: "星栖练习馆的编舞老师离职，馆长问主角能否先代几节课", stat: "donggan", need: 220, pay: 8000, step2: "为一支新团编排出道舞台" },
  { key: "manager", title: "经纪人助理", cat: "幕后运营", at: "agency", hint: "一位资深经纪人想带个助理，晋升快，但要随叫随到", stat: "koucai", need: 160, pay: 6500, step2: "第一次独立签下一名新人艺人" },
  { key: "social", title: "新媒体运营", cat: "幕后运营", at: "cafe", hint: "白栀咖啡馆的老板想做自媒体，问主角愿不愿意帮忙运营账号", stat: "koucai", need: 110, pay: 5000, step2: "运营的账号粉丝破十万，品牌主动找来合作" },
  { key: "fans", title: "粉丝运营", cat: "幕后运营", at: "yuntai", hint: "一家公司的后援会需要专人维护，要懂粉丝心理也要守住边界", stat: "koucai", need: 120, pay: 5000, step2: "策划一场有口皆碑的线下应援" },
  { key: "event", title: "活动执行", cat: "幕后运营", at: "redcarpet", hint: "红毯会客厅的发布会缺执行，临时请主角顶一场", stat: "tineng", need: 150, pay: 5500, step2: "独立统筹一场大型首映礼" },
  { key: "model", title: "平面模特", cat: "跨界", at: "wardrobe", hint: "华裳时装屋的设计师需要一位试衣模特，按天结算", stat: "yitai", need: 180, pay: 6000, step2: "登上时装周秀场" },
  { key: "anchor", title: "网络主播", cat: "跨界", at: "apartment", hint: "直播平台的运营私信主角，邀请她在家开播试试", stat: "koucai", need: 130, pay: 4500, step2: "一场直播在线人数破万，平台要求签独家" },
  { key: "shop", title: "开一家小店", cat: "跨界", at: "street", hint: "星桥商业街有间铺面低价转让，房东说可以先谈谈", stat: "caizhi", need: 150, pay: -20000, step2: "小店成了网红打卡点，开始盈利" },
  { key: "study", title: "回校进修", cat: "跨界", at: "academy", hint: "京都电影学院开设导演进修班，可以边工作边上课", stat: "yanji", need: 200, pay: -8000, step2: "毕业作品入围学院展映" },
  { key: "charity", title: "公益项目执行", cat: "跨界", at: "apartment", hint: "社区公益项目在招执行人，钱不多，但能做真正有用的事", stat: "zixin", need: 120, pay: 3000, step2: "项目被媒体报道，主角的口碑悄然上升" },
];
const CAREER_EVENTS: FixedEvent[] = CAREERS.flatMap((c): FixedEvent[] => {
  const id1 = `lib_job_${c.key}_1`;
  const id2 = `lib_job_${c.key}_2`;
  return [
    {
      id: id1, name: `${c.title} · 机会出现`, once: true,
      conds: [{ kind: "location", key: c.at }, { kind: "metric", key: "week", op: "gte", value: 2 }],
      effects: [{ kind: "metric", key: "money", delta: c.pay }, { kind: "metric", key: "energy", delta: -10 }],
      nextIds: [id2],
      prompt: `【职业库｜${c.cat} · ${c.title}】${c.hint}。这是一条可选的人生分支，主角完全可以拒绝、兼职尝试，或从此转行。请演绎机会出现的场景，写清工作内容、${c.pay >= 0 ? `收入（约 ${c.pay} 元/月）` : `前期投入（约 ${-c.pay} 元）`}与对艺人档期的影响，给出「接受 / 兼职试试 / 婉拒」三种选择。`,
    },
    {
      id: id2, name: `${c.title} · 进阶`, once: true, locked: true,
      conds: [{ kind: "stat", key: c.stat, op: "gte", value: c.need }],
      effects: [{ kind: "stat", key: c.stat, delta: 20 }, { kind: "metric", key: "reputation", delta: 2 }, { kind: "metric", key: "money", delta: Math.abs(c.pay) }],
      prompt: `【职业库｜${c.title} · 进阶】若主角此前选择了这份工作：${c.step2}。请演绎这一高光时刻，并让主角面对下一步的抉择——全职深耕、与艺人事业并行，还是见好就收。若主角此前已婉拒，请改写为旧同事带来的近况消息，不要强行拉回。`,
    },
  ];
});

export const EVENT_LIBRARY: LibraryGroup[] = [
  { id: "random", kind: "random", title: "支线与随机事件池", desc: "12 个主事件模板 · 每个含主动应对 / 谨慎退出 / 到期结果", events: RANDOM },
  ...LINES.map((l) => ({ id: l.pid, kind: "chain" as const, title: `${l.name} · 七节点事件链`, desc: "结识 → 共同经历 → 分歧 → 承诺 → 代价选择 → 关系协商 → 回收", events: chain(l) })),
  { id: "npc", kind: "npc", title: "NPC 之间的事件", desc: "人物彼此的合作、竞争与旧事 · 主角可旁观、介入或只听说", events: NPC_EVENTS },
  { id: "career", kind: "career", title: "职业库 · 人生分支", desc: "幕后 / 教学 / 跨界共 17 种职业 · 入行 → 进阶，可接受、兼职或婉拒", events: CAREER_EVENTS },
];

export const LIBRARY_EVENTS: FixedEvent[] = EVENT_LIBRARY.flatMap((g) => g.events);
