import React from 'react';
import styles from './Attributes.module.css';
import { IoClose } from 'react-icons/io5';
import type { NPC, PlayerCharacter } from '../../api/worldInteraction/worldInteractionApi.type';

interface AttributesProps {
    npc?: NPC | null;
    player?: PlayerCharacter | null;
    visible: boolean;
    onClose: () => void;
}

const Attributes: React.FC<AttributesProps> = ({ npc, player, visible, onClose }) => {
    if (!visible || (!npc && !player)) return null;

    const target = npc || player;
    const name = npc ? npc.name : (player ? player.name : '');
    const visibleAttributes = Object.entries(target?.attributes || {}).filter(([, attr]) => attr.visible === true);

    return (
        <div className={styles.overlay}>
            <div className={styles.panelWrapper}>
                <button className={styles.closeButton} onClick={onClose}>
                    <IoClose />
                </button>
                <div className={styles.panel}>
                    <div className={styles.content}>
                        {visibleAttributes.length > 0 ? (
                            <>
                                <div className={styles.title}>{name}</div>
                                <div className={styles.attributeList}>
                                    {visibleAttributes.map(([key, attr]) => (
                                        <div key={key} className={styles.attributeItem}>
                                            <span className={styles.attrName}>{attr.displayName}:</span>
                                            <span className={styles.attrValue}>{attr.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className={styles.noAttributes}>暂无属性信息</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Attributes;

