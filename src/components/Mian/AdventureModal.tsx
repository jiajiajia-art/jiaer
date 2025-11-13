import styles from './adventureModal.module.css';
interface AdventureModalProps {
    isOpen: boolean;
    onClose: () => void;
}
const AdventureModal: React.FC<AdventureModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

        // const handleGenerate = async () => {
    //     const response = await fetch(`${HOST_ADDRESS}/api/backend/novel/generate`, {
    //         method: 'POST',
    //         body: JSON.stringify({ 
    //             sessionId: sessionId,
    //             fileId: pdfFileId,
    //             title: title,
    //             theme: 'adventure',
    //             chapterCount: 5,
    //             style: 'classic',
    //         })
    //     });
    //     if (!response.ok) {
    //         console.error('❌ 小说生成失败:', response.statusText);
    //         return;
    //     }
    //     const data = await response.json();
    // };
    return (
        <div className={styles.adventureModal}>
            <div className={styles.adventureModalContent}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </button>
                <div className={styles.modalTitle}>
                    <h1>冒险笔记</h1>
                </div>
            </div>
        </div>
    );
}

export default AdventureModal;