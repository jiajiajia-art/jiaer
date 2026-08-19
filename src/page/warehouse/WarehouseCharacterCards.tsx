import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';
import {
  PLAYER_CARD_GENDERS,
  PLAYER_CARD_LIMITS,
  type PlayerCardGender,
  type PlayerCharacterCard,
  validatePlayerCharacterCardInput,
} from '../../lib/galgame/playerCharacterCard';
import { refreshAuthUserPoints } from '../../lib/auth/refreshUserPoints';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import TrimmedTransparentImg from '../../components/TrimmedTransparentImg';
import {
  CHARACTER_GENERATION_COST,
  NPC_PROFILE_FIELD_GENERATION_COST,
  getImageUrl,
} from '../../utils/constants';
import {
  startWarehouseCardAvatarBackgroundGen,
  subscribeWarehouseCardAvatarGenBusy,
  subscribeWarehouseCardAvatarGenComplete,
  warehouseCardAvatarJobKey,
} from '../../lib/warehouse/warehouseCardAvatarBackgroundJob';
import { PERSONA_TAGS, genderLabel } from './warehouseNav';
import WarehouseCardAvatarField from './WarehouseCardAvatarField';
import panel from './WarehousePanel.module.css';

type Draft = {
  name: string;
  gender: PlayerCardGender;
  persona: string;
  tagsText: string;
  isDefault: boolean;
  avatarUrl: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  gender: 'other',
  persona: '',
  tagsText: '',
  isDefault: false,
  avatarUrl: '',
});

