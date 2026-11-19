import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';
import { avatarLibraryApi } from '../../api/galgame/avatarLibrary';
import {
  PLAYER_CARD_GENDERS,
  PLAYER_CARD_LIMITS,
  type PlayerCardGender,
  type PlayerCharacterCard,
  validatePlayerCharacterCardInput,
} from '../../lib/galgame/playerCharacterCard';
import { useAvatarTagOptions } from '../../hooks/useAvatarTagOptions';
import { refreshAuthUserPoints } from '../../lib/auth/refreshUserPoints';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import TrimmedTransparentImg from '../../components/TrimmedTransparentImg';
import {
  NPC_PROFILE_FIELD_GENERATION_COST,
  getImageUrl,
} from '../../utils/constants';
import { useImageBusinessPrice } from '../../hooks/useImageBusinessPrice';
import { MdCheck, MdAutoAwesome } from 'react-icons/md';
import {
  startWarehouseCardAvatarBackgroundGen,
  subscribeWarehouseCardAvatarGenBusy,
  subscribeWarehouseCardAvatarGenComplete,
  warehouseCardAvatarJobKey,
} from '../../lib/warehouse/warehouseCardAvatarBackgroundJob';
import { PERSONA_TAG_ALL, PERSONA_TAGS, genderLabel, personaTagLabel } from './warehouseNav';
import WarehouseCardAvatarField from './WarehouseCardAvatarField';
import WarehouseAvatarGenerateConfirm from './WarehouseAvatarGenerateConfirm';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';
import panel from './WarehousePanel.module.css';

type Draft = {
  name: string;
  gender: PlayerCardGender;
  persona: string;
  tagsText: string;
  isDefault: boolean;
  avatarUrl: string;
  ageGroup: string;
  backgroundType: string;
  avatarLocked: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  gender: 'other',
  persona: '',
  tagsText: '',
  isDefault: false,
  avatarUrl: '',
  ageGroup: 'adult',
  backgroundType: 'modern',
  avatarLocked: false,
});

