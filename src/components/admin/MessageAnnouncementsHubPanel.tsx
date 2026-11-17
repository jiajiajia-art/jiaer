import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import styles from './CustomerServiceAdmin.module.css';

/** 功能注释：消息中心「公告」Tab；完整编辑仍在管理端公告页，避免拆散 AdminPanel 大块 UI */
const MessageAnnouncementsHubPanel: React.FC = () => {
  const navigate = useNavigate();
  const isAdmin = isAdminRole(useAuthStore((state) => state.user?.user?.role));

  return (
    <div className={styles.panel} data-customer-service="announcements-hub">
      <div className={styles.card}>
        <div className={styles.badge}>消息中心</div>
        <h2 className={styles.title}>全员公告</h2>
        <p className={styles.desc}>
          公告面向所有用户。定向通知请改用「定向站内信」；工单回复请用「意见反馈」。
        </p>
        {isAdmin ? (
          <>
            <p className={styles.desc}>完整的草稿、发布与历史记录仍在管理端公告编辑器中。</p>
            <button type="button" className={styles.btn} onClick={() => navigate('/admin')}>
              打开公告编辑器
            </button>
          </>
        ) : (
          <p className={styles.desc}>当前账号为运营角色，全员公告需由管理员在管理端发布。</p>
        )}
      </div>
    </div>
  );
};

export default MessageAnnouncementsHubPanel;
