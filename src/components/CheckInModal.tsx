import React from 'react';
import styles from './CheckInModal.module.css';
import { toast, Toaster } from 'react-hot-toast';
import { auth } from '../api/account/authApi';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleCheckIn = async () => {
        const response = await auth.checkIn();
        if (response.data.success) {
            toast.success('签到成功，获得10积分');
            setTimeout(() => {
                onClose();
            }, 1000);
        } else {
            const errorMessage = response.data.message || '签到失败';
            toast.error(errorMessage);
        }
    };

    return (
        <div className={styles.checkInModalOverlay} onClick={onClose}>
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
            <div className={styles.checkInModalContent} onClick={(e) => e.stopPropagation()}>
                {/* 图片 */}
                <div className={styles.checkInModalImage}>
                    <img
                        src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                        alt="签到"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
                        }}
                    />
                </div>

                {/* 文字内容 */}
                <div className={styles.checkInModalText}>
                    <div className={styles.checkInModalTitle}>每日签到</div>
                    <div className={styles.checkInModalDesc}>
                        签到即可获得 <span className={styles.checkInPoints}>10积分</span>
                    </div>
                </div>

                {/* 按钮区域 */}
                <div className={styles.checkInModalButtons}>
                    <button
                        className={styles.checkInModalCancelBtn}
                        onClick={onClose}
                    >
                        稍后
                    </button>
                    <button
                        className={styles.checkInModalCheckInBtn}
                        onClick={handleCheckIn}
                    >
                        立即签到
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckInModal;