/** 我的角色卡（NPC，cardKind=npc） */
const WarehouseCharacterCards: React.FC = () => {
  const { t } = useTranslation();
  const {
    estimatedPoints: warehouseCardPrice,
    priceUnavailable: warehouseCardPriceUnavailable,
    error: warehouseCardPriceError,
  } = useImageBusinessPrice('warehouse_card');
  const warehouseCardCost = warehouseCardPrice ?? 0;
  const token = useAuthStore((s) => s.user?.token);
  const { ageOptions, backgroundOptions } = useAvatarTagOptions(token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<(typeof PERSONA_TAGS)[number]>(PERSONA_TAG_ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarConfirmOpen, setAvatarConfirmOpen] = useState(false);
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [personaConfirmOpen, setPersonaConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formOpenRef = useRef(formOpen);
  const editingIdRef = useRef(editingId);
  formOpenRef.current = formOpen;
  editingIdRef.current = editingId;

  const avatarJobKey = useMemo(
    () => warehouseCardAvatarJobKey('npc', editingId),
    [editingId],
  );

  useEffect(() => {
    return subscribeWarehouseCardAvatarGenBusy(avatarJobKey, setGeneratingAvatar);
  }, [avatarJobKey]);

  useEffect(() => {
    return subscribeWarehouseCardAvatarGenComplete((result) => {
      if (result.cardKind !== 'npc') return;
      if (typeof result.remainingPoints === 'number') {
        updateUser({ points: result.remainingPoints });
      } else {
        void refreshAuthUserPoints();
      }
      toast.success(
        t('warehouse.cards.imageGenOk', {
          cost: result.pointsDeducted ?? warehouseCardCost,
        }),
      );
      if (result.cardId) {
        void loadRef.current?.();
      }
      const openKey = warehouseCardAvatarJobKey('npc', editingIdRef.current);
      if (formOpenRef.current && openKey === result.key) {
        setDraft((d) => ({ ...d, avatarUrl: result.avatarUrl, avatarLocked: true }));
      }
    });
  }, [updateUser, t, warehouseCardCost]);

  const loadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!formOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [formOpen]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await playerCharacterCardsApi.list(token, { kind: 'npc', q: query });
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.characters.loadFailed'));
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
      toast.error((e as Error)?.message || t('warehouse.characters.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, query, t]);

  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === PERSONA_TAG_ALL) return cards;
    return cards.filter((c) => (c.tags || []).some((t) => t === tag));
  }, [cards, tag]);

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const openEdit = (card: PlayerCharacterCard) => {
    setEditingId(card.id);
    setDraft({
      name: card.name,
      gender: card.gender,
      persona: card.persona || '',
      tagsText: (card.tags || []).join(','),
      isDefault: !!card.isDefault,
      avatarUrl: card.avatarUrl || '',
      ageGroup: card.ageGroup || 'adult',
      backgroundType: card.backgroundType || 'modern',
      avatarLocked: !!card.avatarLocked,
    });
    setFormOpen(true);
  };

  /** 功能注释：未锁定时按三维精确匹配头像库（私库 > 公库） */
  const tryAutoMatchAvatar = useCallback(async (next: Draft) => {
    if (!token || next.avatarLocked) return;
    if (next.gender !== 'male' && next.gender !== 'female') return;
    if (!next.ageGroup || !next.backgroundType) return;
    try {
      const res = await avatarLibraryApi.match(token, {
        gender: next.gender,
        ageGroup: next.ageGroup,
        backgroundType: next.backgroundType,
      });
      const url = res.data?.avatar?.imageUrl;
      if (res.success && url) {
        setDraft((d) => (d.avatarLocked ? d : { ...d, avatarUrl: url }));
      }
    } catch {
      /* 匹配失败静默，保留当前头像 */
    }
  }, [token]);

  const requestGenerateAvatar = async () => {
    if (!draft.name.trim()) {
      toast.error(t('warehouse.characters.needNameForAvatar'));
      return;
    }
    if (!token || generatingAvatar) return;
    const latestPoints = await refreshAuthUserPoints();
    if (warehouseCardPriceUnavailable || warehouseCardPrice == null) {
      toast.error(warehouseCardPriceError || 'Price unavailable');
      return;
    }
    if (typeof latestPoints === 'number' && latestPoints < warehouseCardCost) {
      toast.error(t('warehouse.cards.pointsInsufficient', { need: warehouseCardCost, current: latestPoints }));
      return;
    }
    setAvatarConfirmOpen(true);
  };

  const runGenerateAvatar = async (opts?: {
    avatarStyleId?: string;
    promptSupplement?: string;
  }) => {
    setAvatarConfirmOpen(false);
    if (!token || !draft.name.trim() || generatingAvatar) return;
    toast(t('warehouse.cards.imageGenBackground'));
    try {
      await startWarehouseCardAvatarBackgroundGen({
        token,
        payload: {
          name: draft.name.trim(),
          gender: draft.gender,
          persona: draft.persona.trim(),
          cardId: editingId || undefined,
          cardKind: 'npc',
          avatarStyle: opts?.avatarStyleId,
          promptSupplement: opts?.promptSupplement,
        },
      });
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.characters.avatarGenFailed'));
    }
  };

  const requestGeneratePersona = async () => {
    if (!draft.name.trim()) {
      toast.error(t('warehouse.characters.needNameForPersona'));
      return;
    }
    if (!token || generatingPersona || saving) return;
    const latestPoints = await refreshAuthUserPoints();
    if (
      typeof latestPoints === 'number'
      && latestPoints < NPC_PROFILE_FIELD_GENERATION_COST
    ) {
      toast.error(
        t('warehouse.cards.pointsInsufficient', {
          need: NPC_PROFILE_FIELD_GENERATION_COST,
          current: latestPoints,
        }),
      );
      return;
    }
    setPersonaConfirmOpen(true);
  };

  const runGeneratePersona = async () => {
    setPersonaConfirmOpen(false);
    if (!token || !draft.name.trim() || generatingPersona) return;
    setGeneratingPersona(true);
    try {
      const res = await playerCharacterCardsApi.generatePersona(token, {
        name: draft.name.trim(),
        gender: draft.gender,
        existingPersona: draft.persona.trim(),
        tags: draft.tagsText.trim(),
        cardKind: 'npc',
      });
      if (!res?.success || !res.data?.text) {
        toast.error(res?.message || t('warehouse.characters.personaGenFailed'));
        return;
      }
      setDraft((d) => ({
        ...d,
        persona: String(res.data!.text).slice(0, PLAYER_CARD_LIMITS.persona.max),
      }));
      await refreshAuthUserPoints();
      toast.success(
        t('warehouse.characters.personaGenOk', {
          cost: res.data.pointsDeducted ?? NPC_PROFILE_FIELD_GENERATION_COST,
        }),
      );
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.characters.personaGenFailed'));
    } finally {
      setGeneratingPersona(false);
    }
  };

  const saveForm = async () => {
    if (!token) {
      toast.error(t('warehouse.cards.loginRequired'));
      return;
    }
    const checked = validatePlayerCharacterCardInput({
      name: draft.name,
      gender: draft.gender,
      persona: draft.persona,
      attributes: {},
    });
    if (!checked.ok) {
      toast.error(checked.message || t('warehouse.cards.formInvalid'));
      return;
    }
    const tags = draft.tagsText
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const body = {
      ...checked.data,
      cardKind: 'npc',
      tags,
      isDefault: draft.isDefault,
      avatarUrl: draft.avatarUrl || '',
      ageGroup: draft.ageGroup || '',
      backgroundType: draft.backgroundType || '',
      avatarLocked: draft.avatarLocked,
    };
    setSaving(true);
    try {
      const res = editingId
        ? await playerCharacterCardsApi.update(token, editingId, body)
        : await playerCharacterCardsApi.create(token, body);
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.cards.saveFailed'));
        return;
      }
      toast.success(editingId ? t('warehouse.characters.updatedOk') : t('warehouse.characters.createdOk'));
      setFormOpen(false);
      await load();
      if (res.data?.id) setSelectedId(String(res.data.id));
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.cards.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (card: PlayerCharacterCard) => {
    if (!token) return;
    const res = await playerCharacterCardsApi.setDefault(token, card.id);
    if (!res?.success) {
      toast.error(res?.message || t('warehouse.cards.setFailed'));
      return;
    }
    toast.success(t('warehouse.characters.setDefaultOk'));
    await load();
  };

  const publish = async (card: PlayerCharacterCard, nextPublic: boolean) => {
    if (!token) return;
    const res = await playerCharacterCardsApi.publish(token, card.id, nextPublic);
    if (!res?.success) {
      toast.error(res?.message || t('warehouse.cards.operationFailed'));
      return;
    }
    toast.success(nextPublic ? t('warehouse.cards.publishOk') : t('warehouse.cards.unpublishOk'));
    await load();
  };

  const exportCard = (card: PlayerCharacterCard) => {
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character-${card.name || card.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('warehouse.cards.exportJsonOk'));
  };

  const importFile = async (file: File) => {
    if (!token) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const checked = validatePlayerCharacterCardInput(json);
      if (!checked.ok) {
        toast.error(checked.message || t('warehouse.cards.importInvalid'));
        return;
      }
      const res = await playerCharacterCardsApi.create(token, {
        ...checked.data,
        cardKind: 'npc',
        tags: Array.isArray(json.tags) ? json.tags : [],
        avatarUrl: json.avatarUrl || '',
      });
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.cards.importFailed'));
        return;
      }
      toast.success(t('warehouse.characters.importOk'));
      await load();
    } catch {
      toast.error(t('warehouse.cards.importParseFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    const res = await playerCharacterCardsApi.remove(token, deleteId);
    if (!res?.success) {
      toast.error(res?.message || t('warehouse.cards.deleteFailed'));
      return;
    }
    toast.success(t('warehouse.cards.deleted'));
    setDeleteId(null);
    await load();
  };

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>{t('warehouse.characters.title')}</h1>
        <p className={panel.sub}>{t('warehouse.characters.sub')}</p>
      </header>

      <div className={panel.toolbar}>
        <input
          className={panel.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('warehouse.characters.searchPlaceholder')}
        />
        <button type="button" className={panel.ghostBtn} onClick={() => fileRef.current?.click()}>
          {t('warehouse.cards.importJson')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
        <button type="button" className={panel.primaryBtn} onClick={openCreate}>
          + {t('warehouse.characters.newCard')}
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
          <WarehouseEmptyIcon kind="character" />
          <h2>{t('warehouse.characters.emptyTitle')}</h2>
          <p>{t('warehouse.characters.emptyHint')}</p>
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
                      <TrimmedTransparentImg className={panel.portraitImg} src={avatar} variant="bust" />
                    ) : (
                      <div className={panel.portraitFallback}>
                        {(card.name || '?').slice(0, 1)}
                      </div>
                    )}
                    {card.isDefault ? <span className={panel.portraitBadge}>{t('warehouse.cards.defaultBadge')}</span> : null}
                    {active ? <span className={panel.checkMark}>✓</span> : null}
                  </div>
                  <div className={panel.cardBody}>
                    <div className={panel.cardTop}>
                      <h3 className={panel.cardName}>{card.name}</h3>
                      {card.isPublic ? <span className={panel.badge}>{t('warehouse.cards.publicBadge')}</span> : null}
                    </div>
                    <p className={panel.cardMeta}>{genderLabel(card.gender, t)}</p>
                    {(card.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(card.tags || []).slice(0, 3).map((tg) => (
                          <span key={tg} className={panel.chip}>{personaTagLabel(tg, t)}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{card.persona || t('warehouse.characters.noPersona')}</p>
                    <div className={panel.cardActions}>
                      <button
                        type="button"
                        className={panel.actionPrimary}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(card);
                        }}
                      >
                        {t('warehouse.cards.edit')}
                      </button>
                      {!card.isDefault ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void setAsDefault(card);
                          }}
                        >
                          {t('warehouse.cards.setDefault')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={panel.preview}>
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
                  <p className={panel.previewTitle}>{t('warehouse.characters.previewTitle')}</p>
                  <h3 className={panel.previewName}>{selected.name}</h3>
                  <p className={panel.previewRow}><strong>{t('warehouse.cards.labelGender')}</strong>{genderLabel(selected.gender, t)}</p>
                  <p className={panel.previewRow}><strong>{t('warehouse.characters.previewPersonaLabel')}</strong>{selected.persona || '—'}</p>
                  <p className={panel.previewRow}>
                    <strong>{t('warehouse.cards.labelTags')}</strong>
                    {(selected.tags || []).join('、') || '—'}
                  </p>
                  <div className={panel.previewActions}>
                    <button type="button" className={panel.primaryBtn} onClick={() => openEdit(selected)}>
                      {t('warehouse.characters.editCard')}
                    </button>
                    <button
                      type="button"
                      className={panel.ghostBtn}
                      onClick={() => toast(t('warehouse.characters.dmToast'))}
                    >
                      {t('warehouse.characters.dmHint')}
                    </button>
                    <button type="button" className={panel.ghostBtn} onClick={() => exportCard(selected)}>
                      {t('warehouse.cards.export')}
                    </button>
                    <button
                      type="button"
                      className={panel.ghostBtn}
                      onClick={() => void publish(selected, !selected.isPublic)}
                    >
                      {selected.isPublic ? t('warehouse.cards.unpublish') : t('warehouse.cards.publishPublic')}
                    </button>
                    <button
                      type="button"
                      className={panel.dangerBtn}
                      onClick={() => setDeleteId(selected.id)}
                    >
                      {t('warehouse.cards.delete')}
                    </button>
                  </div>
                  <p className={panel.previewTip}>
                    {t('warehouse.characters.previewTip')}
                  </p>
                </div>
              </>
            ) : (
              <div className={panel.previewInner}>
                <p className={panel.empty}>{t('warehouse.cards.selectCardHint')}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {formOpen
        ? createPortal(
          <div className={panel.formOverlay} onClick={() => !saving && setFormOpen(false)}>
            <div
              className={panel.formCard}
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? t('warehouse.characters.formEditTitle') : t('warehouse.characters.newCard')}
              onClick={(e) => e.stopPropagation()}
            >
              <aside className={panel.formPreview}>
                <p className={panel.formPreviewEyebrow}>CHARACTER SLIP</p>
                <div className={panel.formPreviewPortrait}>
                  {draft.avatarUrl ? (
                    <TrimmedTransparentImg
                      className={panel.formPreviewPortraitImg}
                      src={getImageUrl(draft.avatarUrl)}
                      variant="full"
                    />
                  ) : (
                    <div className={panel.formPreviewPortraitFallback} aria-hidden>
                      {(draft.name || t('warehouse.cards.avatarFallbackNpc')).slice(0, 1)}
                    </div>
                  )}
                </div>
                <h4 className={panel.formPreviewName}>
                  {draft.name.trim() || t('warehouse.characters.unnamedCharacter')}
                </h4>
                <p className={panel.formPreviewMeta}>
                  {genderLabel(draft.gender, t)}
                  {draft.isDefault ? t('warehouse.forms.defaultCardSuffix') : ''}
                  <br />
                  {(draft.persona || t('warehouse.characters.form.previewHint')).slice(0, 72)}
                  {draft.persona.length > 72 ? '…' : ''}
                </p>
                <div className={panel.formPreviewChips}>
                  {draft.tagsText
                    .split(/[,，]/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((t) => (
                      <span key={t} className={panel.formPreviewChip}>{t}</span>
                    ))}
                </div>
              </aside>

              <div className={panel.formBody}>
                <div className={panel.formBodyHead}>
                  <h3>
                    {editingId ? t('warehouse.characters.formEditTitle') : t('warehouse.characters.newCard')}
                  </h3>
                  <button
                    type="button"
                    className={panel.formClose}
                    aria-label={t('warehouse.cards.close')}
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <WarehouseCardAvatarField
                  name={draft.name}
                  avatarUrl={draft.avatarUrl}
                  generating={generatingAvatar}
                  disabled={saving}
                  fallbackChar={t('warehouse.cards.avatarFallbackNpc')}
                  cardId={editingId}
                  onGenerate={() => void requestGenerateAvatar()}
                  onAvatarUrl={(url) => setDraft((d) => ({ ...d, avatarUrl: url, avatarLocked: true }))}
                >
                  <div className={panel.field}>
                    <label htmlFor="wh-npc-name">{t('warehouse.forms.labelName')}</label>
                    <input
                      id="wh-npc-name"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={40}
                      placeholder={t('warehouse.characters.form.namePlaceholder')}
                      autoFocus
                    />
                  </div>

                  <div className={panel.field}>
                    <span id="wh-npc-gender-label">{t('warehouse.cards.labelGender')}</span>
                    <div className={panel.segRow} role="radiogroup" aria-labelledby="wh-npc-gender-label">
                      {PLAYER_CARD_GENDERS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          role="radio"
                          aria-checked={draft.gender === g}
                          className={draft.gender === g ? panel.segActive : panel.seg}
                          onClick={() => {
                            const next = { ...draft, gender: g };
                            setDraft(next);
                            void tryAutoMatchAvatar(next);
                          }}
                        >
                          {draft.gender === g ? (
                            <MdCheck className={panel.segActiveIcon} aria-hidden />
                          ) : null}
                          {genderLabel(g, t)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={panel.field}>
                    <label htmlFor="wh-npc-age">{t('warehouse.forms.labelAgeGroup')}</label>
                    <select
                      id="wh-npc-age"
                      value={draft.ageGroup}
                      onChange={(e) => {
                        const next = { ...draft, ageGroup: e.target.value };
                        setDraft(next);
                        void tryAutoMatchAvatar(next);
                      }}
                    >
                      {ageOptions.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className={panel.field}>
                    <label htmlFor="wh-npc-bg">{t('warehouse.forms.labelBackground')}</label>
                    <select
                      id="wh-npc-bg"
                      value={draft.backgroundType}
                      onChange={(e) => {
                        const next = { ...draft, backgroundType: e.target.value };
                        setDraft(next);
                        void tryAutoMatchAvatar(next);
                      }}
                    >
                      {backgroundOptions.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  {draft.avatarLocked ? (
                    <p className={panel.sub} style={{ margin: 0 }}>{t('warehouse.forms.avatarLockedHint')}</p>
                  ) : null}
                </WarehouseCardAvatarField>

                <div className={panel.field}>
                  <div className={panel.labelWithAi}>
                    <label htmlFor="wh-npc-text">{t('warehouse.characters.form.personaLabel')}</label>
                    <button
                      type="button"
                      className={panel.fieldAiBtn}
                      disabled={saving || generatingPersona}
                      onClick={() => void requestGeneratePersona()}
                    >
                      {!generatingPersona ? (
                        <MdAutoAwesome className={panel.fieldAiBtnIcon} aria-hidden />
                      ) : null}
                      {generatingPersona
                        ? t('warehouse.forms.aiGenerating')
                        : t('warehouse.forms.aiGenerateCost', { cost: NPC_PROFILE_FIELD_GENERATION_COST })}
                    </button>
                  </div>
                  <textarea
                    id="wh-npc-text"
                    value={draft.persona}
                    onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
                    maxLength={PLAYER_CARD_LIMITS.persona.max}
                    placeholder={t('warehouse.characters.form.personaPlaceholder')}
                    disabled={generatingPersona}
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-npc-tags">{t('warehouse.cards.labelTags')}</label>
                  <input
                    id="wh-npc-tags"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
                    placeholder={t('warehouse.characters.form.tagsPlaceholder')}
                  />
                </div>

                <label className={panel.checkRow}>
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                  />
                  {t('warehouse.characters.form.setDefaultCheckbox')}
                </label>

                <div className={panel.formActions}>
                  <button
                    type="button"
                    className={panel.ghostBtn}
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    {t('warehouse.cards.cancel')}
                  </button>
                  <button
                    type="button"
                    className={panel.primaryBtn}
                    disabled={saving}
                    onClick={() => void saveForm()}
                  >
                    {saving ? t('warehouse.cards.saving') : t('warehouse.characters.form.saveCharacter')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      <WarehouseAvatarGenerateConfirm
        isOpen={avatarConfirmOpen}
        cost={warehouseCardCost}
        title={t('warehouse.avatars.generateTitle')}
        subjectLabel={t('warehouse.avatars.generateSubjectCharacter')}
        onCancel={() => setAvatarConfirmOpen(false)}
        onConfirm={(result) => void runGenerateAvatar(result)}
      />

      <ConfirmModal
        isOpen={personaConfirmOpen}
        onCancel={() => setPersonaConfirmOpen(false)}
        onConfirm={() => void runGeneratePersona()}
        title={t('warehouse.characters.form.confirmGenerateTitle')}
        message={t('warehouse.characters.form.confirmGenerateMessage', {
          cost: NPC_PROFILE_FIELD_GENERATION_COST,
        })}
        confirmButtonText={t('warehouse.characters.form.confirmGenerate')}
        cancelButtonText={t('warehouse.cards.cancel')}
      />

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title={t('warehouse.characters.deleteTitle')}
        message={t('warehouse.cards.deleteConfirm')}
        confirmButtonText={t('warehouse.cards.delete')}
        cancelButtonText={t('warehouse.cards.cancel')}
      />
    </div>
  );
};

export default WarehouseCharacterCards;
