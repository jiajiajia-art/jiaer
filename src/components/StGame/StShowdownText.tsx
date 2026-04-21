import React, { useMemo, useRef, useEffect } from 'react';
import { applyRenderRules, type StRenderRule } from '../../utils/stRender';
import { convertToColoredHtml } from '../Galgame/ColoredMarkdownText';
type Props = {
  text: string;
  rules?: StRenderRule[];
  assetPrefix?: string;
  className?: string;
};

const StShowdownText: React.FC<Props> = ({ text, rules, assetPrefix, className }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => {
    const withHtml = applyRenderRules(text || '', rules || [], { assetPrefix });
    // 如果包含原生 HTML 块，showdown 会原样透传；否则进行 Markdown 转换
    const hasRaw = /<(script|link|style|iframe|video|audio|canvas|svg)\b/i.test(withHtml);
    return hasRaw ? withHtml : convertToColoredHtml(withHtml);
  }, [text, rules, assetPrefix]);

  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const ifrs = Array.from(root.querySelectorAll('iframe')) as HTMLIFrameElement[];
    // 不再监听子 iframe 的消息，保持用户片段原样运行

    const bind = (ifr: HTMLIFrameElement) => {
      // 统一样式
      ifr.classList.add('st-embed');
      if (!ifr.style.width) ifr.style.width = '100%';
      if (!ifr.style.border) ifr.style.border = '0';
      // 如果是我们包的 iframe，则把 data-st-srcdoc64 / data-st-srcdoc 转为真实内容（用 doc.write 避免属性转义问题）
      const src64 = ifr.getAttribute('data-st-srcdoc64');
      const srcUri = ifr.getAttribute('data-st-srcdoc');
      if (src64 || srcUri) {
        let html = '';
        try {
          if (src64) html = decodeURIComponent(escape(atob(src64)));
          else if (srcUri) html = decodeURIComponent(srcUri);
        } catch {}
        const sandbox = ifr.getAttribute('sandbox') || 'allow-scripts allow-same-origin';
        const cls = ifr.className;
        const styleText = ifr.getAttribute('style') || '';
        const heightText = ifr.getAttribute('height') || '';
        const idAttr = ifr.getAttribute('id') || '';
        const dataId = ifr.getAttribute('data-fl-embed-id') || '';
        const newIfr = document.createElement('iframe');
        newIfr.setAttribute('sandbox', sandbox);
        if (cls) newIfr.className = cls;
        // Also mark with pk-iframe to match older devtools selectors
        try { newIfr.classList.add('pk-iframe'); } catch {}
        if (styleText) newIfr.setAttribute('style', styleText);
        if (heightText) newIfr.setAttribute('height', heightText);
        if (idAttr) newIfr.setAttribute('id', idAttr);
        if (dataId) newIfr.setAttribute('data-fl-embed-id', dataId);
        ifr.replaceWith(newIfr);
        try {
          // Use srcdoc to avoid same-origin dependency (works with sandbox w/o allow-same-origin)
          try { (newIfr as any).srcdoc = html; } catch { newIfr.setAttribute('srcdoc', html); }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[ST iframe] assign srcdoc failed:', e);
        }
      }
      // 仅负责把 data-st-srcdoc64 / data-st-srcdoc 解码并赋值到 srcdoc，不再自适应高度或注入消息
      return () => {};
    };

    const unbinds = ifrs.map(bind);
    return () => {
      unbinds.forEach(fn => { try { fn(); } catch {} });
    };
  }, [html]);

  if (!text) return null;

  return <div ref={rootRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default StShowdownText;
