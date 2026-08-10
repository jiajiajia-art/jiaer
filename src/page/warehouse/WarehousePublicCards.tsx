import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';
import type { PlayerCharacterCard } from '../../lib/galgame/playerCharacterCard';
import { getImageUrl } from '../../utils/constants';
import { PERSONA_TAGS, genderLabel } from './warehouseNav';
import panel from './WarehousePanel.module.css';

type CardKindTab = 'player' | 'npc';

const WarehousePublicCards: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token);
  const navigate = useNavigate();
  const [kind, setKind] = useState<CardKindTab>('player');
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await playerCharacterCardsApi.listPublic(token, {
        q: query,
        kind,
      });
      if (!res?.success) {
        toast.error(res?.message || '加载公共卡库失败');
        setCards([]);
        return;
      }
      const list = Array.isArray(res.data) ? (res.data as PlayerCharacterCard[]) : [];
      setCards(list);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (e) {
      toast.error((e as Error)?.message || '加载公共卡库失败');
    } finally {
      setLoading(false);
    }
  }, [token, query, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === '全部') return cards;
    return cards.filter((c) => (c.tags || []).some((t) => t === tag));
  }, [cards, tag]);

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const minePath = kind === 'npc' ? '/warehouse/characters' : '/warehouse/persona';
  const kindLabel = kind === 'npc' ? '角色卡' : '人设卡';

  const importCard = async (card: PlayerCharacterCard) => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    setImporting(true);
    try {
      const res = await playerCharacterCardsApi.importFromPublic(token, card.id);
      if (!res?.success) {
        toast.error(res?.message || '导入失败');
        return;
      }
      toast.success(`已导入到我的${kindLabel}（私人副本）`);
      navigate(minePath);
    } catch (e) {
      toast.error((e as Error)?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>公共卡库</h1>
        <p className={panel.sub}>浏览他人分享的人设卡 / 角色卡，导入后生成你的私人副本</p>
      </header>

      <div className={panel.toolbar}>
        <input
          className={panel.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索角色名 / 作者 / 标签"
        />
        <div className={panel.segRow} role="group" aria-label="卡类型">
          <button
            type="button"
            className={kind === 'player' ? panel.segActive : panel.seg}
            onClick={() => setKind('player')}
          >
            人设卡
          </button>
          <button
            type="button"
            className={kind === 'npc' ? panel.segActive : panel.seg}
            onClick={() => setKind('npc')}
          >
            角色卡
          </button>
        </div>
        <button
          type="button"
          className={panel.primaryBtn}
          onClick={() => navigate(minePath)}
        >
          去我的{kindLabel}发布
        </button>
      </div>

      <div className={panel.tags}>
        {PERSONA_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={tag === t ? panel.tagActive : panel.tag}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={panel.empty}>加载中…</p>
      ) : filtered.length === 0 ? (
        <div className={panel.emptyStage}>
          <div className={panel.emptyOrb} aria-hidden />
          <h2>公共卡库还是空的</h2>
          <p>去「我的{kindLabel}」发布你的第一张卡</p>
        </div>
      ) : (
        <div className={panel.layout}>
          <div className={panel.grid}>
            {filtered.map((card) => {
              const avatar = card.avatarUrl ? getImageUrl(card.avatarUrl) : '';
              const active = selected?.id === card.id;
              return (
                <article
                  key={card.id}
                  className={active ? panel.cardActive : panel.card}
                  onClick={() => setSelectedId(card.id)}
                >
                  <div className={panel.portrait}>
                    {avatar ? (
                      <img className={panel.portraitImg} src={avatar} alt="" />
                    ) : (
                      <div className={panel.portraitFallback}>
                        {(card.name || '?').slice(0, 1)}
                      </div>
                    )}
                    <span className={panel.portraitBadge}>{kindLabel}</span>
                    {active ? <span className={panel.checkMark}>✓</span> : null}
                  </div>
                  <div className={panel.cardBody}>
                    <div className={panel.cardTop}>
                      <h3 className={panel.cardName}>{card.name}</h3>
                    </div>
                    <p className={panel.cardMeta}>
                      by {card.authorName || '匿名'} · {genderLabel(card.gender)}
                    </p>
                    {(card.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(card.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className={panel.chip}>{t}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{card.persona || '暂无简介'}</p>
                    <div className={panel.cardActions}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(card.id);
                        }}
                      >
                        详情
                      </button>
                      <button
                        type="button"
                        className={panel.actionPrimary}
                        disabled={importing}
                        onClick={(e) => {
                          e.stopPropagation();
                          void importCard(card);
                        }}
                      >
                        导入到我的
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={panel.preview}>
            <div className={panel.previewInner}>
              <h3 className={panel.previewTitle}>导出说明</h3>
              <p className={panel.previewRow}>
                导入会生成<strong>私人副本</strong>到「我的{kindLabel}」，不会修改公共原卡；副本可编辑、可再次发布。
              </p>
            </div>
            {selected ? (
              <>
                <div className={panel.previewHero}>
                  {selected.avatarUrl ? (
                    <img
                      className={panel.previewHeroImg}
                      src={getImageUrl(selected.avatarUrl)}
                      alt=""
                    />
                  ) : (
                    <div className={panel.previewHeroFallback}>
                      {(selected.name || '?').slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className={panel.previewInner}>
                  <h3 className={panel.previewName}>{selected.name}</h3>
                  <p className={panel.previewRow}><strong>作者</strong>{selected.authorName || '匿名'}</p>
                  <p className={panel.previewRow}><strong>设定</strong>{selected.persona || '—'}</p>
                  <div className={panel.previewActions}>
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      disabled={importing}
                      onClick={() => void importCard(selected)}
                    >
                      {importing ? '导入中…' : '导入到我的卡库'}
                    </button>
                  </div>
                  <p className={panel.previewTip}>
                    热门标签可先用顶部筛选；导入后记得在「我的」里改成你的版本。
                  </p>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
};

export default WarehousePublicCards;
