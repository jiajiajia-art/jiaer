
// ST render utils: build regex and apply render rules (raw injection)
export interface StRenderRule {
  id?: string;
  order: number;
  pattern: string;
  replace: string;
  stage?: 'render' | 'generate' | 'both';
  target?: 'reply' | 'system' | 'user' | 'assistant' | 'all';
  markdownOnly?: boolean;
  promptOnly?: boolean;
  minDepth?: number | null;
  maxDepth?: number | null;
  runOnEdit?: boolean;
  trimStrings?: string[] | null;
}

export function buildRegex(pattern: string): RegExp {
  const src = String(pattern || '');
  if (src.startsWith('/') && src.lastIndexOf('/') > 0) {
    const last = src.lastIndexOf('/');
    const pat = src.slice(1, last);
    const flags = src.slice(last + 1) || 'g';
    return new RegExp(pat, flags);
  }
  return new RegExp(src, 'g');
}

export function applyRenderRules(
  text: string,
  rules: StRenderRule[] | undefined,
  opts?: { assetPrefix?: string },
): string {
  let out = String(text || '');
  if (!Array.isArray(rules) || !rules.length) return out;

  const sorted = [...rules].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const r of sorted) {
    if (!r || !r.pattern || !r.replace) continue;
    if (r.stage && r.stage !== 'render' && r.stage !== 'both') continue;
    if (r.target && r.target !== 'reply' && r.target !== 'all') continue;

    const re = buildRegex(r.pattern);
    const replaceTemplate = String(r.replace);

    out = out.replace(re, (...args: any[]) => {
      const match = args[0];
      const lastArg = args[args.length - 1];
      const hasGroups = lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg);
      const groups = hasGroups ? (lastArg as Record<string, any>) : {};
      const capturesEndTrim = hasGroups ? 3 : 2; // offset, input, (groups?)
      const captures = args.slice(1, Math.max(1, args.length - capturesEndTrim));

      let html = replaceTemplate;

      html = html.replace(/\$<([^>]+)>/g, (_: string, name: string) => (groups && groups[name] != null ? String(groups[name]) : ''));
      html = html.replace(/\$(\d+)/g, (_: string, n: string) => {
        const idx = parseInt(n, 10) - 1;
        return captures[idx] != null ? String(captures[idx]) : '';
      });
      html = html.replace(/\{\{\s*match\s*\}\}/gi, match);

      if (opts?.assetPrefix) {
        html = html.replace(/\{\{\s*ASSET_PREFIX\s*\}\}/g, opts.assetPrefix);
      }

      // 如果替换片段包含可执行/完整片段，则包裹为 iframe（独立执行环境）
      const needIframe = /<(script|link|style|html|head|body)\b|<!doctype/i.test(html);
      if (!needIframe) return html;

      const id = `FL-iframe-${++__flEmbedSeq}-${Math.random().toString(36).slice(2, 8)}`;
      const doc = html; // 原样注入，不加任何封装脚本

      // 避免属性转义带来的实体乱码：把完整文档以 base64 装进 data-st-srcdoc64，渲染层再赋给 iframe.srcdoc
      let encoded = '';
      try {
        encoded = (typeof btoa === 'function') ? btoa(unescape(encodeURIComponent(doc))) : '';
      } catch { encoded = ''; }
      if (encoded) {
        return `<iframe id="${id}" class="st-embed pk-iframe fl-iframe" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" style="width:100%;border:0;height:600px;display:block" data-fl-embed-id="${id}" data-st-srcdoc64="${encoded}"></iframe>`;
      }
      const uri = encodeURIComponent(doc);
      return `<iframe id="${id}" class="st-embed pk-iframe fl-iframe" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" style="width:100%;border:0;height:600px;display:block" data-fl-embed-id="${id}" data-st-srcdoc="${uri}"></iframe>`;
    });
  }

  return out;
}

export type StConfig = {
  preset?: { system?: string; model?: string; temperature?: number; [k: string]: any };
  persona?: { name?: string; description?: string; personality?: string; first_mes?: string; alternate_greetings?: string[] };
  regex: StRenderRule[];
  globals?: Record<string, any>;
  variables?: Record<string, any>;
  preferCharacterId?: string;
  // carry-through fields for ST compatibility (optional; backend may read these)
  extensions?: any;
  data?: any;
};

// A few built-in rule presets for quick add
export const ST_RULE_PRESETS: { key: string; name: string; rule: StRenderRule }[] = [
  {
    key: 'status_bar',
    name: '状态条：好感度',
    rule: {
      id: 'status-bar',
      order: 10,
      pattern: '(好感度：(?<val>\\d+))',
      replace: '<span class="status">好感度：$<val></span>',
      stage: 'render',
      target: 'reply',
    },
  },
  {
    key: 'phone_msg',
    name: '手机消息块',
    rule: {
      id: 'phone-message',
      order: 20,
      pattern: '/\[消息\|([^\]]+)\]\s*[:：]\s*([\s\S]+?)(?=\n|$)/g',
      replace:
        '<div class="msg"><div class="sender">$1</div><div class="bubble">$2</div></div>',
      stage: 'render',
      target: 'reply',
      markdownOnly: true,
    },
  },
];

// SillyTavern compatible shapes (for creator form)
export interface STRegexScript {
  id?: string;
  scriptName?: string;
  findRegex: string;
  replaceString: string;
  placement?: number[];
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
  trimStrings?: string[];
}

export interface STCharBookEntry {
  keys: string[];
  content: string;
  priority?: number;
  enabled?: boolean;
  case_sensitive?: boolean;
  secondary_keys?: string[];
  comment?: string;
  role?: string;
  uid?: string | number;
}
let __flEmbedSeq = 0;
