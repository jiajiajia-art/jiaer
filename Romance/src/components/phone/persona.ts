/* 人设化动态生成：让社交 App（微博/小红书/抖音）里每条动态都贴合作者的职业与性格，
 * 而不是把「杀青花絮」「翻跳热舞」硬塞给经纪人、制片、资本大佬或你妈。
 * 依据 npc.identity / relation / tags 归类到人设，再从对应文案池确定性取一条（按 id 播种，稳定不变）。 */

export type Persona = "performer" | "musician" | "crew" | "mogul" | "family" | "civilian";

type PersonaInput = { identity?: string; relation?: string; tags?: string[]; name?: string };

const has = (s: string | undefined, re: RegExp) => !!s && re.test(s);
const tagsHit = (tags: string[] | undefined, re: RegExp) => Array.isArray(tags) && tags.some((t) => re.test(t));

/* 归类：家人优先（避免「高管母亲」被误判为资本），随后资本 / 幕后 / 音乐 / 台前，兜底普通人。 */
export function classifyPersona(npc: PersonaInput): Persona {
  const id = npc.identity ?? "";
  const rel = npc.relation ?? "";
  const tags = npc.tags;
  if (/父亲|母亲|爸|妈|父母|双亲/.test(rel)) return "family";
  if (has(id, /CEO|家主|金主|资本|总裁|董事|高管|实业|市长|掌权|创一代|企业|老板|富商|财团/) || tagsHit(tags, /资本|谢家|掌权|事业|财/)) return "mogul";
  if (has(id, /导演|制片|监制|选角|编剧|经纪|教练|总监|商务|宣传|制作人|幕后|策划/) || tagsHit(tags, /经纪|导演|制片|教练|商务|广告/)) return "crew";
  if (has(id, /歌手|音乐|创作|词曲|才女|驻唱|唱作|乐手|制作人/) || tagsHit(tags, /创作|音乐|才女/)) return "musician";
  if (has(id, /演员|顶流|影后|天王|花旦|主演|艺人|明星|偶像|旦|生|新人/) || tagsHit(tags, /顶流|影后|天王|前辈|宿敌/)) return "performer";
  return "civilian";
}

