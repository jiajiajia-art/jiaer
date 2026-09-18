import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import CreatorWorksPanel, { type WorksTabKey } from '../components/Create/CreatorWorksPanel';
import createStyles from './Create.module.css';
import styles from './CreateWorks.module.css';

const isWorksTabKey = (value: string | null): value is WorksTabKey => (
    value === 'published' || value === 'drafts' || value === 'favorites'
);

/**
 * 创作中心「全部」作品独立页：完整列表 + 每页 10 条分页。
 */
const CreateWorks: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const initialTab = useMemo<WorksTabKey>(() => {
        const tab = searchParams.get('tab');
        return isWorksTabKey(tab) ? tab : 'published';
    }, [searchParams]);

    return (
        <div className={createStyles.pageRoot}>
            <Navbar />

            <div className={`${createStyles.mainContent} ${styles.mainContent}`}>
                <div className={createStyles.main}>
                    <section className={`${createStyles.creatorHeroSection} ${styles.heroSection}`}>
                        <div className={`${createStyles.creatorHeroCard} ${styles.heroCard}`}>
                            <button
                                type="button"
                                className={styles.backToCreateButton}
                                onClick={() => navigate('/profile')}
                            >
                                <span className={styles.backChevron} aria-hidden="true" />
                                {t('create.worksBackToProfile')}
                            </button>
                        </div>
                    </section>

                    <CreatorWorksPanel mode="full" initialTab={initialTab} />
                </div>
            </div>

            <MobileBottomNav />
            <FooterArea />
        </div>
    );
};

export default CreateWorks;
