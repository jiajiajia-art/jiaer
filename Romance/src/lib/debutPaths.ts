export type DebutPath = {
  id: string;
  identityId: string;
  name: string;
  tag: string;
  blurb: string;
  about: string;
  open: boolean;
  age: string;
  school: string;
  choose: string[];
  fixed: string[];
  perks: string;
};

export const DEFAULT_DEBUT_PATHS: DebutPath[] = [
  {
    id: "kban", identityId: "kban", name: "科班出道", tag: "京都电影学院 · 专业出身", open: true,
    age: "22", school: "京都电影学院",
    blurb: "四年科班打底，演技与才智扎实，只是顶着「学院派放不开」的偏见起步。",
    about: "你是京都电影学院表演系的应届生，基本功过硬、被恩师看好，却也背着「学院派、不够灵、不会来事」的成见入行。这条线更偏影视正剧与演技路线：靠一部部作品与奖项立住脚，比起流量更看重口碑与专业认可。开局家人多半反对你入行——他们盼你安稳，而非抛头露面。",
    fixed: ["出道路径：科班出道（identityId 锁定）", "年龄：固定 22 岁", "母校：京都电影学院"],
    choose: ["姓名 / 性别 / 头像", "出生月日 → 星座与专属加成", "父亲职业 / 母亲职业", "家庭背景 / 出身阶层 / 家世叙述", "外形风格 / 职业方向", "初始特质（1 个）", "签约经纪公司"],
    perks: "演技、才智、口碑偏高；初始名气偏低（专业底子厚，但还没名气）。",
  },
  {
    id: "royal", identityId: "royal", name: "皇族出道", tag: "名门 · 争议加身", open: false,
    age: "22", school: "曜城国际学院",
    blurb: "含着金汤匙入场，光环与非议如影随形。",
    about: "出身名门望族，含着金汤匙入场，高定造型与话题度拉满。父母希望你继承家业而非当明星，光环与「资本捧的」非议如影随形。",
    fixed: ["出道路径：皇族出道", "出身：名门望族"], choose: ["姓名 / 性别 / 头像", "家族与人设走向"],
    perks: "容貌、名气极高；黑粉与口碑压力偏大。",
  },
  {
    id: "sr", identityId: "sr", name: "素人出道", tag: "草根 · 一张白纸", open: false,
    age: "20", school: "无固定母校",
    blurb: "毫无根基，也毫无包袱，全凭一股闯劲。",
    about: "没有学历背景、没有资源，从最底层的通告与试镜摸爬滚打。开局资金宽裕、公关空间大，但八维基础薄弱，靠临场与运气翻身。",
    fixed: ["出道路径：素人出道", "出身：素人"], choose: ["姓名 / 性别 / 头像", "白手起家的方向"],
    perks: "初始资金 +20万、公司公关高；八维各项偏低。",
  },
];

const STORAGE_KEY = "star2005.debutPaths.v1";

export function loadDebutPaths(): DebutPath[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DEBUT_PATHS.map((path) => ({ ...path, choose: [...path.choose], fixed: [...path.fixed] }));
    const parsed = JSON.parse(raw) as DebutPath[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_DEBUT_PATHS;
  } catch {
    return DEFAULT_DEBUT_PATHS;
  }
}

export function saveDebutPaths(paths: DebutPath[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  window.dispatchEvent(new CustomEvent("star:debut-paths-changed"));
}

export function resetDebutPaths() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("star:debut-paths-changed"));
}
