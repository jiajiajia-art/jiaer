import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Pagination, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import adminManualAdjustmentsApi, {
  ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE,
} from '../api/admin/adminManualAdjustmentsApi';
import type {
  AdminManualAdjustmentCurrency,
  AdminManualAdjustmentHistoryItem,
  AdminManualAdjustmentPage,
} from '../api/admin/adminManualAdjustmentsApi';
import { getApiErrorMessage } from '../utils/error';
import styles from './AdminManualAdjustmentHistory.module.css';

type AdminManualAdjustmentHistoryProps = {
  currency: AdminManualAdjustmentCurrency;
  refreshKey: number;
};

const EMPTY_PAGE: AdminManualAdjustmentPage = {
  items: [],
  page: 1,
  pageSize: ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

function formatAccount(account: AdminManualAdjustmentHistoryItem['operator']) {
  return `${account.nickname || '未命名用户'}（${account.userCode || '-'}）`;
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false });
}

const AdminManualAdjustmentHistory: React.FC<AdminManualAdjustmentHistoryProps> = ({
  currency,
  refreshKey,
}) => {
  const [data, setData] = useState<AdminManualAdjustmentPage>(EMPTY_PAGE);
  const [requestedPage, setRequestedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const currencyLabel = currency === 'points' ? '织梦豆' : 'KK币';

  const loadPage = useCallback(async (page: number) => {
    setRequestedPage(page);
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = currency === 'points'
        ? await adminManualAdjustmentsApi.listPoints(page)
        : await adminManualAdjustmentsApi.listDiamonds(page);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || `特殊${currencyLabel}变更记录加载失败`);
      }
      setData(response.data.data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, `特殊${currencyLabel}变更记录加载失败`));
    } finally {
      setIsLoading(false);
    }
  }, [currency, currencyLabel]);

  useEffect(() => {
    setData(EMPTY_PAGE);
    void loadPage(1);
  }, [loadPage, refreshKey]);

  const columns: TableColumnsType<AdminManualAdjustmentHistoryItem> = [
    {
      title: '操作人',
      key: 'operator',
      render: (_, item) => formatAccount(item.operator),
    },
    {
      title: '变更用户',
      key: 'targetUser',
      render: (_, item) => formatAccount(item.targetUser),
    },
    {
      title: '变更情况',
      key: 'change',
      render: (_, item) => (
        <Typography.Text type={item.changeType === 'increment' ? 'success' : 'danger'} strong>
          {item.changeType === 'increment' ? '增加' : '扣减'} {item.amount} {currencyLabel}
        </Typography.Text>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (remark: string | null) => remark || '-',
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatTime,
    },
  ];

  return (
    <Card
      title={`特殊${currencyLabel}变更记录`}
      extra={<Typography.Text type="secondary">共 {data.total} 条</Typography.Text>}
      className={styles.historyCard}
    >
      <Typography.Paragraph type="secondary" className={styles.description}>
        展示全平台由管理员执行的特殊{currencyLabel}变更，每页 10 条。
      </Typography.Paragraph>

      {errorMessage ? (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          action={<Button size="small" onClick={() => void loadPage(requestedPage)}>重新加载</Button>}
        />
      ) : (
        <Table<AdminManualAdjustmentHistoryItem>
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: '暂无特殊变更记录' }}
          scroll={{ x: 760 }}
          size="middle"
        />
      )}

      {data.total > 0 && (
        <div className={styles.paginationRow}>
          <Pagination
            current={requestedPage}
            pageSize={ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE}
            total={data.total}
            showSizeChanger={false}
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            onChange={(page) => void loadPage(page)}
            disabled={isLoading}
          />
        </div>
      )}
    </Card>
  );
};

export default AdminManualAdjustmentHistory;
