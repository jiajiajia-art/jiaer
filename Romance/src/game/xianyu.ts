/* 「咸鱼」二手集市——纯逻辑与文案池（仿闲鱼玩法，不含任何真实品牌资产）。
 * 玩家把背包里的物件挂出二次售卖；确认成交后回款、物件出手，并收到买家评价。
 * 引擎侧（GameContext）只负责扣背包/回款/落库；文案与掷值都在此，保证可复现。 */

export type XianyuReview = {
  rating: number; // 1~5 星
  text: string;
  buyer: string; // 买家昵称
};

export type XianyuListing = {
  id: string; // 挂单唯一 id
  itemId: string; // 背包物件 id
  name: string; // 冗余存名，物件出手后仍可回看
  icon: string; // 冗余存 emoji 图标
  price: number; // 玩家定价
  blurb?: string; // 宝贝描述文案（可 AI 生成）
  listedDay: number; // 挂出时的游戏日
  status: "active" | "sold";
  soldPrice?: number; // 实际成交价（买家可能还价）
  review?: XianyuReview; // 成交后买家评价
};

/* 稳定哈希：同一挂单每次计算出的浏览/心动/买家都一致，读档后不跳变 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* 挂单热度：浏览数 / 想要数 / 留言数，纯展示，随定价与时长缓增 */
export function listingBuzz(l: XianyuListing, today: number): { views: number; wants: number; msgs: number } {
  const days = Math.max(0, today - l.listedDay) + 1;
  const seed = hash(l.id);
  const base = (seed % 40) + 8;
  const views = base * days + (seed % 17);
  const wants = Math.floor(views / (6 + (seed % 5)));
  const msgs = Math.floor(wants / 2);
  return { views, wants, msgs };
}

const BUYER_NICKS = [
  "淘个宝贝", "阿栗要暴富", "南风知我意", "只逛不买星人", "捡漏小分队",
  "月亮邮递员", "海边拾贝人", "预算有限但眼光高", "隔壁收纳控", "半糖不加冰",
  "今天也要开心鸭", "苔藓与小熊", "旧物新欢", "深夜蹲守党", "柠檬味的风",
];

const REVIEW_5 = [
  "宝贝和描述完全一致，卖家人超好，沟通顺畅，下次还来！",
  "包装很用心，发货也快，捡到宝了，五星好评~",
  "东西比想象中还新，价格美丽，卖家还送了小赠品，爱了！",
  "痛快人，秒回消息，交易愉快，强烈推荐这个卖家。",
  "质量在线，成色棒，比商场便宜太多，回购预定！",
];
const REVIEW_4 = [
  "整体满意，有点小瑕疵但不影响使用，能接受。",
  "东西不错，就是物流稍慢了一点点，其它都好。",
  "和图片基本一致，性价比可以，给个好评。",
];
const REVIEW_3 = [
  "和图片有一点色差，将就着用吧，价格倒是划算。",
  "成色一般，不过这个价也别太挑了，凑合。",
];

/* 议价买家：一个稳定的买家昵称 + 心理价位（挂价的 75%~100%），用作 AI 砍价的隐藏底牌。 */
export function negotiation(l: XianyuListing): { buyer: string; willingness: number } {
  const seed = hash(l.id + ":nego");
  const factor = 0.75 + ((seed % 26) / 100); // 0.75 ~ 1.00
  return {
    buyer: BUYER_NICKS[seed % BUYER_NICKS.length],
    willingness: Math.max(1, Math.round((l.price * factor) / 5) * 5),
  };
}

/* 由成交价/挂价之比生成买家评价：越接近原价买家越满意，评语稳定可复现。 */
export function reviewFor(l: XianyuListing, soldPrice: number, buyer: string): XianyuReview {
  const ratio = soldPrice / Math.max(1, l.price);
  let rating: number;
  let pool: string[];
  if (ratio >= 0.95) { rating = 5; pool = REVIEW_5; }
  else if (ratio >= 0.85) { rating = 4; pool = REVIEW_4; }
  else { rating = 3; pool = REVIEW_3; }
  return { rating, text: pool[hash(l.id + ":rev") % pool.length], buyer };
}

/* 直接成交（不经砍价）：买家按心理价位一口价拿下，生成评价。 */
export function settleSale(l: XianyuListing): { soldPrice: number; review: XianyuReview } {
  const { buyer, willingness } = negotiation(l);
  const soldPrice = Math.min(l.price, willingness);
  return { soldPrice, review: reviewFor(l, soldPrice, buyer) };
}

/* 卖家信用：已成交评价的平均星级 + 累计成交笔数 */
export function sellerRating(listings: XianyuListing[]): { avg: number; count: number } {
  const sold = listings.filter((l) => l.status === "sold" && l.review);
  if (sold.length === 0) return { avg: 0, count: 0 };
  const sum = sold.reduce((a, l) => a + (l.review?.rating ?? 0), 0);
  return { avg: sum / sold.length, count: sold.length };
}

/* 建议定价：物件原价打个二手折扣（约 6 折），没有原价则给个象征价 */
export function suggestPrice(basePrice?: number): number {
  if (!basePrice || basePrice <= 0) return 30;
  return Math.max(1, Math.round((basePrice * 0.6) / 5) * 5);
}
