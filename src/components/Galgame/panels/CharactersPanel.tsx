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
  type SessionPlayerProfile,
} from '../../../lib/galgame/playerCharacterCard';
import { getImageUrl, getPlayerImageUrl } from '../../../utils/constants';
import {
  pickDisplayAvatarFullUrl,
  pickDisplayAvatarThumbUrl,
} from '../../../lib/galgame/avatarThumbUrl';
import { useGameStore } from '../../../store/gameStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { playerCharacterCardsApi, sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { fetchCharacterAvatarThumbs } from '../../../api/galgame/playUi';

interface CharactersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  encounteredIds: string[];
  npcs: NpcProfileLike[];
  player?: PlayerProfileLike | null;
  editableProfiles?: PlayerEditableNpc[];
  onProfilesChange?: (profiles: PlayerEditableNpc[]) => void;
  /** 局内「我的档案」——私聊用户头像跟它走，换档立刻刷新 */
  sessionPlayerProfile?: SessionPlayerProfile | null;
  onSessionPlayerProfileChange?: (profile: SessionPlayerProfile) => void;
  narrativeBusy?: boolean;
}

/**
 * UE 流程：
 * 列表 → 点头像 / 查看详情 → 同一弹窗（大图 + 完整介绍 + 私聊）
 * 列表 → +添加 / 导入 → 表单 → 保存回列表
 * 配色沿用主题红，交互严格对齐流程图。
 */
type ViewMode = 'list' | 'detail' | 'form' | 'chat' | 'import';

/** 列表简介最多展示 200 字，超出用省略号；完整内容在预览弹窗。 */
const LIST_INTRO_MAX_CHARS = 200;

