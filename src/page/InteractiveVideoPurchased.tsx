import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoRefresh } from 'react-icons/io5';
import { MdPlayArrow, MdShoppingBag } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import CenteredPageHeader from '../components/Layout/CenteredPageHeader';
import {
    getPurchasedInteractiveVideoGames,
    toBackendAssetUrl,
    type InteractiveVideoPurchasedGame,
} from '../api/interactiveVideo';
import styles from './InteractiveVideoPurchased.module.css';

const formatPurchasedDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

const InteractiveVideoPurchased: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [games, setGames] = useState<InteractiveVideoPurchasedGame[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const loadPurchasedGames = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await getPurchasedInteractiveVideoGames();
            if (!response.data?.success) {
                throw new Error(t('interactiveVideoPurchased.loadFailed'));
            }
            setGames(response.data.data || []);
        } catch (error) {
            const maybeError = error as { response?: { data?: { message?: string } }; message?: string };
            setErrorMessage(
                maybeError.response?.data?.message
                || maybeError.message
                || t('interactiveVideoPurchased.loadFailedRetry'),
            );
            setGames([]);
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadPurchasedGames();
    }, [loadPurchasedGames]);

    const totals = useMemo(() => games.reduce(
        (result, game) => ({
            points: result.points + Number(game.pointsSpent || 0),
            diamonds: result.diamonds + Number(game.diamondsSpent || 0),
        }),
        { points: 0, diamonds: 0 },
    ), [games]);

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/create');
    };

    return (
        <div className={styles.pageRoot}>
            <main className={styles.main}>
                <section className={styles.shell}>
                    <div className={styles.headerDock}>
                        <CenteredPageHeader
                            title={t('interactiveVideoPurchased.title')}
                            backLabel={t('interactiveVideoPurchased.back')}
                            onBack={handleBack}
                            rightAction={{
                                label: t('interactiveVideoPurchased.refresh'),
                                icon: <IoRefresh aria-hidden="true" />,
                                onClick: () => void loadPurchasedGames(),
                                disabled: isLoading,
                            }}
                        />
                    </div>

                    <section className={styles.summarySection}>
                        <p className={styles.summaryDesc}>{t('interactiveVideoPurchased.description')}</p>
                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>{t('interactiveVideoPurchased.gameCount')}</span>
                                <strong className={styles.summaryValue}>{games.length}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>{t('interactiveVideoPurchased.pointsSpent')}</span>
                                <strong className={styles.summaryValue}>{totals.points}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.summaryLabel}>{t('interactiveVideoPurchased.diamondsSpent')}</span>
                                <strong className={styles.summaryValue}>{totals.diamonds}</strong>
                            </div>
                        </div>
                    </section>

                    {isLoading ? (
                        <section className={styles.statePanel}>
                            {t('interactiveVideoPurchased.loading')}
                        </section>
                    ) : errorMessage ? (
                        <section className={styles.statePanel}>
                            <h2>{t('interactiveVideoPurchased.loadFailedTitle')}</h2>
                            <p>{errorMessage}</p>
                            <button type="button" className={styles.primaryButton} onClick={() => void loadPurchasedGames()}>
                                <IoRefresh />
                                {t('interactiveVideoPurchased.retry')}
                            </button>
                        </section>
                    ) : games.length === 0 ? (
                        <section className={styles.statePanel}>
                            <MdShoppingBag className={styles.emptyIcon} />
                            <h2>{t('interactiveVideoPurchased.emptyTitle')}</h2>
                            <p>{t('interactiveVideoPurchased.emptyDesc')}</p>
                        </section>
                    ) : (
                        <section className={styles.gameList}>
                            {games.map((game) => {
                                const coverUrl = toBackendAssetUrl(game.coverUrl);
                                const directoryCount = game.directoryIds?.length || 0;
                                return (
                                    <article className={styles.gameCard} key={game.fileId}>
                                        <div className={styles.coverWrap}>
                                            {coverUrl ? (
                                                <img src={coverUrl} alt={game.title} loading="lazy" />
                                            ) : (
                                                <div className={styles.coverFallback}>
                                                    {game.title.slice(0, 1) || 'F'}
                                                </div>
                                            )}
                                            {game.isPublic === false ? (
                                                <span className={styles.offlineBadge}>
                                                    {t('interactiveVideoPurchased.offline')}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className={styles.cardBody}>
                                            <div className={styles.cardTitleRow}>
                                                <h2>{game.title || t('interactiveVideoPurchased.untitled')}</h2>
                                                <span>
                                                    {game.hasBuyout
                                                        ? t('interactiveVideoPurchased.buyout')
                                                        : t('interactiveVideoPurchased.directoryCount', { count: directoryCount })}
                                                </span>
                                            </div>
                                            <p className={styles.authorName}>
                                                {game.authorName || t('interactiveVideoPurchased.defaultAuthor')}
                                            </p>
                                            <dl className={styles.metaGrid}>
                                                <div>
                                                    <dt>{t('interactiveVideoPurchased.points')}</dt>
                                                    <dd>{game.pointsSpent || 0}</dd>
                                                </div>
                                                <div>
                                                    <dt>{t('interactiveVideoPurchased.diamonds')}</dt>
                                                    <dd>{game.diamondsSpent || 0}</dd>
                                                </div>
                                                <div>
                                                    <dt>{t('interactiveVideoPurchased.lastPurchased')}</dt>
                                                    <dd>{formatPurchasedDate(game.lastPurchasedAt)}</dd>
                                                </div>
                                            </dl>
                                            <button
                                                type="button"
                                                className={styles.primaryButton}
                                                onClick={() => navigate(`/interactive-video/${encodeURIComponent(game.fileId)}`)}
                                                disabled={game.isPublic === false}
                                            >
                                                <MdPlayArrow />
                                                {game.isPublic === false
                                                    ? t('interactiveVideoPurchased.unavailable')
                                                    : t('interactiveVideoPurchased.play')}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </section>
                    )}
                </section>
            </main>
            <MobileBottomNav hidden />
        </div>
    );
};

export default InteractiveVideoPurchased;
