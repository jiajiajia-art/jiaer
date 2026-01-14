import React from 'react';
import sidebarStyles from './CharactersSidebar.module.css';
import sharedStyles from './CharactersPanel.module.css';
import { getImageUrl } from '../../../utils/constants';
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
            className={sharedStyles.card}
            style={{ maxHeight: '72vh', overflowY: 'auto' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>解析出的角色</h3>
                <button className={sharedStyles.ghostSmall} onClick={onAddNew}>
                    + 新增角色
                </button>
            </div>
            <div className={sidebarStyles.characterRoster}>
                {characters.map((character) => (
                    <article
                        key={character.id}
                        className={`${sidebarStyles.characterRow} ${character.id === activeCharacterId ? sidebarStyles.active : ''}`}
                        onClick={() => handleCharacterClick(character.id)}
                    >
                        <div
                            className={sidebarStyles.characterThumb}
                            style={{ backgroundImage: character.portrait ? `url('${getImageUrl(character.portrait)}')` : 'none' }}
                        />
                        <div className={sidebarStyles.characterMeta}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
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
                            <p className={sharedStyles.mutedSmall}>{character.role || ''} · {character.identity || ''}</p>
                            <div className={sharedStyles.tagRow}>
                                {character.personality && character.personality.length > 0 ? (
                                    character.personality.map((tag) => (
                                        <span key={tag} className={sharedStyles.tag}>{tag}</span>
                                    ))
                                ) : (
                                    <span className={sharedStyles.mutedSmall}>暂无性格标签</span>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default CharactersSidebar;

