import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import getGalgamePresetApi from '../../api/galgame/getGalgamePreset';
import type { NPC, NpcSetting } from '../../api/galgame/getGalgamePreset.type';
import { getImageUrl } from '../../utils/constants';
import styles from './GameDetailCharacterCards.module.css';

type CharacterCard = {
    id: string;
    name: string;
    role: string;
    bio: string;
    image: string;
};

const asNpcList = (npcs: NpcSetting | NPC[] | null | undefined): NPC[] => {
    if (Array.isArray(npcs)) return npcs;
    if (npcs && Array.isArray(npcs.npcs)) return npcs.npcs;
    return [];
};

const clean = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim();

const toCard = (npc: NPC, index: number): CharacterCard | null => {
    const name = clean(npc?.name);
    if (!name) return null;
    const role = clean(npc.job || npc.relationship || npc.personality);
    const bio = clean(npc.description || npc.appearance || '');
    const rawImage = npc.images?.base || npc.images?.happy || '';
    return {
        id: String(npc.id || `${name}-${index}`),
        name,
        role: role === bio ? '' : role,
        bio,
        image: getImageUrl(rawImage),
    };
};

type Props = {
    fileId: string;
};

const Portrait: React.FC<{ card: CharacterCard }> = ({ card }) => (
    card.image ? (
        <img src={card.image} alt="" />
    ) : (
        <span className={styles.fallback} aria-hidden="true">{card.name.slice(0, 1)}</span>
    )
);

/** 剧情简介下的竖长斜四边形角色卡：横滑预览下一张，点开放大看全文 */
const GameDetailCharacterCards: React.FC<Props> = ({ fileId }) => {
    const { t } = useTranslation();
    const [cards, setCards] = useState<CharacterCard[]>([]);
    const [openedId, setOpenedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setCards([]);
        setOpenedId(null);
        if (!fileId) return undefined;
        void getGalgamePresetApi.getGalgameFileId(fileId)
            .then((response) => {
                if (cancelled) return;
                const list = asNpcList(response.data?.data?.npcs);
                setCards(list.map(toCard).filter((card): card is CharacterCard => Boolean(card)));
            })
            .catch(() => {
                if (!cancelled) setCards([]);
            });
        return () => {
            cancelled = true;
        };
    }, [fileId]);

    const opened = cards.find((card) => card.id === openedId) || null;

    useEffect(() => {
        if (!opened) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenedId(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [opened]);

    if (cards.length === 0) return null;

    const lightbox = opened ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={opened.name}>
            <button type="button" className={styles.backdrop} aria-label={t('common.close')} onClick={() => setOpenedId(null)} />
            <article className={styles.zoomCard}>
                <button type="button" className={styles.close} aria-label={t('common.close')} onClick={() => setOpenedId(null)}>×</button>
                <div className={styles.zoomPortrait}>
                    <Portrait card={opened} />
                </div>
                <div className={styles.zoomCopy}>
                    <h4 className={styles.zoomName}>{opened.name}</h4>
                    {opened.role ? <p className={styles.zoomRole}>{opened.role}</p> : null}
                    {opened.bio ? <p className={styles.zoomBio}>{opened.bio}</p> : null}
                </div>
            </article>
        </div>
    ) : null;

    return (
        <section className={styles.section} aria-label={t('gameDetail.characterCards')}>
            <h3 className={styles.title}>{t('gameDetail.characterCards')}</h3>
            <p className={styles.hint}>{t('gameDetail.characterCardsHint')}</p>
            <div className={styles.rail}>
                {cards.map((card, index) => (
                    <button
                        key={card.id}
                        type="button"
                        className={styles.card}
                        onClick={() => setOpenedId(card.id)}
                    >
                        <span className={styles.rank}>{index + 1}</span>
                        <div className={styles.portrait}>
                            <Portrait card={card} />
                        </div>
                        <span className={styles.copy}>
                            {/* 功能注释：小卡只放姓名+身份，简介进点开详情，避免斜四边卡被字糊满 */}
                            <span className={styles.name}>{card.name}</span>
                            {card.role ? <span className={styles.role}>{card.role}</span> : null}
                        </span>
                    </button>
                ))}
            </div>
            {lightbox && typeof document !== 'undefined' ? createPortal(lightbox, document.body) : lightbox}
        </section>
    );
};

export default GameDetailCharacterCards;
