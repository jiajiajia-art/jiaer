import React, { useMemo } from 'react';
import styles from './Pagination.module.css';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
    maxVisiblePages?: number;
    showPageNumbers?: boolean;
    summary?: React.ReactNode;
    className?: string;
    /** Create 页等深色背景使用 */
    variant?: 'default' | 'creator';
}

const clampPage = (page: number, totalPages: number): number => Math.min(Math.max(page, 1), totalPages);

const buildVisiblePages = (currentPage: number, totalPages: number, maxVisiblePages: number): number[] => {
    if (totalPages <= 0) return [];

    const safeMaxVisiblePages = Math.max(1, Math.floor(maxVisiblePages));
    if (totalPages <= safeMaxVisiblePages) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const halfWindow = Math.floor(safeMaxVisiblePages / 2);
    let startPage = currentPage - halfWindow;
    let endPage = startPage + safeMaxVisiblePages - 1;

    if (startPage < 1) {
        startPage = 1;
        endPage = safeMaxVisiblePages;
    }

    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = totalPages - safeMaxVisiblePages + 1;
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
};

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    disabled = false,
    maxVisiblePages = 5,
    showPageNumbers = true,
    summary,
    className = '',
    variant = 'default',
}) => {
    const safeTotalPages = Math.max(1, Math.floor(totalPages));
    const safeCurrentPage = clampPage(Math.floor(currentPage) || 1, safeTotalPages);

    const visiblePages = useMemo(
        () => buildVisiblePages(safeCurrentPage, safeTotalPages, maxVisiblePages),
        [maxVisiblePages, safeCurrentPage, safeTotalPages],
    );

    if (safeTotalPages <= 1) {
        return null;
    }

    const handlePageChange = (page: number) => {
        const nextPage = clampPage(page, safeTotalPages);
        if (disabled || nextPage === safeCurrentPage) return;
        onPageChange(nextPage);
    };

    return (
        <div
            className={`${styles.pagination} ${variant === 'creator' ? styles.paginationCreator : ''} ${className}`.trim()}
        >
            <div className={styles.controls} aria-label="分页导航">
                <button
                    type="button"
                    className={`${styles.navButton} ${styles.prevNextButton}`}
                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                    disabled={disabled || safeCurrentPage <= 1}
                    aria-label="上一页"
                >
                    上一页
                </button>

                {showPageNumbers ? (
                    visiblePages.map((page) => (
                        <button
                            key={page}
                            type="button"
                            className={`${styles.pageButton} ${page === safeCurrentPage ? styles.pageButtonActive : ''}`}
                            onClick={() => handlePageChange(page)}
                            disabled={disabled}
                            aria-current={page === safeCurrentPage ? 'page' : undefined}
                            aria-label={`第 ${page} 页`}
                        >
                            {page}
                        </button>
                    ))
                ) : null}

                <button
                    type="button"
                    className={`${styles.navButton} ${styles.prevNextButton}`}
                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                    disabled={disabled || safeCurrentPage >= safeTotalPages}
                    aria-label="下一页"
                >
                    下一页
                </button>
            </div>

            {summary ? <div className={styles.summary}>{summary}</div> : null}
        </div>
    );
};

export default Pagination;
