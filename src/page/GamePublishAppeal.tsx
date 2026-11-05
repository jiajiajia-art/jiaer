import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoArrowBack, IoCheckmarkCircle, IoDocumentTextOutline, IoTimeOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import gamePublishAppealsApi from '../api/gamePublishAppeals/gamePublishAppealsApi';
import type {
  GamePublishAppeal as GamePublishAppealRecord,
  GamePublishAppealContext,
  GamePublishAppealStatus,
} from '../api/gamePublishAppeals/gamePublishAppeals.type';
import { getApiErrorMessage } from '../utils/error';
import { getImageUrl } from '../utils/constants';
import styles from './GamePublishAppeal.module.css';

const statusLabels: Record<GamePublishAppealStatus, string> = {
  pending: '等待运营处理',
  approved: '已允许重新发布',
  rejected: '申诉已驳回',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const resolveCover = (context: GamePublishAppealContext | null) => {
  const cover = context?.game.portraitCoverUrl || context?.game.coverUrl;
  return cover ? getImageUrl(cover) : `${import.meta.env.BASE_URL}data/events/welcome.png`;
};

const AppealHistoryItem: React.FC<{ appeal: GamePublishAppealRecord }> = ({ appeal }) => (
  <article className={styles.historyItem}>
    <header>
      <span className={`${styles.statusTag} ${styles[`status_${appeal.status}`]}`}>
        {statusLabels[appeal.status]}
      </span>
      <time>{formatDateTime(appeal.createdAt)}</time>
    </header>
    <div>
      <strong>申诉说明</strong>
      <p>{appeal.appealReason}</p>
    </div>
    {appeal.reviewRemark ? (
      <div className={styles.reviewResult}>
        <strong>运营备注</strong>
        <p>{appeal.reviewRemark}</p>
      </div>
    ) : null}
  </article>
);

const GamePublishAppeal: React.FC = () => {
  const navigate = useNavigate();
  const { fileId = '' } = useParams<{ fileId: string }>();
  const normalizedFileId = fileId.trim();
  const [context, setContext] = useState<GamePublishAppealContext | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadContext = useCallback(async () => {
    if (!normalizedFileId) {
      setLoadError('作品编号无效');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await gamePublishAppealsApi.getContext(normalizedFileId);
      setContext(response.data.data || null);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, '申诉信息加载失败，请稍后重试。'));
    } finally {
      setIsLoading(false);
    }
  }, [normalizedFileId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const trimmedReason = appealReason.trim();
  const remainingCount = 500 - appealReason.length;
  const canSubmit = Boolean(context?.canSubmit) && trimmedReason.length >= 10 && trimmedReason.length <= 500;
  const latestAppeal = context?.appeals[0] || null;
  const pageHint = useMemo(() => {
    if (context?.pendingAppeal) return '申诉已提交，运营处理后会通过站内消息通知你。';
    if (latestAppeal?.status === 'approved' && !context?.game.isPublishBlocked) {
      return '运营已解除发布限制。请返回作品编辑页，再次主动发布作品。';
    }
    if (context?.canSubmit) return '确认作品已根据下架原因完成修改，再向运营提交复核。';
    return '当前作品暂时不满足提交申诉的条件。';
  }, [context, latestAppeal]);

  const submitAppeal = async () => {
    if (!context?.canSubmit || isSubmitting) return;
    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      toast.error('申诉说明需填写 10 至 500 个字符。');
      return;
    }
    setIsSubmitting(true);
    try {
      await gamePublishAppealsApi.submitAppeal(context.game.fileId, trimmedReason);
      toast.success('申诉已提交');
      setAppealReason('');
      await loadContext();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '申诉提交失败，请稍后重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/create/works?tab=drafts')} aria-label="返回草稿箱">
            <IoArrowBack aria-hidden="true" />
          </button>
          <div>
            <span>重新发布复核</span>
            <h1>作品发布申诉</h1>
            <p>{pageHint}</p>
          </div>
        </header>

        {isLoading ? <div className={styles.stateBox}>正在加载申诉信息...</div> : null}
        {!isLoading && loadError ? (
          <div className={styles.stateBox}>
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadContext()}>重新加载</button>
          </div>
        ) : null}

        {!isLoading && context ? (
          <div className={styles.contentGrid}>
            <div className={styles.primaryColumn}>
              <section className={styles.workSection}>
                <img src={resolveCover(context)} alt="" />
                <div className={styles.workInfo}>
                  <span>{context.game.engine || '平台作品'}</span>
                  <h2>{context.game.title}</h2>
                  <div className={styles.workMeta}>
                    <span><IoDocumentTextOutline aria-hidden="true" />{context.game.fileId}</span>
                    <span><IoTimeOutline aria-hidden="true" />最近修改 {formatDateTime(context.game.updatedAt)}</span>
                  </div>
                </div>
              </section>

              <section className={styles.reasonSection}>
                <div className={styles.sectionHeading}>
                  <span>01</span>
                  <div>
                    <h2>原下架原因</h2>
                    <p>请逐项检查并完成修改后再提交。</p>
                  </div>
                </div>
                <div className={styles.reasonBox}>{context.game.takedownReason || '运营未填写具体下架原因'}</div>
              </section>

              {context.canSubmit ? (
                <section className={styles.formSection}>
                  <div className={styles.sectionHeading}>
                    <span>02</span>
                    <div>
                      <h2>申诉说明</h2>
                      <p>说明你修改了哪些内容，方便运营快速复核。</p>
                    </div>
                  </div>
                  <label className={styles.textareaField}>
                    <textarea
                      value={appealReason}
                      minLength={10}
                      maxLength={500}
                      onChange={(event) => setAppealReason(event.target.value)}
                      placeholder="请填写具体修改内容，至少 10 个字符"
                      disabled={isSubmitting}
                    />
                    <span className={remainingCount < 0 ? styles.countError : ''}>{appealReason.length}/500</span>
                  </label>
                  <button type="button" className={styles.submitButton} disabled={!canSubmit || isSubmitting} onClick={() => void submitAppeal()}>
                    <IoCheckmarkCircle aria-hidden="true" />
                    {isSubmitting ? '正在提交...' : '提交重新发布申诉'}
                  </button>
                </section>
              ) : (
                <section className={styles.resultSection}>
                  <IoCheckmarkCircle aria-hidden="true" />
                  <div>
                    <h2>{context.pendingAppeal ? '申诉处理中' : statusLabels[latestAppeal?.status || 'pending']}</h2>
                    <p>{pageHint}</p>
                  </div>
                </section>
              )}
            </div>

            <aside className={styles.historySection}>
              <div className={styles.sectionHeading}>
                <span>{String(context.appeals.length).padStart(2, '0')}</span>
                <div>
                  <h2>申诉记录</h2>
                  <p>审核结果与运营备注会保留在这里。</p>
                </div>
              </div>
              {context.appeals.length > 0
                ? context.appeals.map((appeal) => <AppealHistoryItem key={appeal.id} appeal={appeal} />)
                : <div className={styles.emptyHistory}>暂无申诉记录</div>}
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default GamePublishAppeal;

