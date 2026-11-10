/**
 * 功能注释：C2.2 平台「手机应用」表单草稿 ↔ Studio AppSpec 桥。
 * 对话补丁可写 pages/blocks；无 pages 时用 contentText 合成一页，供 Runner 预览。
 */

export type PhoneAppBridgeDraft = {
  name: string;
  summary: string;
  category: string;
  type: string;
  contentText: string;
  /** 可选：对话直接产出的页面积木 */
  pages?: Array<{
    id?: string;
    name?: string;
    blocks?: Array<{
      id?: string;
      type?: string;
      text?: string;
      title?: string;
      label?: string;
      items?: string[];
    }>;
  }>;
  color?: string;
  intro?: string;
};

export type BridgeBlock = {
  id: string;
  type: string;
  text?: string;
  title?: string;
  label?: string;
  items?: string[];
  source?: string;
};

export type BridgePage = {
  id: string;
  name: string;
  blocks: BridgeBlock[];
};

export type BridgeAppSpec = {
  name: string;
  type: string;
  features: string[];
  pages: BridgePage[];
  tabs: string[];
  interaction: string;
  storage: string;
  login: boolean | null;
  network: boolean | null;
  iconDesc: string;
  color: string;
  intro: string;
  layout: null;
  skills: string[];
  skillConfig: Record<string, unknown>;
};

function uid(p: string) {
  return `${p}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 功能注释：无 pages 时把 contentText 拆成文本积木首页，保证预览区立刻有可点内容 */
export function synthesizePagesFromContent(draft: PhoneAppBridgeDraft): BridgePage[] {
  const lines = String(draft.contentText || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const blocks: BridgeBlock[] = [];
  if (draft.summary?.trim()) {
    blocks.push({ id: uid("b"), type: "text", text: draft.summary.trim() });
  }
  if (!lines.length) {
    blocks.push({
      id: uid("b"),
      type: "text",
      text: draft.name?.trim()
        ? `「${draft.name.trim()}」草稿预览。继续对话可加列表、第二页等。`
        : "先对话生成名称与内容，预览会同步跟上。",
    });
  } else {
    for (const line of lines) {
      if (/^[-•·]/.test(line) || /^列表/.test(line)) {
        blocks.push({
          id: uid("b"),
          type: "list",
          title: "列表",
          items: lines.filter((x) => /^[-•·]/.test(x)).map((x) => x.replace(/^[-•·]\s*/, "")),
        });
        break;
      }
      blocks.push({ id: uid("b"), type: "text", text: line });
    }
  }
  return [{ id: "home", name: "首页", blocks }];
}

/** 功能注释：表单/对话草稿 → AppSpec；有合法 pages 优先用 AI 产出 */
export function formDraftToAppSpec(draft: PhoneAppBridgeDraft): BridgeAppSpec {
  const rawPages = Array.isArray(draft.pages) ? draft.pages : [];
  const pages: BridgePage[] = rawPages
    .map((p, i) => {
      const id = String(p.id || `p${i + 1}`).trim() || `p${i + 1}`;
      const blocks = (Array.isArray(p.blocks) ? p.blocks : [])
        .map((b, j) => ({
          id: String(b.id || `b${j + 1}`),
          type: String(b.type || "text"),
          text: b.text,
          title: b.title,
          label: b.label,
          items: Array.isArray(b.items) ? b.items.map(String) : undefined,
        }))
        .filter((b) => b.type);
      return {
        id,
        name: String(p.name || `第${i + 1}页`).trim() || `第${i + 1}页`,
        blocks,
      };
    })
    .filter((p) => p.blocks.length > 0);

  const finalPages = pages.length ? pages : synthesizePagesFromContent(draft);
  const tabs = finalPages.map((p) => p.id);

  return {
    name: String(draft.name || "未命名应用").trim() || "未命名应用",
    type: String(draft.type || "browse"),
    features: draft.category ? [draft.category] : [],
    pages: finalPages,
    tabs,
    interaction: "tap",
    storage: "local",
    login: false,
    network: false,
    iconDesc: "",
    color: String(draft.color || "#7cc8a6"),
    intro: String(draft.intro || draft.summary || ""),
    layout: null,
    skills: ["ui"],
    skillConfig: {},
  };
}

/** 功能注释：把 AI 补丁里的 pages 合并进草稿（按 id） */
export function mergePhoneAppPagesPatch(
  draft: PhoneAppBridgeDraft,
  patch: Record<string, unknown> | null,
): PhoneAppBridgeDraft {
  if (!patch || !Array.isArray(patch.pages)) return draft;
  return { ...draft, pages: patch.pages as PhoneAppBridgeDraft["pages"] };
}
