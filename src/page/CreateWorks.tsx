import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import CreatorWorksPanel, { type WorksTabKey } from '../components/Create/CreatorWorksPanel';
import createStyles from './Create.module.css';
import styles from './CreateWorks.module.css';

const isWorksTabKey = (value: string | null): value is WorksTabKey => (
    value === 'all' || value === 'published' || value === 'drafts' || value === 'favorites'
);

/**
 * 书架统一承载全部作品、已发布、草稿箱与收藏，同类列表只保留一处。
 * 功能注释：顶/底栏避让交给 AppPageShell，本页不再写死 navbar 上边距。
 */
const CreateWorks: React.FC = () => {
    const [searchParams] = useSearchParams();

    const initialTab = useMemo<WorksTabKey>(() => {
        const tab = searchParams.get('tab');
        return isWorksTabKey(tab) ? tab : 'all';
    }, [searchParams]);

    return (
        <AppPageShell
            shellClassName={createStyles.pageRoot}
            mainClassName={`${createStyles.mainContent} ${styles.mainContent}`}
        >
            <div className={createStyles.main}>
                <CreatorWorksPanel mode="full" initialTab={initialTab} />
            </div>
            <FooterArea />
        </AppPageShell>
    );
};

export default CreateWorks;
