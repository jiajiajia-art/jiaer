import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import CreatorWorksPanel, { normalizeWorksTabKey, type WorksTabKey } from '../components/Create/CreatorWorksPanel';
import createStyles from './Create.module.css';
import styles from './CreateWorks.module.css';

/**
 * 书架统一承载全部作品、已发布与收藏；草稿出现在「全部」并用角标区分。
 * 功能注释：顶/底栏避让交给 AppPageShell，本页不再写死 navbar 上边距。
 */
const CreateWorks: React.FC = () => {
    const [searchParams] = useSearchParams();

    const initialTab = useMemo<WorksTabKey>(() => {
        return normalizeWorksTabKey(searchParams.get('tab'));
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
