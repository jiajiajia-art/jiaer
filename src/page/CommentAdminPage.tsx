import React from 'react';
import CommentAdminManager from '../components/Admin/CommentAdminManager';
import styles from '../page/AdminPanel.module.css';
import AdminShell from '../components/admin-shell/AdminShell';

const CommentAdminPage: React.FC = () => {
    return (
        <AdminShell mode="admin" activeKey="comments">
        <div className={styles.pageRoot}>
            <div className={styles.pageBody}>
                <div className={styles.contentArea}>
                    <CommentAdminManager />
                </div>
            </div>
        </div>
        </AdminShell>
    );
};

export default CommentAdminPage;
