import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import CharacterProfileForm from './CharacterProfileForm';
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
import { getImageUrl } from '../../../utils/constants';
import { useGameStore } from '../../../store/gameStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';

interface CharactersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  encounteredIds: string[];
  npcs: NpcProfileLike[];
  player?: PlayerProfileLike | null;
  /** 局内已保存的可编辑档案（session 快照） */
  editableProfiles?: PlayerEditableNpc[];
  onProfilesChange?: (profiles: PlayerEditableNpc[]) => void;
}

type ViewMode = 'list' | 'detail' | 'form';

/** 功能注释：角色档案列表/详情/添加编辑；写 session 不回写创作者 preset。 */
const CharactersPanel: React.FC<CharactersPanelProps> = ({
  isOpen,
  onClose,
  encounteredIds,
  npcs,
  player = null,
  editableProfiles = [],
  onProfilesChange,
}) => {
  const { t } = useTranslation();
  const { sessionId } = useGameStore();
  const authUser = useAuthStore((s) => s.user);
  const [detail, setDetail] = useState<CharacterPanelItem | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<PlayerEditableNpc | null>(null);
  const [localProfiles, setLocalProfiles] = useState<PlayerEditableNpc[]>(editableProfiles);

  React.useEffect(() => {
    setLocalProfiles(editableProfiles || []);
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

  const handleClose = () => {
    setDetail(null);
    setMode('list');
    setEditing(null);
    onClose();
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

  const openEdit = (profile: PlayerEditableNpc) => {
    setEditing(profile);
    setMode('form');
  };

  const openAdd = () => {
    setEditing(null);
    setMode('form');
  };

  const headerExtra = mode === 'list' ? (
    <button type="button" className={shell.backButton} onClick={openAdd}>
      + 添加角色
    </button>
  ) : null;

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={t('galgame.panelCharactersTitle')}
      subtitle={mode === 'form' ? (editing ? '编辑角色' : '添加角色') : t('galgame.panelCharactersSubtitle')}
      onClose={handleClose}
      footer={
        mode === 'detail' ? (
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
            <button type="button" className={shell.backButton} onClick={() => { setDetail(null); setMode('list'); }}>
              {t('galgame.panelDetailBack')}
            </button>
            {detail ? (
              <button
                type="button"
                className={shell.backButton}
                onClick={() => {
                  const p = mergedProfiles.find((x) => x.id === detail.id)
                    || npcLikeToEditableProfile({ id: detail.id, name: detail.name, description: detail.description, personality: detail.personality, job: detail.identity });
                  if (p) openEdit(p);
                }}
              >
                编辑
              </button>
            ) : null}
          </div>
        ) : mode === 'list' ? headerExtra : null
      }
    >
      {mode === 'form' ? (
        <CharacterProfileForm
          initial={editing}
          submitLabel={editing ? '保存修改' : '添加'}
          onCancel={() => { setMode(detail ? 'detail' : 'list'); setEditing(null); }}
          onSubmit={async (data) => {
            if (editing) {
              const merged = mergeCharacterProfilePatch(editing, data);
              if (!merged.ok) {
                toast.error(merged.message || '保存失败');
                return;
              }
              const ok = await persistProfile(merged.profile);
              if (ok) {
                setMode('list');
                setEditing(null);
                setDetail(null);
              }
              return;
            }
            const created = createPlayerNpcProfile(data);
            if (!created.ok) {
              toast.error(created.message || '创建失败');
              return;
            }
            const ok = await persistProfile(created.profile);
            if (ok) {
              setMode('list');
              setEditing(null);
            }
          }}
        />
      ) : mode === 'detail' && detail ? (
        <article className={`${shell.card} ${shell.charRow}`}>
          {detail.avatarUrl ? (
            <img className={shell.avatar} src={detail.avatarUrl} alt={detail.name} />
          ) : (
            <div className={shell.avatar} aria-hidden />
          )}
          <div className={shell.charText}>
            <h3 className={shell.cardTitle}>{detail.name}</h3>
            {detail.identity ? <p className={shell.detailIdentity}>{detail.identity}</p> : null}
            {favorabilityOf(detail.id) != null ? (
              <div className={shell.sectionBox}>
                <div className={shell.sectionLabel}>好感</div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(favorabilityOf(detail.id)) || 0))}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg,#ff8fb8,#ff5c8a)',
                    }}
                  />
                </div>
              </div>
            ) : null}
            {detail.personality ? (
              <div className={shell.sectionBox}>
                <div className={shell.sectionLabel}>{t('galgame.panelPersonality')}</div>
                <p className={shell.cardBody}>{detail.personality}</p>
              </div>
            ) : null}
            {detail.memories.length > 0 ? (
              <div className={shell.sectionBox}>
                <div className={shell.sectionLabel}>{t('galgame.panelMemories')}</div>
                <ul className={shell.cardBody}>
                  {detail.memories.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!detail.personality && detail.memories.length === 0 && detail.description ? (
              <p className={shell.cardBody}>{detail.description}</p>
            ) : null}
            <p className={shell.cardMeta} style={{ marginTop: '0.75rem' }}>
              私聊能力将在后续版本开放
            </p>
          </div>
        </article>
      ) : mergedProfiles.length === 0 && presetItems.length === 0 ? (
        <div className={shell.empty}>{t('galgame.panelCharactersEmpty')}</div>
      ) : (
        <>
          {mergedProfiles.map((profile) => {
            const preset = presetItems.find((i) => i.id === profile.id);
            return (
              <button
                key={profile.id}
                type="button"
                className={`${shell.card} ${shell.charRow} ${shell.charCardButton}`}
                onClick={() => {
                  setDetail(
                    preset || {
                      id: profile.id,
                      name: profile.name,
                      identity: profile.relationship,
                      description: profile.summary,
                      personality: profile.attitudeToPlayer,
                      memories: [],
                      avatarUrl: '',
                    },
                  );
                  setMode('detail');
                }}
              >
                {preset?.avatarUrl ? (
                  <img className={shell.avatar} src={preset.avatarUrl} alt="" />
                ) : (
                  <div className={shell.avatar} aria-hidden />
                )}
                <div className={shell.charText}>
                  <h3 className={shell.cardTitle}>
                    {profile.name}
                    {!profile.encountered ? (
                      <span className={shell.cardMeta}> · 未出场</span>
                    ) : null}
                  </h3>
                  {profile.relationship ? <p className={shell.cardMeta}>{profile.relationship}</p> : null}
                  {profile.summary ? <p className={shell.cardBody}>{profile.summary}</p> : null}
                </div>
              </button>
            );
          })}
        </>
      )}
    </PlayPanelShell>
  );
};

export default CharactersPanel;
