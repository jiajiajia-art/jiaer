import React from 'react';
import styles from './WorldMapCard.module.css';
import { getImageUrl } from '../../../utils/constants';

interface WorldMapCardProps {
    worldMapPreviewSrc: string;
    isGeneratingWorldMap: boolean;
    fileId?: string | null;
    onGenerateClick: () => void;
    onUploadClick: () => void;
    worldMapFileInputRef: React.RefObject<HTMLInputElement | null>;
    onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const WorldMapCard: React.FC<WorldMapCardProps> = ({
    worldMapPreviewSrc,
    isGeneratingWorldMap,
    fileId,
    onGenerateClick,
    onUploadClick,
    worldMapFileInputRef,
    onUploadChange,
}) => {
    return (
        <div className={styles.uploadWorldMapCard}>
            <div className={styles.cardHead}>
                <div>
                    <p className={styles.eyebrow}>Step 4</p>
                    <h2>上传或 AI 生成大地图</h2>
                    <p className={styles.subtitle}>
                        用于在世界地图模式中展示场景与子场景的位置关系。
                    </p>
                </div>
            </div>
            {/* 大地图预览 + 右上角操作按钮 */}
            <div
                className={styles.sceneHero}
                style={worldMapPreviewSrc ? { backgroundImage: `url('${getImageUrl(worldMapPreviewSrc)}')` } : {}}
            >
                {worldMapPreviewSrc ? (
                    <span className={styles.heroHint}>当前大地图预览</span>
                ) : (
                    <span>暂无大地图，请先上传或生成</span>
                )}
                <div className={styles.worldMapActions}>
                    <input
                        ref={worldMapFileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={onUploadChange}
                    />
                    <button
                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                        onClick={onGenerateClick}
                        disabled={!fileId || isGeneratingWorldMap}
                    >
                        <img 
                            src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} 
                            alt="" 
                            className={styles.priceIcon} 
                        />
                        {isGeneratingWorldMap ? '生成中...' : 'AI 生成'}
                    </button>
                    <button
                        className={styles.ghostSmall}
                        onClick={onUploadClick}
                        disabled={!fileId}
                    >
                        上传
                    </button>
                </div>
                {isGeneratingWorldMap && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">正在生成大地图...</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorldMapCard;

