import { authFetch } from '../../api/base';
import styles from './adventureModal.module.css';
import { useGameStore } from '../../store/gameStore';
import { useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface AdventureModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface NovelChapter {
    id: string;
    number: number;
    title: string;
    wordCount: number;
    preview: string;
}

interface NovelData {
    novelId: string;
    title: string;
    theme: string;
    style: string;
    language: string;
    chapterCount: number;
    totalWordCount: number;
    chapters: NovelChapter[];
    createdAt: string;
}

const AdventureModal: React.FC<AdventureModalProps> = ({ isOpen, onClose }) => {
    const { sessionId } = useGameStore();
    const [novelData, setNovelData] = useState<NovelData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleGenerate = useCallback(async () => {
        if (!sessionId) {
            console.error('❌ 没有 sessionId，无法生成小说');
            setError('缺少会话ID，无法生成小说');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authFetch(`/api/backend/novel/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sessionId: sessionId,
                    title: '冒险笔记',
                    theme: 'adventure',
                    chapterCount: 5,
                    style: 'classic',
                })
            });

            const result = await response.json();
            console.log(result);
            

            if (!response.ok) {
                // 尝试获取错误详情
                const errorMessage = result.message || result.error || `小说生成失败: ${response.statusText}`;
                throw new Error(errorMessage);
            }
            
            if (result.success && result.data) {
                setNovelData(result.data);
            } else {
                throw new Error(result.message || '小说生成失败');
            }
        } catch (err) {
            console.error('❌ 小说生成失败:', err);
            setError(err instanceof Error ? err.message : '生成小说时发生未知错误');
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    // 当弹窗打开时，如果没有数据则生成小说
    useEffect(() => {
        if (isOpen && !novelData && !isLoading && sessionId) {
            handleGenerate();
        }
    }, [isOpen, sessionId, novelData, isLoading, handleGenerate]);

    // 当弹窗关闭时，重置状态（可选，根据需求决定是否保留数据）
    useEffect(() => {
        if (!isOpen) {
            // 可以选择保留数据或清空
            // setNovelData(null);
            // setError(null);
        }
    }, [isOpen]);

    // 自动滚动到底部
    useEffect(() => {
        if (contentRef.current && novelData) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [novelData]);

    if (!isOpen) return null;
    
    return (
        <div className={styles.adventureModal}>
            <div className={styles.adventureModalContent}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </button>
                <div className={styles.modalTitle}>
                    <h1>{novelData?.title || '冒险笔记'}</h1>
                </div>

                <div className={styles.contentArea} ref={contentRef}>
                    {isLoading && (
                        <div className={styles.loadingContainer}>
                            <p>正在生成小说...</p>
                        </div>
                    )}

                    {error && (
                        <div className={styles.errorContainer}>
                            <p>{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && novelData && (
                        <div className={styles.novelContent}>
                            {novelData.chapters.map((chapter) => (
                                <div key={chapter.id} className={styles.chapter}>
                                    <h2 className={styles.chapterTitle}>
                                        第{chapter.number}章: {chapter.title}
                                    </h2>
                                    <div className={styles.chapterPreview}>
                                        <ReactMarkdown>{chapter.preview}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdventureModal;