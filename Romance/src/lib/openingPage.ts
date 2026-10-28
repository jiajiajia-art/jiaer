/* 自定义开场页：作者（或样式工作室 AI）写的完整 HTML，在沙箱 iframe 里全屏运行。
 * 引擎把编辑器开场白数据经 postMessage 注入（writing=false、ready=true）；AI 开局剧情不在此页生成。
 * 模板按钮调用 parent.postMessage("start", "*") 进入游戏。 */
export type OpeningPageData = {
  kicker: string; title: string; subtitle: string;
  name: string; location: string; time: string;
  paragraphs: string[]; // 编辑器开场白段落（已替换占位）
  html: string; // 作者 HTML（已去脚本）；非空时替代 paragraphs
  writing: boolean; ready: boolean; failed: boolean; stage: string;
  waiting: string; cta: string; image: string; video: string;
};

/* 注入在模板最前面的桥：收消息 → window.OPENING + "opening" 事件；startGame()/retryOpening() 便捷调用 */
const BRIDGE = `<script>(function(){window.OPENING=null;window.addEventListener("message",function(e){var m=e.data;if(!m||m.type!=="opening")return;window.OPENING=m.data;try{window.dispatchEvent(new CustomEvent("opening",{detail:m.data}))}catch(_){}});window.startGame=function(){parent.postMessage("start","*")};window.retryOpening=function(){parent.postMessage("retry","*")};})();</script>`;
export function openingSrcDoc(page: string): string {
  const i = page.search(/<head[^>]*>/i);
  if (i >= 0) { const end = page.indexOf(">", i) + 1; return page.slice(0, end) + BRIDGE + page.slice(end); }
  return BRIDGE + page;
}
export const postOpening = (w: Window | null | undefined, data: OpeningPageData) => w?.postMessage({ type: "opening", data }, "*");

/** 从 AI 回复里取出 HTML（```html 代码块，或整段就是文档；被截断时取到结尾） */
export function extractHtml(raw: string): string | null {
  const fenced = /```(?:html)?\s*\n([\s\S]*?)(?:```|$)/i.exec(raw)?.[1]?.trim();
  const doc = fenced && /<(html|body|div|style|!doctype)/i.test(fenced) ? fenced : /<!doctype html|<html[\s>]/i.test(raw) ? raw.slice(raw.search(/<!doctype html|<html[\s>]/i)).replace(/```[\s\S]*$/, "").trim() : null;
  return doc && doc.length > 120 ? doc : null;
}

export const SAMPLE_OPENING: OpeningPageData = {
  kicker: "Prologue · 序章", title: "序章", subtitle: "",
  name: "林知夏", location: "天光公寓", time: "第 1 周 · 2005.01.03 周一",
  paragraphs: [
    "林知夏出生在南方一座多雨的小城，父亲是中学语文老师，母亲在街口开一间裁缝铺。",
    "她从小就爱对着裁缝铺的穿衣镜念台词，母亲总笑她：「镜子里的人又不会给你鼓掌。」",
    "可当她真的拿着录取通知书说要去北京学表演时，父亲沉默了一整晚，第二天只说了一句：「这行太苦，你别后悔。」",
    "此刻她站在天光公寓的窗前，兜里揣着五千块，楼下的城市刚刚亮灯。",
  ],
  html: "", writing: false, ready: true, failed: false, stage: "",
  waiting: "灯亮了。", cta: "走上台去", image: "", video: "",
};
