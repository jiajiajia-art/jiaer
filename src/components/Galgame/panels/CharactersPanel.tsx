import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import CharacterProfileForm from './CharacterProfileForm';
import PrivateChatPanel from './PrivateChatPanel';
import {
  buildCharacterPanelItems,
  type CharacterPanelItem,
  type NpcProfileLike,
  type PlayerProfileLike,
} from '../../../lib/galgame/encounteredCharacters';
import {
  createPlayerNpcProfile,
  mergeCharacterProfilePatch,
  npcLikeToEditableProfile,
  sortEditableNpcProfiles,
  type PlayerEditableNpc,
} from '../../../lib/galgame/characterProfile';
import {
  filterPlayerCharacterCards,
  type PlayerCharacterCard,
} from '../../../lib/galgame/playerCharacterCard';
import { getImageUrl } from '../../../utils/constants';
import { useGameStore } from '../../../store/gameStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { playerCharacterCardsApi, sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';

interface CharactersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  encounteredIds: string[];
  npcs: NpcProfileLike[];
  player?: PlayerProfileLike | null;
  editableProfiles?: PlayerEditableNpc[];
  onProfilesChange?: (profiles: PlayerEditableNpc[]) => void;
  narrativeBusy?: boolean;
}

/**
 * UE 流程：
 * 列表 → 详情 →（编辑人设 / 点头像私聊）
 * 列表 → +添加 / 导入 → 表单 → 保存回列表
 * 配色沿用主题红，交互严格对齐流程图。
 */
type ViewMode = 'list' | 'detail' | 'form' | 'chat' | 'import';

