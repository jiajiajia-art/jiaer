import React from 'react';
import styles from './GameDetailModal.module.css';
import type { LibraryData } from '../api/home/libraryData.type';

interface GameDetailModalProps {
    isOpen: boolean;
    game: LibraryData;
    onClose: () => void;
    onStart: () => void;
}

const GameDetailModal: React.FC<GameDetailModalProps> = ({
    isOpen,
    game,
    onClose,
    onStart,
}) => {
    if (!isOpen || !game) return null;

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <button className={styles.detailModalClose} onClick={onClose}>
                <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
            </button>
            <div className={styles.gameDetailModal}>
                <h2 className={styles.detailMainTitle}>剧本详情</h2>

                <div className={styles.detailThreeColumns}>
                    <div className={styles.detailLeftColumn}>
                        {game.cover_url && (
                            <img
                                className={styles.detailLeftImage}
                                src={game.cover_url}
                                alt="游戏封面"
                            />
                        )}
                    </div>

                    <div className={styles.detailMiddleColumn}>
                        <h3 className={styles.detailGameTitle}>
                            {(game.title || '未命名游戏').toUpperCase()}
                        </h3>

                        <div className={styles.detailGameType}>
                            RPG
                        </div>

                        <div className={styles.detailDescription}>
                            {game.description ? <p>{game.description}</p> : <p>暂无描述</p>}
                        </div>

                        <div className={styles.detailAuthor}>
                            作者：{game.authorName || '未知作者'}
                        </div>
                    </div>

                    <div className={styles.detailRightColumn}>
                        <div className={styles.priceSection}>
                            <div className={styles.priceTitle}>特惠价格</div>
                            <div className={styles.priceValue}>
                                ￥{game.special_price_amount ?? game.price_amount ?? 0}
                            </div>
                            <button className={styles.unlockBtn}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/解锁剧本按钮.png`}
                                    alt="解锁剧本"
                                />
                            </button>
                        </div>

                        <div className={styles.startGameSection}>
                            <div className={styles.gameRating}>
                                <div className={styles.ratingLabel}>
                                    {(game.rating_avg ?? '9.0')}
                                    <span className={styles.ratingLabelUnit}>分</span>
                                </div>
                                <div className={styles.ratingStars}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <img
                                            key={star}
                                            src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/星星.png`}
                                            alt="星星"
                                            className={styles.starIcon}
                                        />
                                    ))}
                                </div>
                                <div className={styles.ratingScore}>
                                    {(game.rating_count ?? 0)}人评价
                                </div>
                            </div>
                            <button className={styles.startGameBtn} onClick={onStart}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/开始游戏按钮.png`}
                                    alt="开始游戏"
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameDetailModal;