/** 我的角色卡（NPC，cardKind=npc） */
const WarehouseCharacterCards: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
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
        `图像已生成（-${result.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`,
      );
      if (result.cardId) {
        void loadRef.current?.();
      }
      const openKey = warehouseCardAvatarJobKey('npc', editingIdRef.current);
      if (formOpenRef.current && openKey === result.key) {
        setDraft((d) => ({ ...d, avatarUrl: result.avatarUrl }));
      }
    });
  }, [updateUser]);

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
        toast.error(res?.message || '加载角色卡失败');
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
      toast.error((e as Error)?.message || '加载角色卡失败');
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === '全部') return cards;
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
    });
    setFormOpen(true);
  };

  const requestGenerateAvatar = async () => {
    if (!draft.name.trim()) {
      toast.error('请先填写姓名再生成图像');
      return;
    }
    if (!token || generatingAvatar) return;
    const latestPoints = await refreshAuthUserPoints();
    if (typeof latestPoints === 'number' && latestPoints < CHARACTER_GENERATION_COST) {
      toast.error(`积分不足（需要 ${CHARACTER_GENERATION_COST}，当前 ${latestPoints}）`);
      return;
    }
    setAvatarConfirmOpen(true);
  };

  const runGenerateAvatar = async () => {
    setAvatarConfirmOpen(false);
    if (!token || !draft.name.trim() || generatingAvatar) return;
    toast('图像后台生成中，可继续编辑或保存');
    try {
      await startWarehouseCardAvatarBackgroundGen({
        token,
        payload: {
          name: draft.name.trim(),
          gender: draft.gender,
          persona: draft.persona.trim(),
          cardId: editingId || undefined,
          cardKind: 'npc',
        },
      });
    } catch (e) {
      toast.error((e as Error)?.message || '生成图像失败');
    }
  };

  const requestGeneratePersona = async () => {
    if (!draft.name.trim()) {
      toast.error('请先填写姓名再生成');
      return;
    }
    if (!token || generatingPersona || saving) return;
    const latestPoints = await refreshAuthUserPoints();
    if (
      typeof latestPoints === 'number'
      && latestPoints < NPC_PROFILE_FIELD_GENERATION_COST
    ) {
      toast.error(
        `积分不足（需要 ${NPC_PROFILE_FIELD_GENERATION_COST}，当前 ${latestPoints}）`,
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
        toast.error(res?.message || '角色设定生成失败');
        return;
      }
      setDraft((d) => ({
        ...d,
        persona: String(res.data!.text).slice(0, PLAYER_CARD_LIMITS.persona.max),
      }));
      await refreshAuthUserPoints();
      toast.success(
        `角色设定已生成（-${res.data.pointsDeducted ?? NPC_PROFILE_FIELD_GENERATION_COST} 积分）`,
      );
    } catch (e) {
      toast.error((e as Error)?.message || '角色设定生成失败');
    } finally {
      setGeneratingPersona(false);
    }
  };

  const saveForm = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    const checked = validatePlayerCharacterCardInput({
      name: draft.name,
      gender: draft.gender,
      persona: draft.persona,
      attributes: {},
    });
    if (!checked.ok) {
      toast.error(checked.message || '表单无效');
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
    };
    setSaving(true);
    try {
      const res = editingId
        ? await playerCharacterCardsApi.update(token, editingId, body)
        : await playerCharacterCardsApi.create(token, body);
      if (!res?.success) {
        toast.error(res?.message || '保存失败');
        return;
      }
      toast.success(editingId ? '已更新角色卡' : '已创建角色卡');
      setFormOpen(false);
      await load();
      if (res.data?.id) setSelectedId(String(res.data.id));
    } catch (e) {
      toast.error((e as Error)?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (card: PlayerCharacterCard) => {
    if (!token) return;
    const res = await playerCharacterCardsApi.setDefault(token, card.id);
    if (!res?.success) {
      toast.error(res?.message || '设置失败');
      return;
    }
    toast.success('已设为默认角色卡');
    await load();
  };

  const publish = async (card: PlayerCharacterCard, nextPublic: boolean) => {
    if (!token) return;
    const res = await playerCharacterCardsApi.publish(token, card.id, nextPublic);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(nextPublic ? '已发布到公共卡库' : '已取消公开');
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
    toast.success('已导出 JSON');
  };

  const importFile = async (file: File) => {
    if (!token) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const checked = validatePlayerCharacterCardInput(json);
      if (!checked.ok) {
        toast.error(checked.message || '导入文件无效');
        return;
      }
      const res = await playerCharacterCardsApi.create(token, {
        ...checked.data,
        cardKind: 'npc',
        tags: Array.isArray(json.tags) ? json.tags : [],
        avatarUrl: json.avatarUrl || '',
      });
      if (!res?.success) {
        toast.error(res?.message || '导入失败');
        return;
      }
      toast.success('已导入角色卡');
      await load();
    } catch {
      toast.error('无法解析导入文件');
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    const res = await playerCharacterCardsApi.remove(token, deleteId);
    if (!res?.success) {
      toast.error(res?.message || '删除失败');
      return;
    }
    toast.success('已删除');
    setDeleteId(null);
    await load();
  };

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>我的角色卡</h1>
        <p className={panel.sub}>管理 NPC 角色卡，可导入导出，并发布到公共卡库</p>
      </header>

      <div className={panel.toolbar}>
        <input
          className={panel.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索角色名 / 设定"
        />
        <button type="button" className={panel.ghostBtn} onClick={() => fileRef.current?.click()}>
          导入 JSON
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
          + 新建角色卡
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
          <h2>还没有角色卡</h2>
          <p>新建或导入一张 NPC 卡，带到不同故事里使用</p>
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
                    {card.isDefault ? <span className={panel.portraitBadge}>默认</span> : null}
                    {active ? <span className={panel.checkMark}>✓</span> : null}
                  </div>
                  <div className={panel.cardBody}>
                    <div className={panel.cardTop}>
                      <h3 className={panel.cardName}>{card.name}</h3>
                      {card.isPublic ? <span className={panel.badge}>已公开</span> : null}
                    </div>
                    <p className={panel.cardMeta}>{genderLabel(card.gender)}</p>
                    {(card.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(card.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className={panel.chip}>{t}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{card.persona || '暂无角色设定'}</p>
                    <div className={panel.cardActions}>
                      <button
                        type="button"
                        className={panel.actionPrimary}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(card);
                        }}
                      >
                        编辑
                      </button>
                      {!card.isDefault ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void setAsDefault(card);
                          }}
                        >
                          设为默认
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
                  <p className={panel.previewTitle}>当前角色预览</p>
                  <h3 className={panel.previewName}>{selected.name}</h3>
                  <p className={panel.previewRow}><strong>性别</strong>{genderLabel(selected.gender)}</p>
                  <p className={panel.previewRow}><strong>角色设定</strong>{selected.persona || '—'}</p>
                  <p className={panel.previewRow}>
                    <strong>标签</strong>
                    {(selected.tags || []).join('、') || '—'}
                  </p>
                  <div className={panel.previewActions}>
                    <button type="button" className={panel.primaryBtn} onClick={() => openEdit(selected)}>
                      编辑角色
                    </button>
                    <button
                      type="button"
                      className={panel.ghostBtn}
                      onClick={() => toast('请在对局内打开该角色的私聊面板')}
                    >
                      私聊说明
                    </button>
                    <button type="button" className={panel.ghostBtn} onClick={() => exportCard(selected)}>
                      导出
                    </button>
                    <button
                      type="button"
                      className={panel.ghostBtn}
                      onClick={() => void publish(selected, !selected.isPublic)}
                    >
                      {selected.isPublic ? '取消公开' : '发布到公共卡库'}
                    </button>
                    <button
                      type="button"
                      className={panel.dangerBtn}
                      onClick={() => setDeleteId(selected.id)}
                    >
                      删除
                    </button>
                  </div>
                  <p className={panel.previewTip}>
                    角色卡用于 NPC；私聊需在具体对局会话中进行。开局可从仓库选用角色设定。
                  </p>
                </div>
              </>
            ) : (
              <div className={panel.previewInner}>
                <p className={panel.empty}>选择一张卡查看详情</p>
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
              aria-label={editingId ? '编辑角色卡' : '新建角色卡'}
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
                      {(draft.name || '角').slice(0, 1)}
                    </div>
                  )}
                </div>
                <h4 className={panel.formPreviewName}>{draft.name.trim() || '未命名角色'}</h4>
                <p className={panel.formPreviewMeta}>
                  {genderLabel(draft.gender)}
                  {draft.isDefault ? ' · 默认卡' : ''}
                  <br />
                  {(draft.persona || '在右侧写下角色设定…').slice(0, 72)}
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
                  <h3>{editingId ? '编辑角色卡' : '新建角色卡'}</h3>
                  <button
                    type="button"
                    className={panel.formClose}
                    aria-label="关闭"
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
                  fallbackChar="角"
                  cardId={editingId}
                  onGenerate={() => void requestGenerateAvatar()}
                  onAvatarUrl={(url) => setDraft((d) => ({ ...d, avatarUrl: url }))}
                >
                  <div className={panel.field}>
                    <label htmlFor="wh-npc-name">姓名</label>
                    <input
                      id="wh-npc-name"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={40}
                      placeholder="角色名字"
                      autoFocus
                    />
                  </div>

                  <div className={panel.field}>
                    <span id="wh-npc-gender-label">性别</span>
                    <div className={panel.segRow} role="radiogroup" aria-labelledby="wh-npc-gender-label">
                      {PLAYER_CARD_GENDERS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          role="radio"
                          aria-checked={draft.gender === g}
                          className={draft.gender === g ? panel.segActive : panel.seg}
                          onClick={() => setDraft((d) => ({ ...d, gender: g }))}
                        >
                          {genderLabel(g)}
                        </button>
                      ))}
                    </div>
                  </div>
                </WarehouseCardAvatarField>

                <div className={panel.field}>
                  <div className={panel.labelWithAi}>
                    <label htmlFor="wh-npc-text">角色设定</label>
                    <button
                      type="button"
                      className={panel.fieldAiBtn}
                      disabled={saving || generatingPersona}
                      onClick={() => void requestGeneratePersona()}
                    >
                      {generatingPersona
                        ? '生成中…'
                        : `AI生成 · ${NPC_PROFILE_FIELD_GENERATION_COST}`}
                    </button>
                  </div>
                  <textarea
                    id="wh-npc-text"
                    value={draft.persona}
                    onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
                    maxLength={PLAYER_CARD_LIMITS.persona.max}
                    placeholder="性格、口吻、与玩家的关系…越具体越好"
                    disabled={generatingPersona}
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-npc-tags">标签</label>
                  <input
                    id="wh-npc-tags"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
                    placeholder="奇幻, 恋爱（逗号分隔）"
                  />
                </div>

                <label className={panel.checkRow}>
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                  />
                  设为默认角色卡
                </label>

                <div className={panel.formActions}>
                  <button
                    type="button"
                    className={panel.ghostBtn}
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className={panel.primaryBtn}
                    disabled={saving}
                    onClick={() => void saveForm()}
                  >
                    {saving ? '保存中…' : '保存角色卡'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      <ConfirmModal
        isOpen={avatarConfirmOpen}
        onCancel={() => setAvatarConfirmOpen(false)}
        onConfirm={() => void runGenerateAvatar()}
        title="确认生成图像"
        message={`将扣除 ${CHARACTER_GENERATION_COST} 积分生成角色立绘，是否继续？`}
        confirmButtonText="生成"
        cancelButtonText="取消"
      />

      <ConfirmModal
        isOpen={personaConfirmOpen}
        onCancel={() => setPersonaConfirmOpen(false)}
        onConfirm={() => void runGeneratePersona()}
        title="确认生成角色设定"
        message={`将扣除 ${NPC_PROFILE_FIELD_GENERATION_COST} 积分生成「角色设定」，是否继续？`}
        confirmButtonText="生成"
        cancelButtonText="取消"
      />

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title="删除角色卡"
        message="删除后不可恢复，确认删除吗？"
        confirmButtonText="删除"
        cancelButtonText="取消"
      />
    </div>
  );
};

export default WarehouseCharacterCards;
