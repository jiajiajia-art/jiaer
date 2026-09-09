import React from 'react';
import CommentAdminManager from '../components/admin/CommentAdminManager';
import styles from '../page/AdminPanel.module.css';

const CommentAdminPage: React.FC = () => {
    return (
        <div className={styles.pageRoot}>
            <div className={styles.pageBody}>
                <div className={styles.contentArea}>
                    <CommentAdminManager />
                </div>
            </div>
        </div>
    );
};

export default CommentAdminPage;
