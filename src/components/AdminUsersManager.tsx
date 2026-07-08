import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import adminUsersApi, { type AdminUserItem } from '../api/admin/adminUsersApi';
import { normalizeUserRole } from '../utils/userRoles';
import adminStyles from '../page/AdminPanel.module.css';
import styles from './AdminUsersManager.module.css';

const AdminUsersManager: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const getRoleLabel = (role: string) => {
    const normalized = normalizeUserRole(role);
    return t(`adminUsers.roles.${normalized}`, { defaultValue: normalized });
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await adminUsersApi.listUsers({
        page: 1,
        pageSize: 50,
        keyword: keyword.trim() || undefined,
        role: roleFilter || undefined,
      });
      if (response.data.success && response.data.data) {
        setUsers(response.data.data.users || []);
        setAssignableRoles(response.data.data.assignableRoles || []);
      }
    } catch (error) {
      console.error('[AdminUsersManager] load failed', error);
      toast.error(t('adminUsers.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingUserId(userId);
    try {
      const response = await adminUsersApi.updateUserRole(userId, role);
      if (response.data.success) {
        toast.success(t('adminUsers.updateSuccess'));
        await loadUsers();
      } else {
        toast.error(response.data.message || t('adminUsers.updateFailed'));
      }
    } catch (error) {
      console.error('[AdminUsersManager] update failed', error);
      toast.error(t('adminUsers.updateFailed'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <section className={styles.root}>
      <div className={adminStyles.heroCard}>
        <div className={adminStyles.heroTitle}>{t('adminUsers.title')}</div>
        <p className={adminStyles.heroDesc}>{t('adminUsers.desc')}</p>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.input}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('adminUsers.searchPlaceholder')}
        />
        <select
          className={styles.select}
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="">{t('adminUsers.allRoles')}</option>
          {assignableRoles.map((role) => (
            <option key={role} value={role}>{getRoleLabel(role)}</option>
          ))}
        </select>
        <button type="button" className={styles.searchButton} onClick={() => void loadUsers()}>
          {t('adminUsers.search')}
        </button>
      </div>

      {isLoading ? <div className={styles.emptyState}>{t('creatorStats.loading')}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('adminUsers.nickname')}</th>
              <th>{t('adminUsers.userId')}</th>
              <th>{t('adminUsers.phone')}</th>
              <th>{t('adminUsers.role')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId}>
                <td>{user.nickname || '—'}</td>
                <td>{user.userId}</td>
                <td>{user.phoneNumber || '—'}</td>
                <td>
                  <select
                    className={styles.select}
                    value={normalizeUserRole(user.role)}
                    disabled={updatingUserId === user.userId}
                    onChange={(event) => void handleRoleChange(user.userId, event.target.value)}
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>{getRoleLabel(role)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && users.length === 0 ? <div className={styles.emptyState}>{t('adminUsers.noUsers')}</div> : null}
      </div>
    </section>
  );
};

export default AdminUsersManager;
