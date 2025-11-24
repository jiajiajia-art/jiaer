import React from 'react';
import styles from './MissionSubmitModal.module.css';
import type { MissionData, Mission } from '../../api/game/missionApi.type';
import toast, { Toaster } from 'react-hot-toast';

interface MissionSubmitModalProps {
    missionData: MissionData | null;
    onClose?: () => void;
    onSubmitMission?: (missionId: string) => Promise<void>;
}

const MissionItem: React.FC<{ 
    mission: Mission; 
    onSubmitMission?: (missionId: string) => Promise<void>;
}> = ({ mission, onSubmitMission }) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmitMission = async () => {
        if (mission.id && !isSubmitting && onSubmitMission) {
            try {
                setIsSubmitting(true);
                await onSubmitMission(mission.id);
            } catch (error: any) {
                console.error('❌ 任务提交错误:', error);
                toast.error('任务提交失败，请稍后重试');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className={styles.missionItem}>
            <div className={styles.missionHeader}>
                <h4 className={styles.missionTitle}>{mission.title}</h4>
                <span className={`${styles.missionStatus} ${styles.missionStatusActive}`}>
                    进行中
                </span>
            </div>
            <div className={styles.missionDescription}>
                <p>{mission.description}</p>
                {mission.completionPaths.length > 0 && (
                    <div className={styles.missionCompletionPaths}>
                        <p>推荐完成完成路径：</p>
                        {mission.completionPaths.map((path) => (
                            <div key={path.pathId}>{path.description}</div>
                        ))}
                    </div>
                )}
            </div>
            <div className={styles.missionReward}>
                <span className={styles.rewardItem}>经验: {mission.reward.experience}</span>
                <span className={styles.rewardItem}>金币: {mission.reward.gold}</span>
                {
                    mission.reward.items.map((item, index) => (
                        <span key={index} className={styles.rewardItem}>{item}</span>
                    ))
                }
                <button
                    className={styles.submitButton}
                    onClick={handleSubmitMission}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '提交中...' : '任务提交'}
                </button>
            </div>
        </div>
    );
};

const MissionSubmitModal: React.FC<MissionSubmitModalProps> = ({ 
    missionData, 
    onSubmitMission
}) => {
    if (!missionData || missionData.activeMissions.length === 0) {
        return null;
    }

    return (
        <div className={styles.modalOverlay}>
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
                toastOptions={{
                    duration: 3000,
                    style: {
                        minWidth: '250px',
                        textAlign: 'center',
                        borderRadius: '8px',
                    },
                }}
            />
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>任务提示</h2>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.alertMessage}>
                        <p className={styles.alertText}>
                            您有未完成的任务，请完成任务后再继续游戏。
                        </p>
                    </div>
                    <div className={styles.missionsList}>
                        <h3 className={styles.sectionTitle}>
                            进行中的任务 ({missionData.activeMissions.length})
                        </h3>
                        {missionData.activeMissions.map((mission) => (
                            <MissionItem
                                key={mission.id}
                                mission={mission}
                                onSubmitMission={onSubmitMission}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MissionSubmitModal;

