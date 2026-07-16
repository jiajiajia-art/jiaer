import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import {
  buildCharacterPanelItems,
  type CharacterPanelItem,
  type NpcProfileLike,
  type PlayerProfileLike,
} from '../../../lib/galgame/encounteredCharacters';
import { getImageUrl } from '../../../utils/constants';

interface CharactersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  encounteredIds: string[];
  npcs: NpcProfileLike[];
  player?: PlayerProfileLike | null;
}

/** 功能注释：出场角色列表 + 详情；头像走 getImageUrl，立绘顶对齐裁切。 */
const CharactersPanel: React.FC<CharactersPanelProps> = ({
  isOpen,
  onClose,
  encounteredIds,
  npcs,
  player = null,
}) => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<CharacterPanelItem | null>(null);
  const items = useMemo(
    () => buildCharacterPanelItems(encounteredIds, npcs, getImageUrl, player),
    [encounteredIds, npcs, player]
  );

  const handleClose = () => {
    setDetail(null);
    onClose();
  };

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={t('galgame.panelCharactersTitle')}
      subtitle={t('galgame.panelCharactersSubtitle')}
      onClose={handleClose}
      footer={
        detail ? (
          <button type="button" className={shell.backButton} onClick={() => setDetail(null)}>
            {t('galgame.panelDetailBack')}
          </button>
        ) : null
      }
    >
      {detail ? (
        <article className={`${shell.card} ${shell.charRow}`}>
          {detail.avatarUrl ? (
            <img className={shell.avatar} src={detail.avatarUrl} alt={detail.name} />
          ) : (
            <div className={shell.avatar} aria-hidden />
          )}
          <div className={shell.charText}>
            <h3 className={shell.cardTitle}>{detail.name}</h3>
            {detail.identity ? <p className={shell.detailIdentity}>{detail.identity}</p> : null}
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
          </div>
        </article>
      ) : items.length === 0 ? (
        <div className={shell.empty}>{t('galgame.panelCharactersEmpty')}</div>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${shell.card} ${shell.charRow} ${shell.charCardButton}`}
            onClick={() => setDetail(item)}
          >
            {item.avatarUrl ? (
              <img className={shell.avatar} src={item.avatarUrl} alt="" />
            ) : (
              <div className={shell.avatar} aria-hidden />
            )}
            <div className={shell.charText}>
              <h3 className={shell.cardTitle}>{item.name}</h3>
              {item.identity ? <p className={shell.cardMeta}>{item.identity}</p> : null}
              {item.description ? <p className={shell.cardBody}>{item.description}</p> : null}
            </div>
          </button>
        ))
      )}
    </PlayPanelShell>
  );
};

export default CharactersPanel;
