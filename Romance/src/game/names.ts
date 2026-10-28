/* 姓名字库（易次元式）：姓氏 + 分性别的名字库 + 风格（现代 / 古风 / 洋气）。
 * 模组可通过 npcPool.surnames / femaleNames / maleNames 覆盖；未声明则用本库。
 * 读取均为函数调用，不在模块顶层读取其它模块的值（避免循环依赖 TDZ）。 */
import { slot } from "../mods/live";

export type NameGender = "女" | "男" | "其他";
export type NameStyle = "modern" | "ancient" | "any";

export const SURNAMES_COMMON = (
  "王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤"
).split("");
export const SURNAMES_ELEGANT = (
  "沈顾陆江温裴谢卫云简秋商宁楚萧容季苏叶白池晏祁闻乔岑凌傅俞虞殷纪蓝洛阮霍黎谈慕"
).split("");
export const SURNAMES_COMPOUND = ["欧阳", "上官", "司马", "诸葛", "东方", "慕容", "南宫", "司徒", "皇甫", "独孤", "令狐", "宇文", "长孙", "夏侯", "公孙", "端木", "百里", "钟离", "澹台", "轩辕"];

/* 女名 */
export const F_MODERN = [
  "知夏", "念棠", "初晴", "以澄", "予安", "语迟", "南乔", "听澜", "星桥", "见月", "安然", "可馨", "思妤", "梓涵", "若溪", "诗韵", "雨桐", "沐晴",
  "欣怡", "佳琪", "子衿", "一诺", "芷若", "书瑶", "嘉宁", "清欢", "晚晴", "暖暖", "小满", "朝颜", "半夏", "星澜", "妍希", "语嫣", "苒苒", "知意",
  "南星", "栀夏", "简宁", "惜颜", "明媚", "糖糖", "乐瑶", "沛珊", "晓棠", "舒窈", "依依", "梦琪", "静姝", "凝雪", "可可", "思甜", "晴川", "雨薇",
];
export const F_ANCIENT = [
  "疏影", "宛卿", "婉清", "云裳", "青鸾", "画屏", "锦瑟", "长歌", "倾城", "灵犀", "绾绾", "如烟", "落雁", "若离", "月华", "霓裳", "玉笙", "素衣",
  "清浅", "扶摇", "惊鸿", "昭华", "瑶光", "初雪", "流萤", "红鸾", "碧落", "浅月", "倾颜", "沉鱼", "凤仪", "芊芊", "盈袖", "黛眉", "璃月", "清婉",
];
/* 男名 */
export const M_MODERN = [
  "景行", "知远", "一航", "子墨", "浩然", "宇轩", "思源", "明哲", "嘉树", "沐阳", "承泽", "亦辰", "致远", "书衡", "泽宇", "星河", "逸凡", "子航",
  "铭轩", "皓辰", "俊熙", "博文", "睿泽", "景琛", "言蹊", "砚舟", "时安", "既白", "怀瑾", "嘉言", "知行", "北辰", "屿森", "听风", "南风", "司南",
  "骁", "野", "昀", "珩", "澈", "屹", "朗", "驰", "煜", "砚",
];
export const M_ANCIENT = [
  "长渊", "惊澜", "墨渊", "君临", "玄霄", "无忧", "承影", "千寻", "临渊", "孤城", "凌霄", "寒舟", "逐风", "清晏", "怀瑾", "望舒", "琅琊", "扶苏",
  "子瑜", "伯言", "景珩", "辞镜", "沧澜", "夜白", "长庚", "云深", "听雪", "破军", "重华", "砚秋",
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

type Pool = { surnames?: string[]; femaleNames?: string[]; maleNames?: string[] };
const modPool = (): Pool => slot<Pool>("npcPool", () => ({}), () => ({}));

export function surnames(): string[] {
  const m = modPool().surnames;
  return m?.length ? m : [...SURNAMES_COMMON, ...SURNAMES_ELEGANT, ...SURNAMES_ELEGANT, ...SURNAMES_COMPOUND];
}
export function givenNames(gender: NameGender, style: NameStyle = "any"): string[] {
  const p = modPool();
  const mod = gender === "男" ? p.maleNames : gender === "女" ? p.femaleNames : [...(p.femaleNames ?? []), ...(p.maleNames ?? [])];
  if (mod?.length) return mod;
  const f = style === "modern" ? F_MODERN : style === "ancient" ? F_ANCIENT : [...F_MODERN, ...F_ANCIENT];
  const m = style === "modern" ? M_MODERN : style === "ancient" ? M_ANCIENT : [...M_MODERN, ...M_ANCIENT];
  return gender === "男" ? m : gender === "女" ? f : [...f, ...m];
}

/** 按性别生成一个完整姓名；avoid 中的名字不会重复出现（尝试有限次后放宽） */
export function randomName(gender: NameGender = "女", style: NameStyle = "any", avoid?: Set<string>): string {
  const sn = style === "ancient" ? [...SURNAMES_ELEGANT, ...SURNAMES_COMPOUND] : surnames();
  const gn = givenNames(gender, style);
  for (let i = 0; i < 40; i++) {
    const n = pick(sn) + pick(gn);
    if (!avoid?.has(n)) { avoid?.add(n); return n; }
  }
  return pick(sn) + pick(gn);
}

/** 字库规模（给 UI 展示） */
export const nameLibSize = (gender: NameGender) => ({ surnames: surnames().length, given: givenNames(gender).length });

/** 字库分组（给「名字库」弹窗用）；模组提供自定义名单时只显示模组那一组 */
export function surnameGroups(): [string, string[]][] {
  const m = modPool().surnames;
  if (m?.length) return [["本世界", m]];
  return [["常见", SURNAMES_COMMON], ["雅致", SURNAMES_ELEGANT], ["复姓", SURNAMES_COMPOUND]];
}
export function givenGroups(gender: NameGender): [string, string[]][] {
  const p = modPool();
  const mod = gender === "男" ? p.maleNames : gender === "女" ? p.femaleNames : undefined;
  if (mod?.length) return [["本世界", mod]];
  if (gender === "男") return [["现代", M_MODERN], ["古风", M_ANCIENT]];
  if (gender === "女") return [["现代", F_MODERN], ["古风", F_ANCIENT]];
  return [["女·现代", F_MODERN], ["女·古风", F_ANCIENT], ["男·现代", M_MODERN], ["男·古风", M_ANCIENT]];
}
