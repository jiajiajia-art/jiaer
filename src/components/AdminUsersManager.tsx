import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import adminUsersApi, { type AdminUserItem } from '../api/admin/adminUsersApi';
import { normalizeUserRole } from '../utils/userRoles';
import Pagination from './Pagination';
import PageSectionHeader from './Admin/PageSectionHeader';
import workbenchStyles from './Admin/MetricSummary.module.css';
import styles from './AdminUsersManager.module.css';

const PAGE_SIZE_OPTIONS = [20, 30, 40, 50] as const;

const emptyPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

const AdminUsersManager: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [pagination, setPagination] = useState(emptyPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const getRoleLabel = (role: string) => {
    const normalized = normalizeUserRole(role);
    return t(`adminUsers.roles.${normalized}`, { defaultValue: normalized });
  };

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminUsersApi.listUsers({
        page,
        pageSize,
        keyword: keyword.trim() || undefined,
        role: roleFilter || undefined,
      });
      if (response.data.success && response.data.data) {
        setUsers(response.data.data.users || []);
        setAssignableRoles(response.data.data.assignableRoles || []);
        const nextPagination = response.data.data.pagination || emptyPagination;
        setPagination(nextPagination);
        if (nextPagination.page !== page) {
          setPage(nextPagination.page);
        }
      }
    } catch (error) {
      console.error('[AdminUsersManager] load failed', error);
      toast.error(t('adminUsers.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [keyword, page, pageSize, roleFilter, t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    if (page === 1) {
      void loadUsers();
      return;
    }
    setPage(1);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

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

  const showPaginationBar = pagination.total > 0;
  const showFullPagination = pagination.total > 20;

  return (
    <section className={styles.root}>
      <PageSectionHeader
        title={t('adminUsers.title')}
        description={t('adminUsers.desc')}
      />

      <div className={workbenchStyles.toolbar}>
        <input
          className={styles.input}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('adminUsers.searchPlaceholder')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
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
        <button type="button" className={styles.searchButton} onClick={handleSearch}>
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

      {showPaginationBar ? (
        <div className={styles.paginationBar}>
          {showFullPagination ? (
            <label className={styles.pageSizeField}>
              <span>{t('adminUsers.pageSizeLabel')}</span>
              <select
                className={styles.select}
                value={String(pageSize)}
                disabled={isLoading || updatingUserId !== null}
                onChange={(event) => handlePageSizeChange(Number(event.target.value) || 20)}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className={styles.paginationHint}>{t('adminUsers.paginationHiddenHint')}</div>
          )}

          {showFullPagination ? (
            <Pagination
              className={styles.paginationWrap}
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              disabled={isLoading || updatingUserId !== null}
              summary={t('adminUsers.paginationSummary', {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
              })}
            />
          ) : null}

          {showFullPagination && pagination.totalPages <= 1 ? (
            <div className={styles.paginationSummaryOnly}>
              {t('adminUsers.paginationSummary', {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
              })}
            </div>
          ) : null}

          {!showFullPagination ? (
            <div className={styles.paginationSummaryOnly}>
              {t('adminUsers.paginationTotalOnly', { total: pagination.total })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default AdminUsersManager;
