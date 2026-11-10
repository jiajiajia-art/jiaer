/**
 * 功能注释：C2.2 手机应用创作页常驻预览——按 AppSpec 渲染页面/积木，对话每轮后刷新。
 * 不依赖 Romance GameContext；静态积木可点切换页面，上传截图位不算预览。
 */
import React, { useMemo, useState } from 'react';
import {
  formDraftToAppSpec,
  type PhoneAppBridgeDraft,
} from '../../lib/phoneAppSpecBridge';
import styles from '../../page/CreatePlatformApp.module.css';

type Props = {
  draft: PhoneAppBridgeDraft;
};

const PhoneAppLivePreview: React.FC<Props> = ({ draft }) => {
  const spec = useMemo(() => formDraftToAppSpec(draft), [draft]);
  const [pageId, setPageId] = useState(spec.tabs[0] || spec.pages[0]?.id || 'home');
  const cur = spec.pages.find((p) => p.id === pageId) || spec.pages[0];

  // 功能注释：草稿页变了时跟到首页，避免停在已删除的页 id
  React.useEffect(() => {
    if (!spec.pages.some((p) => p.id === pageId)) {
      setPageId(spec.pages[0]?.id || 'home');
    }
  }, [spec, pageId]);

  return (
    <section className={styles.card} data-phone-app-live-preview="1" aria-label="应用实时预览">
      <h2 className={styles.cardTitle}>实时预览</h2>
      <p className={styles.hint}>对话写入草稿后自动跟上；可点底部页签切换。这是可运行积木预览，不是截图位。</p>
      <div
        style={{
          margin: '0 auto',
          width: 'min(100%, 320px)',
          borderRadius: 24,
          border: '1px solid rgba(0,0,0,0.12)',
          overflow: 'hidden',
          background: '#f6f7f9',
          minHeight: 420,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            background: spec.color || '#7cc8a6',
            color: '#fff',
            padding: '12px 14px',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {cur?.name || spec.name}
        </header>
        <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
          {!cur?.blocks?.length ? (
            <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginTop: 48 }}>
              还没有页面内容，先发一句对话
            </p>
          ) : (
            cur.blocks.map((b) => {
              if (b.type === 'list') {
                return (
                  <div key={b.id} style={{ marginBottom: 12 }}>
                    {b.title ? (
                      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{b.title}</p>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                      {(b.items || []).map((it, i) => (
                        <li key={`${b.id}-${i}`}>{it}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (b.type === 'button') {
                return (
                  <button
                    key={b.id}
                    type="button"
                    style={{
                      display: 'block',
                      width: '100%',
                      marginBottom: 8,
                      borderRadius: 12,
                      border: 'none',
                      background: spec.color || '#7cc8a6',
                      color: '#fff',
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {b.label || b.text || '按钮'}
                  </button>
                );
              }
              return (
                <p key={b.id} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10, color: '#222' }}>
                  {b.text || b.title || ''}
                </p>
              );
            })
          )}
        </div>
        {spec.tabs.length > 1 ? (
          <nav
            style={{
              display: 'flex',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
            }}
          >
            {spec.tabs.map((tid) => {
              const p = spec.pages.find((x) => x.id === tid);
              const on = tid === cur?.id;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => setPageId(tid)}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 11,
                    fontWeight: 700,
                    color: on ? spec.color || '#7cc8a6' : '#999',
                  }}
                >
                  {p?.name || tid}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>
    </section>
  );
};

export default PhoneAppLivePreview;