/* 稳定散列 + 取样：同一 npc 同一平台永远取同一条，salt 可错开多条。 */
function h(str: string): number {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
function pick<T>(arr: T[], seed: string): T {
  return arr[h(seed) % arr.length];
}

/* ————— 微博：一句话博文（贴合人设口吻） ————— */
const WEIBO: Record<Persona, string[]> = {
  performer: [
    "杀青了。谢谢剧组每一个陪我熬夜的人，这个角色我会记很久。",
    "新戏定妆照来啦，这次的造型你们打几分？",
    "又是一个通宵夜戏，收工时天都亮了。演员这行，苦，也甘。",
    "颁奖礼后台随手拍，紧张到手心全是汗——还好没辜负这一年。",
    "路演最后一站，谢谢每一座城市的灯光，和你们的每一声呼喊。",
  ],
  musician: [
    "新歌今晚上线，写给所有城市里的夜归人。愿你被温柔听见。",
    "深夜写歌，副歌卡了好几个礼拜，今天终于通了。",
    "巡演最后一场，谢谢你们把每一句词都唱回给我。",
    "录音棚泡了三天，为了一个气口反复来回。值得。",
    "旋律得等一把对的嗓子才活得过来——这半首，先存着。",
  ],
  crew: [
    "新戏选角进行中。还是那句话：我不看名气，看眼里有没有戏。",
    "一部好电影能让人记你一辈子。这个本子，我压了三年。",
    "带新人这行累，可看着他们真正发光那一刻，值了。",
    "秋冬大秀圆满收官，感谢每一位到场、每一位熬夜的伙伴。",
    "在片场熬了二十年，最信的还是那句——镜头比谁都诚实。",
  ],
  mogul: [
    "投资从不是恩情，是我看好一个人能走多远。",
    "又谈成一桩合作。这座城的水面之下，永远比看起来热闹。",
    "低调落地的几个公益项目，今天见了成效——不必挂我的名字。",
    "看人不看他站得多高，看他摔下来还爬不爬得起来。",
    "签过很多合同，最看重的两个字，始终是分寸。",
  ],
  family: [
    "闺女又熬夜拍戏了吧？记得喝妈给你带的枸杞茶，别硬撑。",
    "家里的饭菜一直给你留着，什么时候回来都是热乎的。",
    "在外面照顾好自己，别惦记家里，我们都好。",
    "看电视又看到你了，妈把频道守着，一秒都舍不得错过。",
    "累了就回家。这扇门，永远给你留着。",
  ],
  civilian: [
    "平平淡淡的一天，煮了碗热汤，等晚归的人。",
    "楼下的桂花开了，随手拍给你们看看。",
    "把吉他调好了弦，晚上小酒馆见。",
    "生活嘛，把眼前的日子过踏实就好。",
    "深夜留一盏灯，给所有还在赶路的人。",
  ],
};

/* ————— 小红书：标题 + 正文（生活方式向，仍分人设） ————— */
const XHS: Record<Persona, { title: string; body: string }[]> = {
  performer: [
    { title: "进组第一天｜演员的行李箱都装了啥", body: "剧本、马克笔、护嗓的胖大海，还有妈妈塞的枸杞茶。每一样都陪我熬过夜戏。" },
    { title: "红毯造型幕后花絮", body: "从早上八点弄头发，到晚上走上红毯，中间发生了好多小插曲。分享几张没修的路透。" },
    { title: "背台词的笨办法", body: "抄一遍、录下来、边走边听。没有捷径，把人物小传吃透才敢进组。" },
    { title: "杀青了！这部戏我哭了三次", body: "谢谢每一个熬夜陪我的人，也谢谢那个没放弃的自己。杀青照放评论区啦。" },
  ],
  musician: [
    { title: "一首歌是怎么写出来的", body: "先有一句旋律卡在脑子里，再一个字一个字填上去。分享我的创作笔记。" },
    { title: "驻唱五年，我攒下的护嗓清单", body: "胖大海、蜂蜜水、少熬夜——嗓子是吃饭的家伙，得当命护着。" },
    { title: "深夜 demo 分享", body: "抱着吉他随手弹的一段，还很粗糙，但我很喜欢它此刻的样子。" },
    { title: "我的第一把吉他", body: "琴漆都磨掉了，陪我从天台唱到舞台。旧东西，才装得下故事。" },
  ],
  crew: [
    { title: "选角导演的一天", body: "看片、见人、翻资料袋。留到最后的，从来都是把角色吃透的那一个。" },
    { title: "在片场熬了二十年，我学会的三件事", body: "尊重每一个工种、剧本翻到起毛边、别轻易许诺。" },
    { title: "带新人训练的日常", body: "仪态、台风得每天磨，练一分是一分。镜头比谁都诚实。" },
    { title: "一场大秀的幕后", body: "灯光、走位、试装，几百个环节咬合到位，才有台上那三分钟。" },
  ],
  mogul: [
    { title: "书房一角", body: "谈判之外，最放松的还是安静读一本书。" },
    { title: "收藏的一支旧钢笔", body: "签过很多合同，这支笔陪了我十年。有些东西，越用越有分量。" },
    { title: "出差间隙的城市夜景", body: "见完这一场，飞下一座城。灯火通明的地方，往往最安静。" },
    { title: "关于分寸", body: "成年人的体面，是把话说清、把界限划明。共勉。" },
  ],
  family: [
    { title: "给远方孩子的家常菜", body: "红烧肉、排骨汤，孩子在外拍戏辛苦，回家总得吃口热乎的。" },
    { title: "阳台上的花又开了", body: "养花养草，等孩子回家。日子慢一点，心才踏实。" },
    { title: "整理孩子小时候的照片", body: "翻出一箱旧相册，眼睛一下子就湿了。慢慢长大，慢慢发光。" },
    { title: "熬一锅汤的耐心", body: "小火慢炖三个钟头，急不得。就像盼你回家这件事。" },
  ],
  civilian: [
    { title: "一个人也要好好吃饭", body: "简单煮的一餐，简单但治愈。健康才有力气过日子呀。" },
    { title: "藏在巷子里的咖啡馆", body: "靠窗位超好坐，老板很温柔，适合一个人放空半天。" },
    { title: "深夜留一盏灯", body: "给晚归的人留碗热汤。平凡日子里的小小仪式感。" },
    { title: "周末的慢时光", body: "擦擦吉他、扫扫地、发会儿呆。不赶时间的日子最奢侈。" },
  ],
};

/* ————— 抖音：文案 + 配乐（短视频调性，仍分人设） ————— */
const DOUYIN: Record<Persona, { caption: string; music: string }[]> = {
  performer: [
    { caption: "新戏杀青花絮来啦！这段 NG 了 8 次哈哈哈 #剧组日常", music: "影视原声 · 重逢" },
    { caption: "红毯路透，这个造型你们打几分？ #红毯造型", music: "原声 · 星城之夜" },
    { caption: "和搭档的对手戏太上头了，等正片！#期待", music: "影视原声 · 千灯之城" },
    { caption: "凌晨四点的片场，追梦的人不觉得累 #努力", music: "钢琴曲 · 夜曲" },
  ],
  musician: [
    { caption: "深夜 demo，随手弹的一段，你们听听 #原创音乐", music: "原创 · 夜色手记" },
    { caption: "翻唱最近很火的那首，跑调别骂我 #唱歌日常", music: "翻唱 · 光年之外" },
    { caption: "副歌终于写通了，先哼一句给你们 #创作", music: "小样 · 未完成的副歌" },
    { caption: "小酒馆驻唱现场，今晚气氛刚好 #现场", music: "现场 · 城南旧事" },
  ],
  crew: [
    { caption: "新戏开机大吉！这次的阵容我很有信心 #开机", music: "轻快 · Summer" },
    { caption: "带训现场，基本功没有捷径 #台风训练", music: "节奏 · 心动" },
    { caption: "选角桌前的一天，眼里有没有戏一看便知 #幕后", music: "轻音乐 · 追光者" },
    { caption: "一场大秀的最后一次彩排 #幕后花絮", music: "电子 · 星城之夜" },
  ],
  mogul: [
    { caption: "行程间隙，随手记录一下城市夜景 #出差日常", music: "钢琴曲 · 夜曲" },
    { caption: "签完这一场，飞下一座城 #在路上", music: "轻音乐 · 山河故人" },
    { caption: "难得的清晨，安静读一会儿书 #自律", music: "纯音乐 · 长夜有灯" },
    { caption: "谈成了一桩不小的合作，庆祝一下 #工作", music: "轻快 · 逆风少年" },
  ],
  family: [
    { caption: "闺女难得回家，做了一桌她爱吃的 #家的味道", music: "温情 · 追光者" },
    { caption: "阳台的花开了，拍给外面的孩子看看 #生活", music: "民谣 · 城南旧事" },
    { caption: "守着电视等孩子上镜，一秒都舍不得错过 #牵挂", music: "温情 · 重逢" },
    { caption: "煲了三个钟头的汤，就等你回家喝 #家常", music: "轻音乐 · 夜曲" },
  ],
  civilian: [
    { caption: "一个人的深夜厨房，简单又治愈 #生活记录", music: "民谣 · 夜色手记" },
    { caption: "楼下的桂花开了，香得走不动路 #日常", music: "轻音乐 · 城南旧事" },
    { caption: "调好琴，晚上小酒馆见 #音乐日常", music: "现场 · 未完成的副歌" },
    { caption: "把日子过踏实，就是最好的状态 #慢生活", music: "纯音乐 · 长夜有灯" },
  ],
};

export function weiboPost(npc: PersonaInput & { id: string }): string {
  return pick(WEIBO[classifyPersona(npc)], `wb:${npc.id}`);
}
export function xhsPost(npc: PersonaInput & { id: string }): { title: string; body: string } {
  return pick(XHS[classifyPersona(npc)], `xhs:${npc.id}`);
}
export function douyinPost(npc: PersonaInput & { id: string }): { caption: string; music: string } {
  return pick(DOUYIN[classifyPersona(npc)], `dy:${npc.id}`);
}