function truncateIntroText(text: string, max = LIST_INTRO_MAX_CHARS): string {
  const normalized = String(text || '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

/** 私聊按钮细线气泡图标（档案笺印章感） */
const ChatSealIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    width="1em"
    height="1em"
    fill="none"
    aria-hidden
  >
    <path
      d="M3.2 2.6h9.6c.77 0 1.4.63 1.4 1.4v5.2c0 .77-.63 1.4-1.4 1.4H8.1L5.2 13.3V10.6H3.2c-.77 0-1.4-.63-1.4-1.4V4c0-.77.63-1.4 1.4-1.4Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    <path
      d="M5 5.6h6M5 8h4.2"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
    />
  </svg>
);

const CharactersPanel: React.FC<CharactersPanelProps> = ({
  isOpen,
  onClose,
  encounteredIds,
  npcs,
  player = null,
  editableProfiles,
  onProfilesChange,
  sessionPlayerProfile = null,
  onSessionPlayerProfileChange,
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
  const [previewProfile, setPreviewProfile] = useState<PlayerEditableNpc | null>(null);
  const [npcAvatarThumbs, setNpcAvatarThumbs] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editableProfiles == null) return;
    setLocalProfiles(editableProfiles);
  }, [editableProfiles]);

  // 功能注释：打开角色档案时批量 ensure 150 头部小图（只合并头像字段，绝不整表覆盖介绍）
  React.useEffect(() => {
    if (!isOpen || !sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCharacterAvatarThumbs(sessionId);
        if (cancelled) return;
        setNpcAvatarThumbs(data.npcAvatarThumbs || {});
        if (Array.isArray(data.playerEditableNpcs) && data.playerEditableNpcs.length > 0) {
          const fromServer = data.playerEditableNpcs as PlayerEditableNpc[];
          setLocalProfiles((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            for (const s of fromServer) {
              if (!s?.id) continue;
              const old = byId.get(s.id);
              if (!old) {
                // 服务端新条目：仅当有实质介绍/关系时才纳入，避免空 stub 冲列表
                const hasSubstance = Boolean(
                  String(s.summary || '').trim()
                  || String(s.relationship || '').trim()
                  || String(s.detailedBio || '').trim()
                  || s.source === 'player_created',
                );
                if (!hasSubstance && (s.avatarThumbUrl || s.avatarUrl)) {
                  // 仅头像补丁：记入 thumbs 即可，不写入 localProfiles
                  continue;
                }
                byId.set(s.id, s);
                continue;
              }
              byId.set(s.id, {
                ...old,
                ...(s.avatarUrl ? { avatarUrl: s.avatarUrl } : {}),
                ...(s.avatarThumbUrl ? { avatarThumbUrl: s.avatarThumbUrl } : {}),
              });
            }
            return sortEditableNpcProfiles([...byId.values()]);
          });
        }
        if (data.sessionPlayerProfile) {
          onSessionPlayerProfileChange?.(data.sessionPlayerProfile);
        }
      } catch {
        /* 小图失败不挡列表 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId, onSessionPlayerProfileChange]);

  const resolveListAvatarUrl = (profile: PlayerEditableNpc, preset?: CharacterPanelItem | null) => {
    // 功能注释：角色档案只加载 *_150.webp，禁止 PNG 原图进 img.src
    const thumbPath = pickDisplayAvatarThumbUrl([
      npcAvatarThumbs[profile.id],
      profile.avatarThumbUrl,
      profile.avatarUrl,
      preset?.avatarUrl,
    ]);
    return thumbPath ? getImageUrl(thumbPath) : '';
  };

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
      const base = byId.get(p.id);
      // 功能注释：空 summary/relationship 不得覆盖文档简介（防头像 stub 冲掉介绍）
      byId.set(p.id, {
        ...base,
        ...p,
        summary: String(p.summary || '').trim() || base?.summary || p.summary || '',
        relationship: String(p.relationship || '').trim() || base?.relationship || p.relationship || '',
        attitudeToPlayer:
          String(p.attitudeToPlayer || '').trim()
          || base?.attitudeToPlayer
          || p.attitudeToPlayer
          || '',
        detailedBio: String(p.detailedBio || '').trim() || base?.detailedBio || p.detailedBio || '',
        avatarUrl: p.avatarUrl || base?.avatarUrl,
        avatarThumbUrl: p.avatarThumbUrl || base?.avatarThumbUrl,
        encountered: p.encountered || encounteredIds.includes(p.id) || !!base?.encountered,
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
    setPreviewProfile(null);
    onClose();
  };

  const backToList = () => {
    setDetail(null);
    setEditing(null);
    setPreviewProfile(null);
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
    const avatarUrl = resolveListAvatarUrl(profile, preset);
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
    setPreviewProfile(null);
    setMode('detail');
  };

  const startPrivateChat = (profile: PlayerEditableNpc) => {
    setPreviewProfile(null);
    setDetail(toDetailItem(profile));
    setMode('chat');
  };

  const openAvatarPreview = (profile: PlayerEditableNpc) => {
    setPreviewProfile(profile);
  };

  const closeAvatarPreview = () => setPreviewProfile(null);

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
            <button type="button" className={shell.chatBtnWide} onClick={() => {
              if (!detail) return;
              const profile = mergedProfiles.find((p) => p.id === detail.id)
                || localProfiles.find((p) => p.id === detail.id);
              if (profile) {
                startPrivateChat(profile);
                return;
              }
              setMode('chat');
            }}>
              <ChatSealIcon className={shell.chatBtnIcon} />
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
          npcAvatarUrl={
            mergedProfiles.find((p) => p.id === detail.id)?.avatarUrl
            || detail.avatarUrl
          }
          npcAvatarThumbUrl={
            npcAvatarThumbs[detail.id]
            || mergedProfiles.find((p) => p.id === detail.id)?.avatarThumbUrl
          }
          playerAvatarUrl={
            sessionPlayerProfile?.avatarUrl
            || getPlayerImageUrl(player)
            || undefined
          }
          playerAvatarThumbUrl={sessionPlayerProfile?.avatarThumbUrl || undefined}
          playerName={
            sessionPlayerProfile?.name
            || player?.name
            || undefined
          }
          narrativeBusy={narrativeBusy}
          onBack={() => setMode('detail')}
          onProfilesChange={(profiles) => {
            setLocalProfiles(profiles);
            onProfilesChange?.(profiles);
          }}
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
          const avatarUrl = profile
            ? resolveListAvatarUrl(profile, detail)
            : getImageUrl(
              pickDisplayAvatarThumbUrl([
                detail.id ? npcAvatarThumbs[detail.id] : '',
                detail.avatarUrl,
              ]),
            );

          return (
            <article className={shell.detailPage}>
              <div className={shell.detailHero}>
                <button
                  type="button"
                  className={shell.detailPortraitBtn}
                  onClick={() => profile && openAvatarPreview(profile)}
                  aria-label={`预览 ${detail.name}`}
                >
                  {avatarUrl ? (
                    <img className={shell.detailPortrait} src={avatarUrl} alt={detail.name} />
                  ) : (
                    <div className={shell.detailPortraitEmpty} aria-hidden />
                  )}
                  <span className={shell.detailChatHint}>点击头像预览</span>
                </button>
                <div className={shell.detailHeroInfo}>
                  <h3 className={shell.detailName}>
                    <span>{detail.name}</span>
                    {profile?.source === 'player_created' ? (
                      <span className={shell.customBadge}>自建</span>
                    ) : null}
                  </h3>
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
          const avatarUrl = resolveListAvatarUrl(profile, preset);
          const fullSummary = String(profile.summary || '').trim();
          const listSummary = truncateIntroText(fullSummary);
          return (
            <div key={profile.id} className={`${shell.card} ${shell.charRow}`}>
              <div className={shell.charAside}>
                <button
                  type="button"
                  className={shell.avatarHit}
                  onClick={() => openAvatarPreview(profile)}
                  aria-label={`查看 ${profile.name} 头像与介绍`}
                >
                  {avatarUrl ? (
                    <img className={shell.avatar} src={avatarUrl} alt={profile.name} />
                  ) : (
                    <div className={shell.avatar} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  className={shell.chatBtn}
                  onClick={() => startPrivateChat(profile)}
                >
                  <ChatSealIcon className={shell.chatBtnIcon} />
                  私聊
                </button>
              </div>
              <div className={shell.charText}>
                <h3 className={shell.cardTitle}>
                  <span className={shell.cardTitleName}>{profile.name}</span>
                  <span className={shell.cardTitleTrail}>
                    {profile.source === 'player_created' ? (
                      <span className={shell.customBadge}>自建</span>
                    ) : null}
                    {!profile.encountered ? (
                      <span className={shell.cardTitleMeta}>未出场</span>
                    ) : null}
                  </span>
                </h3>
                {profile.relationship ? <p className={shell.cardMeta}>{profile.relationship}</p> : null}
                {listSummary ? (
                  <p className={`${shell.cardBody} ${shell.cardBodyTruncate}`}>{listSummary}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={shell.charChevronBtn}
                aria-label={`查看 ${profile.name} 详情`}
                onClick={() => openAvatarPreview(profile)}
              >
                ›
              </button>
            </div>
          );
        })
      )}

      {previewProfile ? (() => {
        const p = previewProfile;
        const preset = presetItems.find((i) => i.id === p.id);
        // 功能注释：人物笺大图用原图，不用列表 150 小图
        const avatarFullPath = pickDisplayAvatarFullUrl([
          p.avatarUrl,
          preset?.avatarUrl,
          p.avatarThumbUrl,
          p.id ? npcAvatarThumbs[p.id] : '',
        ]);
        const avatarUrl = avatarFullPath
          ? getImageUrl(avatarFullPath)
          : resolveListAvatarUrl(p, preset);
        const introSummary = String(p.summary || '').trim();
        const introAttitude = String(p.attitudeToPlayer || '').trim();
        const introRelation = String(p.relationship || '').trim();
        const introBio = String(p.detailedBio || '').trim();
        const hasIntro = Boolean(introSummary || introAttitude || introRelation || introBio);
        return (
          <div
            className={shell.avatarPreviewOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={`${p.name} 人物介绍`}
            onClick={closeAvatarPreview}
          >
            <div className={shell.avatarPreviewCard} onClick={(e) => e.stopPropagation()}>
              <div className={shell.avatarPreviewChrome}>
                <span className={shell.avatarPreviewChromeLabel}>人物笺</span>
                <button
                  type="button"
                  className={shell.avatarPreviewClose}
                  onClick={closeAvatarPreview}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <div className={shell.avatarPreviewScroll}>
                <div className={shell.avatarPreviewPortraitWrap}>
                  {avatarUrl ? (
                    <img className={shell.avatarPreviewPortrait} src={avatarUrl} alt={p.name} />
                  ) : (
                    <div className={shell.avatarPreviewPortraitEmpty} aria-hidden />
                  )}
                </div>
                <header className={shell.avatarPreviewHead}>
                  <h3 className={shell.avatarPreviewName}>{p.name}</h3>
                  {introRelation ? (
                    <p className={shell.avatarPreviewMeta}>关系：{introRelation}</p>
                  ) : null}
                </header>
                <div className={shell.avatarPreviewIntro}>
                  <h4 className={shell.avatarPreviewIntroTitle}>人物介绍</h4>
                  {hasIntro ? (
                    <>
                      {introSummary ? (
                        <p className={shell.avatarPreviewIntroBody}>{introSummary}</p>
                      ) : null}
                      {introAttitude ? (
                        <p className={shell.avatarPreviewIntroBody}>
                          <span className={shell.avatarPreviewIntroLabel}>对你的态度</span>
                          {introAttitude}
                        </p>
                      ) : null}
                      {introBio ? (
                        <p className={shell.avatarPreviewIntroBody}>{introBio}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className={shell.avatarPreviewIntroMuted}>暂无人物介绍</p>
                  )}
                </div>
              </div>
              <footer className={shell.avatarPreviewDock}>
                <button
                  type="button"
                  className={shell.ghostButton}
                  onClick={() => openDetailFromProfile(p)}
                >
                  完整档案
                </button>
                <button
                  type="button"
                  className={shell.avatarPreviewChatBtn}
                  onClick={() => startPrivateChat(p)}
                >
                  <ChatSealIcon className={shell.chatBtnIconLg} />
                  私聊
                </button>
              </footer>
            </div>
          </div>
        );
      })() : null}
    </PlayPanelShell>
  );
};

export default CharactersPanel;