const CharactersPanel: React.FC<CharactersPanelProps> = ({
  isOpen,
  onClose,
  encounteredIds,
  npcs,
  player = null,
  editableProfiles,
  onProfilesChange,
  narrativeBusy = false,
}) => {
  const { t } = useTranslation();
  const { sessionId } = useGameStore();
  const authUser = useAuthStore((s) => s.user);
  const [detail, setDetail] = useState<CharacterPanelItem | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<PlayerEditableNpc | null>(null);
  const [localProfiles, setLocalProfiles] = useState<PlayerEditableNpc[]>(
    () => editableProfiles ?? [],
  );
  const [importCards, setImportCards] = useState<PlayerCharacterCard[]>([]);
  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  React.useEffect(() => {
    if (editableProfiles == null) return;
    setLocalProfiles(editableProfiles);
  }, [editableProfiles]);

  const presetItems = useMemo(
    () => buildCharacterPanelItems(encounteredIds, npcs, getImageUrl, player),
    [encounteredIds, npcs, player],
  );

  const mergedProfiles = useMemo(() => {
    const byId = new Map<string, PlayerEditableNpc>();
    for (const npc of npcs || []) {
      const p = npcLikeToEditableProfile(npc, {
        encountered: encounteredIds.includes(String(npc.id)),
      });
      if (p) byId.set(p.id, p);
    }
    for (const p of localProfiles) {
      byId.set(p.id, {
        ...byId.get(p.id),
        ...p,
        encountered: p.encountered || encounteredIds.includes(p.id),
      });
    }
    return sortEditableNpcProfiles([...byId.values()]);
  }, [npcs, localProfiles, encounteredIds]);

  const favorabilityOf = (id: string) =>
    localProfiles.find((p) => p.id === id)?.favorability
    ?? mergedProfiles.find((p) => p.id === id)?.favorability;

  const filteredImportCards = useMemo(
    () => filterPlayerCharacterCards(importCards, importQuery),
    [importCards, importQuery],
  );

  const handleClose = () => {
    setDetail(null);
    setMode('list');
    setEditing(null);
    setImportQuery('');
    onClose();
  };

  const backToList = () => {
    setDetail(null);
    setEditing(null);
    setMode('list');
  };

  const persistProfile = async (profile: PlayerEditableNpc) => {
    const token = authUser?.token;
    if (sessionId && token) {
      const res = await sessionPlayerProfileApi.upsertNpc(token, sessionId, profile.id, profile);
      if (!res?.success) {
        toast.error(res?.message || '保存失败');
        return false;
      }
    }
    const next = [...localProfiles.filter((p) => p.id !== profile.id), profile];
    setLocalProfiles(next);
    onProfilesChange?.(next);
    toast.success('已保存到本局');
    return true;
  };

  const toDetailItem = (profile: PlayerEditableNpc): CharacterPanelItem => {
    const preset = presetItems.find((i) => i.id === profile.id);
    const avatarUrl = getImageUrl(profile.avatarUrl || preset?.avatarUrl || '');
    if (preset) return { ...preset, avatarUrl: avatarUrl || preset.avatarUrl };
    return {
      id: profile.id,
      name: profile.name,
      identity: profile.relationship,
      description: profile.summary,
      personality: profile.attitudeToPlayer,
      memories: [],
      avatarUrl,
    };
  };

  const openEdit = (profile: PlayerEditableNpc) => {
    setEditing(profile);
    setMode('form');
  };

  const openAdd = () => {
    setEditing(null);
    setMode('form');
  };

  const openDetailFromProfile = (profile: PlayerEditableNpc) => {
    setDetail(toDetailItem(profile));
    setMode('detail');
  };

  const openImport = async () => {
    const token = authUser?.token;
    if (!token) {
      toast.error('请先登录后再导入角色');
      return;
    }
    setImportLoading(true);
    setMode('import');
    try {
      const res = await playerCharacterCardsApi.list(token);
      if (!res?.success) {
        toast.error(res?.message || '加载卡库失败');
        setMode('list');
        return;
      }
      setImportCards(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error((e as Error)?.message || '加载卡库失败');
      setMode('list');
    } finally {
      setImportLoading(false);
    }
  };

  const importCardAsNpc = (card: PlayerCharacterCard) => {
    const gender = (['male', 'female', 'other', 'unknown'].includes(String(card.gender))
      ? card.gender
      : 'unknown') as PlayerEditableNpc['gender'];
    setDetail(null);
    setEditing({
      name: card.name,
      gender,
      relationship: '导入角色',
      summary: String(card.persona || '').slice(0, 200) || '从角色卡导入',
      attitudeToPlayer: '待设定',
      detailedBio: String(card.persona || '').slice(0, 500),
    } as PlayerEditableNpc);
    setMode('form');
    toast.success('已填入卡库资料，请生成头像后保存');
  };

  const listHeaderRight = (
    <div className={shell.listHeaderActions}>
      <button type="button" className={shell.ghostButton} onClick={() => void openImport()}>
        导入
      </button>
      <button type="button" className={shell.primaryButton} onClick={openAdd}>
        + 添加角色
      </button>
    </div>
  );

  const shellTitle = t('galgame.panelCharactersTitle');
  const shellSubtitle =
    mode === 'form'
      ? (editing?.id && localProfiles.some((p) => p.id === editing.id) ? '编辑人设' : '添加新角色')
      : mode === 'chat'
        ? undefined
        : mode === 'detail'
          ? undefined
          : mode === 'import'
            ? '从账号卡库导入为局内角色'
            : '当前已出场人物概览';

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={mode === 'detail' && detail ? detail.name : shellTitle}
      subtitle={
        mode === 'detail' && detail
          ? undefined
          : shellSubtitle
      }
      onClose={handleClose}
      hideHeader={mode === 'chat' || mode === 'form'}
      showBack={mode === 'list'}
      onHeaderBack={
        mode === 'detail' || mode === 'import'
          ? backToList
          : undefined
      }
      headerRight={mode === 'list' ? listHeaderRight : undefined}
      footer={
        mode === 'detail' ? (
          <div className={shell.footerActions}>
            <button type="button" className={shell.backButton} onClick={backToList}>
              返回列表
            </button>
            <button type="button" className={shell.chatBtnWide} onClick={() => setMode('chat')}>
              私聊
            </button>
          </div>
        ) : null
      }
    >
      {mode === 'chat' && detail ? (
        <PrivateChatPanel
          npcId={detail.id}
          npcName={detail.name}
          npcAvatarUrl={detail.avatarUrl}
          narrativeBusy={narrativeBusy}
          onBack={() => setMode('detail')}
        />
      ) : mode === 'form' ? (
        <CharacterProfileForm
          initial={editing}
          submitLabel="保存"
          formTitle={
            editing?.id && mergedProfiles.some((p) => p.id === editing.id)
              ? '编辑人设'
              : '添加新角色'
          }
          onCancel={() => {
            setEditing(null);
            setMode(detail ? 'detail' : 'list');
          }}
          onSubmit={async (data) => {
            const editingExisting = Boolean(
              editing?.id && mergedProfiles.some((p) => p.id === editing.id),
            );
            if (editingExisting && editing?.id) {
              const base = mergedProfiles.find((p) => p.id === editing.id)!;
              const merged = mergeCharacterProfilePatch(base, data);
              if (!merged.ok) {
                toast.error(merged.message || '保存失败');
                return;
              }
              const ok = await persistProfile(merged.profile);
              if (ok) {
                setDetail(toDetailItem(merged.profile));
                setEditing(null);
                setMode(detail ? 'detail' : 'list');
              }
              return;
            }
            const created = createPlayerNpcProfile(data, { id: data.id });
            if (!created.ok) {
              toast.error(created.message || '创建失败');
              return;
            }
            const ok = await persistProfile(created.profile);
            if (ok) {
              setMode('list');
              setEditing(null);
              setDetail(null);
            }
          }}
        />
      ) : mode === 'import' ? (
        <div className={shell.importPanel}>
          <input
            className={shell.importSearch}
            value={importQuery}
            placeholder="搜索卡库…"
            onChange={(e) => setImportQuery(e.target.value)}
          />
          {importLoading ? (
            <div className={shell.empty}>加载中…</div>
          ) : filteredImportCards.length === 0 ? (
            <div className={shell.empty}>卡库为空，请先在属性面板创建角色卡</div>
          ) : (
            filteredImportCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`${shell.card} ${shell.importCard}`}
                onClick={() => importCardAsNpc(card)}
              >
                <strong className={shell.cardTitle}>{card.name}</strong>
                <span className={shell.cardMeta}>
                  {card.gender === 'male' ? '男' : card.gender === 'female' ? '女' : '其他'}
                </span>
                {card.persona ? <p className={shell.cardBody}>{card.persona}</p> : null}
              </button>
            ))
          )}
        </div>
      ) : mode === 'detail' && detail ? (
        (() => {
          const profile = mergedProfiles.find((x) => x.id === detail.id)
            || npcLikeToEditableProfile({
              id: detail.id,
              name: detail.name,
              description: detail.description,
              personality: detail.personality,
              job: detail.identity,
            });
          const favRaw = favorabilityOf(detail.id);
          const favNum = Math.min(100, Math.max(0, favRaw != null ? Number(favRaw) || 0 : 0));
          const genderText = profile?.gender === 'male'
            ? '男'
            : profile?.gender === 'female'
              ? '女'
              : profile?.gender === 'other'
                ? '其他'
                : '未知';
          const relationship = profile?.relationship || '';
          const roleTag = detail.identity && detail.identity !== relationship
            ? detail.identity
            : '';
          const summary = profile?.summary || detail.description || '';
          const attitude = profile?.attitudeToPlayer || detail.personality || '';
          const tags = [
            ...(profile?.personalityTags || []),
            profile?.importance === 'major' ? '重要' : profile?.importance === 'minor' ? '次要' : profile?.importance === 'extra' ? '路人' : '',
            profile?.survival === 'alive' ? '存活' : profile?.survival === 'dead' ? '死亡' : profile?.survival === 'unknown' ? '未知' : '',
          ].filter(Boolean);
          const avatarUrl = getImageUrl(profile?.avatarUrl || detail.avatarUrl || '');

          return (
            <article className={shell.detailPage}>
              <div className={shell.detailHero}>
                <button
                  type="button"
                  className={shell.detailPortraitBtn}
                  onClick={() => setMode('chat')}
                  aria-label={`与 ${detail.name} 私聊`}
                >
                  {avatarUrl ? (
                    <img className={shell.detailPortrait} src={avatarUrl} alt={detail.name} />
                  ) : (
                    <div className={shell.detailPortraitEmpty} aria-hidden />
                  )}
                  <span className={shell.detailChatHint}>点击头像私聊</span>
                </button>
                <div className={shell.detailHeroInfo}>
                  <h3 className={shell.detailName}>{detail.name}</h3>
                  <p className={shell.detailMeta}>
                    <span className={shell.detailGender}>{genderText}</span>
                    {roleTag ? <span className={shell.detailRoleTag}>{roleTag}</span> : null}
                  </p>
                  {relationship ? (
                    <p className={shell.detailRelationLine}>关系：{relationship}</p>
                  ) : null}
                </div>
              </div>

              {summary ? (
                <section className={shell.detailSection}>
                  <div className={shell.detailSectionHead}>
                    <h4 className={shell.detailSectionTitle}>简介</h4>
                  </div>
                  <p className={shell.detailSectionBody}>{summary}</p>
                </section>
              ) : null}

              <section className={shell.detailSection}>
                <div className={shell.detailSectionHead}>
                  <h4 className={shell.detailSectionTitle}>人设</h4>
                  <button
                    type="button"
                    className={shell.editPersonaBtn}
                    onClick={() => profile && openEdit(profile)}
                    disabled={!profile}
                  >
                    ✎ 编辑人设
                  </button>
                </div>
                {tags.length > 0 ? (
                  <div className={shell.personaTags}>
                    {tags.map((tag) => (
                      <span key={tag} className={shell.personaTag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                {profile?.detailedBio ? (
                  <p className={shell.detailSectionBody}>{profile.detailedBio}</p>
                ) : !tags.length ? (
                  <p className={shell.detailSectionMuted}>暂无人设补充，可点击编辑完善</p>
                ) : null}
              </section>

              <section className={shell.detailSection}>
                <div className={shell.detailSectionHead}>
                  <h4 className={shell.detailSectionTitle}>对你的态度</h4>
                  <span className={shell.favorBadge} aria-label={`好感 ${favNum}`}>
                    ♥ {favNum}/100
                  </span>
                </div>
                {attitude ? <p className={shell.detailSectionBody}>{attitude}</p> : null}
                <div className={shell.favorRow} aria-hidden>
                  <div className={shell.favorTrack}>
                    <div className={shell.favorFill} style={{ width: `${favNum}%` }} />
                  </div>
                </div>
              </section>

              {detail.memories.length > 0 ? (
                <section className={shell.detailSection}>
                  <div className={shell.detailSectionHead}>
                    <h4 className={shell.detailSectionTitle}>{t('galgame.panelMemories')}</h4>
                  </div>
                  <ul className={shell.detailSectionBody}>
                    {detail.memories.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </article>
          );
        })()
      ) : mergedProfiles.length === 0 ? (
        <div className={shell.empty}>{t('galgame.panelCharactersEmpty')}</div>
      ) : (
        mergedProfiles.map((profile) => {
          const preset = presetItems.find((i) => i.id === profile.id);
          const avatarUrl = getImageUrl(profile.avatarUrl || preset?.avatarUrl || '');
          return (
            <div key={profile.id} className={`${shell.card} ${shell.charRow}`}>
              <div className={shell.charAside}>
                {avatarUrl ? (
                  <img className={shell.avatar} src={avatarUrl} alt="" />
                ) : (
                  <div className={shell.avatar} aria-hidden />
                )}
                <button
                  type="button"
                  className={shell.chatBtn}
                  onClick={() => {
                    setDetail(toDetailItem(profile));
                    setMode('chat');
                  }}
                >
                  私聊
                </button>
              </div>
              <button
                type="button"
                className={`${shell.charText} ${shell.charCardButton}`}
                onClick={() => openDetailFromProfile(profile)}
              >
                <h3 className={shell.cardTitle}>
                  {profile.name}
                  {!profile.encountered ? (
                    <span className={shell.cardMeta}> · 未出场</span>
                  ) : null}
                </h3>
                {profile.relationship ? <p className={shell.cardMeta}>{profile.relationship}</p> : null}
                {profile.summary ? <p className={shell.cardBody}>{profile.summary}</p> : null}
              </button>
              <button
                type="button"
                className={shell.charChevronBtn}
                aria-label={`查看 ${profile.name} 详情`}
                onClick={() => openDetailFromProfile(profile)}
              >
                ›
              </button>
            </div>
          );
        })
      )}
    </PlayPanelShell>
  );
};

export default CharactersPanel;
