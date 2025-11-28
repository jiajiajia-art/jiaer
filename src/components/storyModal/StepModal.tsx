import React from 'react';
import styles from './StepModal.module.css';
import ReactMarkdown from 'react-markdown';

interface StepModalProps {
    currentStep: any;
    isWaitingForData: boolean;
    displayedText: string;
    isTyping: boolean;
    showNextButton: boolean;
    selectedOptionIndex: number | null;
    choiceInput: string;
    historyMessagesLength?: number; // 历史记录长度
    onChoiceOption: (option: any, index: number) => void;
    onChoiceSend: () => void;
    onChoiceInputChange: (value: string) => void;
    onNextStep: () => void;
}

const StepModal: React.FC<StepModalProps> = React.memo(({
    currentStep,
    isWaitingForData,
    displayedText,
    isTyping,
    showNextButton,
    selectedOptionIndex,
    choiceInput,
    historyMessagesLength = 0,
    onChoiceOption,
    onChoiceSend,
    onChoiceInputChange,
    onNextStep
}) => {
    if (!currentStep && !isWaitingForData) {
        return null;
    }

    // 根据历史记录长度判断是否显示金币（如果历史记录长度大于某个阈值，则显示金币）
    const shouldShowCoin = historyMessagesLength/2 >= 1;
    console.log(historyMessagesLength/2);

    return (
        <div className={styles.stepModal}>
            <div className={styles.stepModalContent}>
                {currentStep ? (
                    <>
                        <div className={styles.stepModalHeader}>
                            <span className={styles.stepTypeLabel}>
                                {   currentStep.type === 'hint' ? '提示' :
                                        currentStep.type === 'choice' ? '选择' :
                                            currentStep.type}
                            </span>

                            {/* {
                                currentStep.type === 'choice' && (
                                    <button className={styles.skipBtn}>
                                        跳过
                                        <PiSkipForwardCircleLight className={styles.skipBtnIcon} />
                                    </button>
                                )
                            } */}
                        </div>
                        <div className={styles.stepModalBody}>
                            {currentStep.type === 'choice' ? (
                                <>
                                    {currentStep.title && (
                                        <h3 className={styles.choiceTitle}>{currentStep.title}</h3>
                                    )}
                                    {currentStep.text && (
                                        <p className={styles.choiceText}>{currentStep.text}</p>
                                    )}
                                    <div className={styles.choiceOptions}>
                                        {currentStep.options && currentStep.options.map((option: any, i: number) => {
                                            return (
                                                <button
                                                    key={i}
                                                    className={styles.choiceOptionBtn}
                                                    onClick={() => onChoiceOption(option, i)}
                                                    disabled={selectedOptionIndex !== null}
                                                >
                                                    {selectedOptionIndex === i ? (
                                                        <span className={styles.buttonLoadingDots}>
                                                            <span></span>
                                                            <span></span>
                                                            <span></span>
                                                        </span>
                                                    ) : (
                                                        <div className={styles.choiceOptionContent}>
                                                            <span className={styles.choiceOptionText}>{option.text}</span>
                                                            {shouldShowCoin && (
                                                                <span className={styles.choiceOptionPrice}>
                                                                    <img
                                                                        src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
                                                                        alt=""
                                                                        className={styles.choiceOptionPriceIcon}
                                                                    />
                                                                    2
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className={styles.choiceInputContainer}>
                                        <input
                                            type="text"
                                            className={styles.choiceInput}
                                            placeholder="输入你的选择..."
                                            value={choiceInput}
                                            onChange={(e) => onChoiceInputChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    onChoiceSend();
                                                }
                                            }}
                                            disabled={selectedOptionIndex !== null || isWaitingForData}
                                        />
                                        <button
                                            className={styles.choiceSendBtn}
                                            onClick={onChoiceSend}
                                            disabled={!choiceInput.trim() || selectedOptionIndex !== null || isWaitingForData}
                                        >
                                            {isWaitingForData && selectedOptionIndex === null ? (
                                                <span className={styles.buttonLoadingDots}>
                                                    <span></span>
                                                    <span></span>
                                                    <span></span>
                                                </span>
                                            ) : (
                                                <>
                                                    发送
                                                    {shouldShowCoin && (
                                                        <span className={styles.choiceOptionPrice}>
                                                            <img
                                                                src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
                                                                alt=""
                                                                className={styles.choiceOptionPriceIcon}
                                                            />
                                                            3
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <ReactMarkdown>{displayedText}</ReactMarkdown>
                                    {isTyping && <span className={styles.cursor}></span>}
                                </>
                            )}
                        </div>
                        {showNextButton && currentStep.type !== 'choice' && (
                            <div className={styles.stepModalFooter}>
                                <button
                                    className={styles.stepNextBtn}
                                    onClick={onNextStep}
                                    disabled={isTyping}
                                >
                                    继续
                                </button>
                            </div>
                        )}
                    </>
                ) : isWaitingForData ? (
                    <>
                        <div className={styles.stepModalHeader}>
                            <span className={styles.stepTypeLabel}>旁白</span>
                        </div>
                        <div className={styles.stepModalBody}>
                            <p>
                                <span className={styles.cursor}></span>
                            </p>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
});

StepModal.displayName = 'StepModal';

export default StepModal;

