import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WorldMapCard.module.css';

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
    const { t } = useTranslation();
    return (
        <div className={styles.uploadWorldMapCard}>
            <div className={styles.cardHead}>
                <div>
                    <p className={styles.eyebrow}>{t('gameEditor.step4')}</p>
                    <h2>{t('createGame.uploadOrGenerateMap')}</h2>
                    <p className={styles.subtitle}>
                        {t('createGame.mapPreviewTip')}
                    </p>
                </div>
            </div>
            {/* 大地图预览 + 右上角操作按钮 */}
            <div
                className={styles.sceneHero}
                style={worldMapPreviewSrc ? { backgroundImage: `url('${worldMapPreviewSrc}')` } : {}}
            >
                {worldMapPreviewSrc ? (
                    <span className={styles.heroHint}>{t('createGame.currentMapPreview')}</span>
                ) : (
                    <span>{t('createGame.noMapPleaseUpload')}</span>
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
                        {isGeneratingWorldMap ? t('createGame.generating') : t('createGame.aiGenerate')}
                    </button>
                    <button
                        className={styles.ghostSmall}
                        onClick={onUploadClick}
                        disabled={!fileId}
                    >
                        {t('common.upload')}
                    </button>
                </div>
                {isGeneratingWorldMap && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">{t('createGame.generatingMap')}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorldMapCard;

