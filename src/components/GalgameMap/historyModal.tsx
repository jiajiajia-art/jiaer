import styles from './HistoryModal.module.css';
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    history: GetWorldInteractionHistoryResponse | null;
}

const HistoryModal = ({ visible, onClose, history }: HistoryModalProps) => {
    if (!visible) return null;

    const interactions = history?.interactions ?? [];

    return (
        <div className={styles.mask} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <div className={styles.title}>历史回顾</div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.content}>
                    {interactions.length === 0 && (
                        <div className={styles.empty}>
                            暂无历史记录
                        </div>
                    )}

                    {interactions.map((interaction: any, idx: number) => {
                        const steps = interaction.narrativeSteps || [];

                        return (
                            <div key={idx} className={styles.block}>
                                <div className={styles.blockHeader}>
                                    <div className={styles.blockMeta}>
                                        <span className={styles.eventTitle}>
                                            {interaction.eventTitle || '无标题事件'}
                                        </span>
                                        <span className={styles.dot}>·</span>
                                        <span className={styles.npcName}>
                                            {interaction.npcName}
                                        </span>
                                        <span className={styles.dot}>·</span>
                                        <span className={styles.subsceneName}>
                                            {interaction.subsceneName}
                                        </span>
                                    </div>
                                    <div className={styles.time}>
                                        {new Date(interaction.timestamp).toLocaleString()}
                                    </div>
                                </div>

                                <div className={styles.body}>
                                    <div className={styles.timeline}>
                                        {steps.map((step: any, sIdx: number) => (
                                            <div key={sIdx} className={styles.timelineItem}>
                                                <div className={styles.timelineDot} />
                                                <div className={styles.timelineContent}>
                                                    {step.type === 'narration' && (
                                                        <div className={styles.narration}>
                                                            {step.content}
                                                        </div>
                                                    )}
                                                    {step.type === 'dialogue' && (
                                                        <div className={styles.dialogue}>
                                                            <div className={styles.dialogueName}>
                                                                {step.speakerName || interaction.npcName}
                                                            </div>
                                                            <div className={styles.dialogueText}>
                                                                {step.content}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {step.type === 'choice' && (
                                                        <div className={styles.choice}>
                                                            <div className={styles.choiceTitle}>
                                                                {step.title || '选择'}
                                                            </div>
                                                            {step.description && (
                                                                <div className={styles.choiceDesc}>
                                                                    {step.description}
                                                                </div>
                                                            )}
                                                            <div className={styles.choiceOptions}>
                                                                {step.options?.map((opt: any, oIdx: number) => (
                                                                    <div
                                                                        key={oIdx}
                                                                        className={styles.choiceOption}
                                                                    >
                                                                        {opt.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {interaction.type === 'player_choice' && interaction.selectedOption && (
                                            <div className={styles.timelineItem}>
                                                <div className={styles.timelineDotPlayer} />
                                                <div className={styles.timelineContent}>
                                                    <div className={styles.playerChoiceLabel}>
                                                        你的选择
                                                    </div>
                                                    <div className={styles.playerChoiceText}>
                                                        {interaction.selectedOption.text}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;