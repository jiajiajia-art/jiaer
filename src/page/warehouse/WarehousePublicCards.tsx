import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';
import type { PlayerCharacterCard } from '../../lib/galgame/playerCharacterCard';
import { getImageUrl } from '../../utils/constants';
import TrimmedTransparentImg from '../../components/TrimmedTransparentImg';
import { PERSONA_TAG_ALL, PERSONA_TAGS, genderLabel, personaTagLabel } from './warehouseNav';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';
import panel from './WarehousePanel.module.css';

type CardKindTab = 'player' | 'npc';

const WarehousePublicCards: React.FC = () => {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.user?.token);
  const navigate = useNavigate();
  const [kind, setKind] = useState<CardKindTab>('player');
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<(typeof PERSONA_TAGS)[number]>(PERSONA_TAG_ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const kindLabel = kind === 'npc' ? t('warehouse.publicCards.kindCharacter') : t('warehouse.publicCards.kindPersona');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await playerCharacterCardsApi.listPublic(token, {
        q: query,
        kind,
      });
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.publicCards.loadFailed'));
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
      toast.error((e as Error)?.message || t('warehouse.publicCards.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, query, kind, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === PERSONA_TAG_ALL) return cards;
    return cards.filter((c) => (c.tags || []).some((tg) => tg === tag));
  }, [cards, tag]);

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const minePath = kind === 'npc' ? '/warehouse/characters' : '/warehouse/persona';

  const importCard = async (card: PlayerCharacterCard) => {
    if (!token) {
      toast.error(t('warehouse.publicCards.loginRequired'));
      return;
    }
    setImporting(true);
    try {
      const res = await playerCharacterCardsApi.importFromPublic(token, card.id);
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.publicCards.importFailed'));
        return;
      }
      toast.success(t('warehouse.publicCards.importOk', { kind: kindLabel }));
      navigate(minePath);
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.publicCards.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>{t('warehouse.publicCards.title')}</h1>
        <p className={panel.sub}>{t('warehouse.publicCards.sub')}</p>
      </header>

      <div className={panel.toolbar}>
        <input
          className={panel.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('warehouse.publicCards.searchPlaceholder')}
        />
        <div className={panel.segRow} role="group" aria-label={t('warehouse.publicCards.kindAria')}>
          <button
            type="button"
            className={kind === 'player' ? panel.segActive : panel.seg}
            onClick={() => setKind('player')}
          >
            {t('warehouse.publicCards.kindPersona')}
          </button>
          <button
            type="button"
            className={kind === 'npc' ? panel.segActive : panel.seg}
            onClick={() => setKind('npc')}
          >
            {t('warehouse.publicCards.kindCharacter')}
          </button>
        </div>
        <button
          type="button"
          className={panel.primaryBtn}
          onClick={() => navigate(minePath)}
        >
          {t('warehouse.publicCards.goPublish', { kind: kindLabel })}
        </button>
      </div>

      <div className={panel.tags}>
        {PERSONA_TAGS.map((tg) => (
          <button
            key={tg}
            type="button"
            className={tag === tg ? panel.tagActive : panel.tag}
            onClick={() => setTag(tg)}
          >
            {personaTagLabel(tg, t)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={panel.empty}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className={panel.emptyStage}>
          <WarehouseEmptyIcon kind={kind === 'npc' ? 'character' : 'persona'} />
          <h2>{t('warehouse.publicCards.emptyTitle')}</h2>
          <p>{t('warehouse.publicCards.emptyHint', { kind: kindLabel })}</p>
        </div>
      ) : (
        <div className={panel.layout}>
          <div className={panel.grid}>
            {filtered.map((card) => {
              const avatar = card.avatarUrl ? getImageUrl(card.avatarUrl) : '';
              const active = selected?.id === card.id;
              const author = card.authorName || t('warehouse.publicCards.anonymous');
              return (
                <article
                  key={card.id}
                  className={active ? panel.cardActive : panel.card}
                  onClick={() => setSelectedId(card.id)}
                >
                  <div className={panel.portrait}>
                    {avatar ? (
                      <TrimmedTransparentImg className={panel.portraitImg} src={avatar} variant="bust" />
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
                      {t('warehouse.publicCards.byAuthor', {
                        author: `by ${author}`,
                        gender: genderLabel(card.gender, t),
                      })}
                    </p>
                    {(card.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(card.tags || []).slice(0, 3).map((tg) => (
                          <span key={tg} className={panel.chip}>{personaTagLabel(tg, t)}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{card.persona || t('warehouse.publicCards.noBio')}</p>
                    <div className={panel.cardActions}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(card.id);
                        }}
                      >
                        {t('warehouse.publicCards.detail')}
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
                        {t('warehouse.publicCards.importMine')}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={panel.preview}>
            <div className={panel.previewInner}>
              <h3 className={panel.previewTitle}>{t('warehouse.publicCards.exportHintTitle')}</h3>
              <p className={panel.previewRow}>
                <Trans
                  i18nKey="warehouse.publicCards.exportHintBody"
                  values={{ kind: kindLabel }}
                  components={{ strong: <strong /> }}
                />
              </p>
            </div>
            {selected ? (
              <>
                <div className={panel.previewHero}>
                  {selected.avatarUrl ? (
                    <TrimmedTransparentImg
                      className={panel.previewHeroImg}
                      src={getImageUrl(selected.avatarUrl)}
                      variant="full"
                    />
                  ) : (
                    <div className={panel.previewHeroFallback}>
                      {(selected.name || '?').slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className={panel.previewInner}>
                  <h3 className={panel.previewName}>{selected.name}</h3>
                  <p className={panel.previewRow}>
                    <strong>{t('warehouse.publicCards.previewAuthor')}</strong>
                    {selected.authorName || t('warehouse.publicCards.anonymous')}
                  </p>
                  <p className={panel.previewRow}>
                    <strong>{t('warehouse.publicCards.previewPersona')}</strong>
                    {selected.persona || '—'}
                  </p>
                  <div className={panel.previewActions}>
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      disabled={importing}
                      onClick={() => void importCard(selected)}
                    >
                      {importing ? t('warehouse.publicCards.importing') : t('warehouse.publicCards.importToMine')}
                    </button>
                  </div>
                  <p className={panel.previewTip}>{t('warehouse.publicCards.hotTagsTip')}</p>
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
