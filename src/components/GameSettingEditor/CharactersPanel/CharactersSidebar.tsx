import React, { useEffect, useMemo, useState } from 'react';
import sidebarStyles from './CharactersSidebar.module.css';
import sharedStyles from './CharactersPanel.module.css';
import { withCacheBust, normalizePersonalityTags } from './utils';
import { RiDeleteBin5Line } from 'react-icons/ri';
import type { Character } from './types';

interface CharactersSidebarProps {
    characters: Character[];
    activeCharacterId: string;
    isAddingNew: boolean;
    onSelectCharacter: (characterId: string) => void;
    onDeleteCharacter: (characterId: string, e: React.MouseEvent) => void;
    onAddNew: () => void;
    checkBeforeSwitch: (action: { type: 'switchCharacter' | 'switchPanel' | 'createCharacter'; targetCharacterId?: string | null }) => boolean;
    setIsAddingNew: (value: boolean) => void;
    setNewCharacterData: (value: Character | null) => void;
}

const CharactersSidebar: React.FC<CharactersSidebarProps> = ({
    characters,
    activeCharacterId,
    isAddingNew,
    onSelectCharacter,
    onDeleteCharacter,
    onAddNew,
    checkBeforeSwitch,
    setIsAddingNew,
    setNewCharacterData,
}) => {
    // 实现移动端角色列表折叠
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
    );
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(max-width: 720px)');
        const handleViewportChange = (event: MediaQueryListEvent) => {
            setIsMobileViewport(event.matches);
        };

        setIsMobileViewport(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleViewportChange);
            return () => mediaQuery.removeEventListener('change', handleViewportChange);
        }

        mediaQuery.addListener(handleViewportChange);
        return () => mediaQuery.removeListener(handleViewportChange);
    }, []);

    useEffect(() => {
        if (!isMobileViewport) {
            setIsMobileExpanded(false);
        }
    }, [isMobileViewport]);

    const visibleCharacters = useMemo(() => {
        if (!isMobileViewport || isMobileExpanded || characters.length <= 2) {
            return characters;
        }

        const defaultCharacters = characters.slice(0, 2);
        if (defaultCharacters.some((character) => character.id === activeCharacterId)) {
            return defaultCharacters;
        }

        const activeCharacter = characters.find((character) => character.id === activeCharacterId);
        return activeCharacter ? [...defaultCharacters, activeCharacter] : defaultCharacters;
    }, [activeCharacterId, characters, isMobileExpanded, isMobileViewport]);

    const handleCharacterClick = (characterId: string) => {
        if (!checkBeforeSwitch({ type: 'switchCharacter', targetCharacterId: characterId })) {
            return;
        }
        // 如果正在新增模式，点击侧边栏时取消新增并切换到所选角色
        if (isAddingNew) {
            setIsAddingNew(false);
            setNewCharacterData(null);
        }
        onSelectCharacter(characterId);
    };

    return (
        <div 
            className={`${sharedStyles.card} ${sidebarStyles.sidebarCard}`}
        >
            <div className={sidebarStyles.sidebarHeader}>
                <h3>解析出的角色</h3>
                <button className={sharedStyles.ghostSmall} onClick={onAddNew}>
                    + 新增角色
                </button>
            </div>
            <div className={sidebarStyles.rosterScroll}>
                <div className={sidebarStyles.characterRoster}>
                    {visibleCharacters.map((character) => {
                        // 侧栏角色前缀统一
                        const sidebarRole = character.id === 'player' ? (character.role || '主角') : 'NPC';
                        const personalityTags = normalizePersonalityTags(character.personality);
                        return (
                            <article
                                key={character.id}
                                className={`${sidebarStyles.characterRow} ${character.id === activeCharacterId ? sidebarStyles.active : ''}`}
                                onClick={() => handleCharacterClick(character.id)}
                            >
                                <div
                                    className={sidebarStyles.characterThumb}
                                    style={{ backgroundImage: character.portrait
                                ? (character.portrait.startsWith('blob:') || character.portrait.startsWith('data:')
                                    ? `url('${character.portrait}')`
                                    : `url('${withCacheBust(character.portrait)}')`)
                                : 'none' }}
                                />
                                <div className={sidebarStyles.characterMeta}>
                                    <div className={sidebarStyles.characterTitleRow}>
                                        <strong>{character.name || '未命名'}</strong>
                                        {character.id !== 'player' && (
                                            <button
                                                className={sidebarStyles.deleteButton}
                                                onClick={(e) => onDeleteCharacter(character.id, e)}
                                                title="删除角色"
                                            >
                                                <RiDeleteBin5Line />
                                            </button>
                                        )}
                                    </div>
                                    <p className={sharedStyles.mutedSmall}>{sidebarRole} · {character.identity || ''}</p>
                                    <div className={sharedStyles.tagRow}>
                                        {personalityTags.length > 0 ? (
                                            personalityTags.map((tag) => (
                                                <span key={tag} className={sharedStyles.tag}>{tag}</span>
                                            ))
                                        ) : (
                                            <span className={sharedStyles.mutedSmall}>暂无性格标签</span>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
                {isMobileViewport && characters.length > 2 && (
                    <button
                        type="button"
                        className={sidebarStyles.mobileToggleButton}
                        onClick={() => setIsMobileExpanded((prev) => !prev)}
                    >
                        {isMobileExpanded ? '收起角色' : `展开全部角色（${characters.length}）`}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CharactersSidebar;
