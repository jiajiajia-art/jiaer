import React, { useState, useEffect } from 'react';
import styles from './PriceAdjustmentModal.module.css';

interface PriceAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPrice?: number | null;
    currentSpecialPrice?: number | null;
    onSave: (price: number | null, specialPrice: number | null) => void;
}

const PriceAdjustmentModal: React.FC<PriceAdjustmentModalProps> = ({
    isOpen,
    onClose,
    currentPrice = null,
    currentSpecialPrice = null,
    onSave,
}) => {
    const [originalPrice, setOriginalPrice] = useState<string>('');
    const [specialPrice, setSpecialPrice] = useState<string>('');
    const [isFree, setIsFree] = useState(false);
    const [hasSpecialPrice, setHasSpecialPrice] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // 初始化表单数据，显示当前价格
            setOriginalPrice(currentPrice?.toString() || '');
            setSpecialPrice(currentSpecialPrice?.toString() || '');
            setIsFree((currentPrice === 0 || currentPrice === null) && (currentSpecialPrice === 0 || currentSpecialPrice === null));
            // 如果当前有特惠价格，则勾选特惠价格复选框
            setHasSpecialPrice(currentSpecialPrice !== null && currentSpecialPrice !== undefined);
        }
    }, [isOpen, currentPrice, currentSpecialPrice]);

    if (!isOpen) return null;

    const handleFreeChange = (checked: boolean) => {
        setIsFree(checked);
        if (checked) {
            setOriginalPrice('');
            setSpecialPrice('');
            setHasSpecialPrice(false);
        }
    };

    const handleSpecialPriceToggle = (checked: boolean) => {
        setHasSpecialPrice(checked);
        if (!checked) {
            setSpecialPrice('');
        }
    };

    const handleSubmit = () => {
        if (isFree) {
            onSave(null, null);
        } else {
            const priceValue = originalPrice ? parseFloat(originalPrice) : null;
            // 如果未启用特惠价格，直接设置为 null
            const specialValue = hasSpecialPrice && specialPrice ? parseFloat(specialPrice) : null;
            
            // 验证：特惠价格不能大于原价
            if (specialValue !== null && priceValue !== null && specialValue > priceValue) {
                alert('特惠价格不能大于原价');
                return;
            }
            
            // 验证：如果设置了特惠价格，必须设置原价
            if (specialValue !== null && priceValue === null) {
                alert('设置特惠价格时，必须同时设置原价');
                return;
            }
            
            onSave(priceValue, specialValue);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitle}>价格调整</div>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label htmlFor="originalPrice" className={styles.label}>
                            <img 
                                src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} 
                                alt="金币" 
                                className={styles.labelIcon}
                            />
                            原价（积分）
                        </label>
                        <input
                            type="number"
                            id="originalPrice"
                            value={originalPrice}
                            onChange={(e) => setOriginalPrice(e.target.value)}
                            placeholder={currentPrice !== null && currentPrice !== undefined ? `当前：${currentPrice}` : '请输入原价'}
                            min="0"
                            step="1"
                            disabled={isFree}
                            className={styles.priceInput}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <div className={styles.specialPriceHeader}>
                            <label htmlFor="specialPrice" className={styles.label}>
                                <img 
                                    src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} 
                                    alt="金币" 
                                    className={styles.labelIcon}
                                />
                                特惠价格（积分，可选）
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={hasSpecialPrice}
                                    onChange={(e) => handleSpecialPriceToggle(e.target.checked)}
                                    className={styles.freeCheckbox}
                                    disabled={isFree}
                                />
                                <span className={styles.checkboxText}>启用特惠</span>
                            </label>
                        </div>
                        <input
                            type="number"
                            id="specialPrice"
                            value={specialPrice}
                            onChange={(e) => setSpecialPrice(e.target.value)}
                            placeholder={currentSpecialPrice !== null && currentSpecialPrice !== undefined ? `当前：${currentSpecialPrice}` : '请输入特惠价格'}
                            min="0"
                            step="1"
                            disabled={isFree || !hasSpecialPrice}
                            className={styles.priceInput}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={isFree}
                                onChange={(e) => handleFreeChange(e.target.checked)}
                                className={styles.freeCheckbox}
                            />
                            <span className={styles.checkboxText}>设为免费</span>
                        </label>
                    </div>
                </div>
                <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        取消
                    </button>
                    <button className={styles.saveBtn} onClick={handleSubmit}>
                        确认
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PriceAdjustmentModal;
