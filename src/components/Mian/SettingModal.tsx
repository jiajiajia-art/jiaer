import React, { useState } from 'react';
import styles from './SettingModal.module.css';
import { useMusic } from '../../hooks/useMusic';
import AdventureModal from './AdventureModal';

interface SettingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingModal: React.FC<SettingModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    const { isPlaying, togglePlay, pause, volume, setVolume } = useMusic();
    const [isAdventureModalOpen, setIsAdventureModalOpen] = useState(false);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (newVolume === 0 && isPlaying) {
            pause();
        }
    };

    const handleClose = () => {
        onClose();
    };

    const volumePercent = Math.round(volume * 100);
    const isMuted = volume === 0;

    return (
        <>
            <div className={styles.modalContent}>
                <div className={styles.closeBtn} onClick={handleClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                <div className={styles.settingContent}>
                    <h2 className={styles.settingTitle}>设置</h2>

                    <div className={styles.musicControl}>
                        <div className={styles.musicControlRow}>
                            <div
                                className={`${styles.musicToggleBtn} ${isMuted ? styles.muted : ''}`}
                                onClick={isMuted ? undefined : togglePlay}
                                aria-label={isPlaying ? '暂停音乐' : '播放音乐'}
                                tabIndex={isMuted ? -1 : 0}
                                aria-disabled={isMuted}
                                style={{ cursor: isMuted ? 'not-allowed' : 'pointer' }}
                            >
                                {isPlaying ? (
                                    <span className={styles.musicIcon}>⏸</span>
                                ) : (
                                    <span className={styles.musicIcon}>▶</span>
                                )}
                            </div>
                            <div className={styles.volumeControl}>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className={styles.volumeSlider}
                                    style={{
                                        background: `linear-gradient(to right, #B24F1B 0%, #B24F1B ${volumePercent}%, #E4D2A9 ${volumePercent}%, #E4D2A9 100%)`
                                    }}
                                />
                                <span className={styles.volumeValue}>{volumePercent}%</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.exportBtnContainer}>
                        <button className={styles.exportBtn} onClick={() => setIsAdventureModalOpen(true)}>导出冒险笔记</button>
                    </div>
                </div>
            </div>
            <AdventureModal
                isOpen={isAdventureModalOpen}
                onClose={() => setIsAdventureModalOpen(false)} />
        </>
    );
};

export default SettingModal;