import React from 'react';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';
import styles from './ListPaginationBar.module.css';

export const LIST_PAGE_SIZE_OPTIONS = [20, 30, 40, 50] as const;

export interface ListPaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ListPaginationBarProps {
  pagination: ListPaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
  i18nPrefix?: 'adminUsers' | 'operator.pagination';
}

const ListPaginationBar: React.FC<ListPaginationBarProps> = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  i18nPrefix = 'adminUsers',
}) => {
  const { t } = useTranslation();
  const translate = (key: string, options?: Record<string, unknown>) =>
    t(`${i18nPrefix}.${key}`, options);

  if (pagination.total <= 0) {
    return null;
  }

  const showFullPagination = pagination.total > 20;

  return (
    <div className={styles.paginationBar}>
      {showFullPagination ? (
        <label className={styles.pageSizeField}>
          <span>{translate('pageSizeLabel')}</span>
          <select
            className={styles.select}
            value={String(pagination.pageSize)}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value) || 20)}
          >
            {LIST_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className={styles.paginationHint}>{translate('paginationHiddenHint')}</div>
      )}

      {showFullPagination ? (
        <Pagination
          className={styles.paginationWrap}
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          disabled={disabled}
          summary={translate('paginationSummary', {
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
          })}
        />
      ) : null}

      {showFullPagination && pagination.totalPages <= 1 ? (
        <div className={styles.paginationSummaryOnly}>
          {translate('paginationSummary', {
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
          })}
        </div>
      ) : null}

      {!showFullPagination ? (
        <div className={styles.paginationSummaryOnly}>
          {translate('paginationTotalOnly', { total: pagination.total })}
        </div>
      ) : null}
    </div>
  );
};

export function buildListPagination(
  page: number,
  pageSize: number,
  total: number,
): ListPaginationState {
  const safePageSize = Math.max(1, pageSize);
  return {
    page,
    pageSize: safePageSize,
    total,
    totalPages: total > 0 ? Math.ceil(total / safePageSize) : 1,
  };
}

export default ListPaginationBar;
