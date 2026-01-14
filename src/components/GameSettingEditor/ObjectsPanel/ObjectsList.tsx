import React from 'react';
import styles from './ObjectsList.module.css';
import sharedStyles from './shared.module.css';
import { RiDeleteBin5Line } from 'react-icons/ri';
import type { ObjectItem } from '../../../api/worldInteraction/objectsData.type';
import { addImageTimestamp, getImageUrl } from '../../../utils/constants';

interface ObjectsListProps {
    objects: ObjectItem[];
    activeObjectId: string | null;
    onObjectClick: (objectId: string) => void;
    onDeleteClick: (objectId: string, e: React.MouseEvent) => void;
    onCreateClick: () => void;
}

const ObjectsList: React.FC<ObjectsListProps> = ({
    objects,
    activeObjectId,
    onObjectClick,
    onDeleteClick,
    onCreateClick,
}) => {
    return (
        <div className={styles.objectsList}>
            <div className={styles.objectsListHeader}>
                <h3>物品列表</h3>
                <button className={sharedStyles.ghostSmall} onClick={onCreateClick}>
                    + 创建
                </button>
            </div>
            <div className={styles.objectsListContent}>
                {objects.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>暂无物品</p>
                        <p className={styles.emptyHint}>点击"创建"添加新的物品</p>
                    </div>
                ) : (
                    objects.map((obj) => {
                        const isActive = activeObjectId === obj.item_id;
                        const categoryText = obj.category === 'consumable' ? '消耗类' : '非消耗类';
                        
                        return (
                            <div
                                key={obj.item_id}
                                className={`${styles.objectCard} ${isActive ? styles.objectCardActive : ''}`}
                                onClick={() => onObjectClick(obj.item_id)}
                            >
                                <div className={styles.objectCardThumbnail}>
                                    <img
                                        src={obj.icon ? addImageTimestamp(getImageUrl(obj.icon)) : ''}
                                        alt={obj.name || '物品'}
                                    />
                                </div>
                                <div className={styles.objectCardInfo}>
                                    <div className={styles.objectCardName}>{obj.name || '新建物品'}</div>
                                    <div className={styles.objectCardCategory}>{categoryText}</div>
                                </div>
                                <button
                                    className={styles.objectCardDelete}
                                    onClick={(e) => onDeleteClick(obj.item_id, e)}
                                    aria-label="删除"
                                >
                                    <RiDeleteBin5Line size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ObjectsList;
