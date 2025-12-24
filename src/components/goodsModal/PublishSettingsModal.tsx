import React, { useState } from 'react';
import styles from './PublishSettingsModal.module.css';

interface PublishSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (price: number | null, isFree: boolean) => void;
}

const PublishSettingsModal: React.FC<PublishSettingsModalProps> = ({
    isOpen,
    onClose,
    onPublish,
}) => {
    const [price, setPrice] = useState<string>('0');
    const [isFree, setIsFree] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = () => {
        const priceValue = isFree ? null : (price ? parseFloat(price) : null);
        onPublish(priceValue, isFree);
    };

    const handleFreeChange = (checked: boolean) => {
        setIsFree(checked);
        if (checked) {
            setPrice('');
        }
    };

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.publishModal}>
                <div className={styles.publishModalContent}>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <img src={`${import.meta.env.BASE_URL}data/assets/关闭.png`} alt="关闭" />
                    </button>
                    <h2 className={styles.modalTitle}>发布设置</h2>

                    <div className={styles.formContent}>
                        <div className={styles.formGroup}>
                            <label htmlFor="price" className={styles.label}>价格（积分）</label>
                            <input
                                type="number"
                                id="price"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="请输入价格"
                                min="0"
                                step="0.01"
                                className={styles.priceInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                            <span className={styles.checkboxLabel}>免费游戏</span>
                                <input
                                    type="checkbox"
                                    checked={isFree}
                                    onChange={(e) => handleFreeChange(e.target.checked)}
                                    className={styles.freeCheckbox}
                                />
                            </label>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button className={styles.publishBtn} onClick={handleSubmit}>
                                发布
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublishSettingsModal;

