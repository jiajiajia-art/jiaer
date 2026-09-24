import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import promotionApi from '../api/promotion/promotionApi';
import { getApiErrorMessage } from '../utils/error';
import type {
  AdminPromotionSubmissionFilters,
  AdminPromotionSubmissionPagination,
  HomePromotionTicker,
  PromotionActivity,
  PromotionActivityPayload,
  PromotionActivityPeriodFilter,
  PromotionReviewStatus,
  PromotionReviewStatusFilter,
  PromotionSubmission,
  PromotionSubmissionConfig,
  PromotionSubmissionLimitType,
} from '../api/promotion/promotion.type';
import Pagination from './Pagination';
import styles from './PromotionAdminManager.module.css';
import { getImageUrl } from '../utils/constants';
import { buildPromotionInternalLinkExample } from '../utils/promotionNavigation';
import { useImageCropper } from '../hooks/useImageCropper';
import ImageCropModal from './CommonModal/ImageCropModal';

type PromotionAdminView = 'create' | 'list' | 'reviews' | 'ticker';
type ReviewDraft = { reviewStatus: PromotionReviewStatus; reviewRemark: string };
type ReviewFilters = Required<Pick<AdminPromotionSubmissionFilters, 'activityPeriod' | 'reviewStatus' | 'keyword' | 'page'>> & { activityId?: number };
type SubmissionConfigField = {
  label: string;
  acceptKey: keyof PromotionSubmissionConfig;
  requireKey: keyof PromotionSubmissionConfig;
};

const emptyConfig: PromotionSubmissionConfig = {
  acceptTexts: false,
  acceptLinks: true,
  acceptImages: false,
  acceptVideos: false,
  requireTexts: false,
  requireLinks: false,
  requireImages: false,
  requireVideos: false,
};
const defaultReviewFilters: ReviewFilters = { activityId: undefined, activityPeriod: 'all', reviewStatus: 'all', keyword: '', page: 1 };
const emptyPagination: AdminPromotionSubmissionPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const submissionConfigFields: SubmissionConfigField[] = [
  { label: '上传文本', acceptKey: 'acceptTexts', requireKey: 'requireTexts' },
  { label: '上传链接', acceptKey: 'acceptLinks', requireKey: 'requireLinks' },
  { label: '上传图片', acceptKey: 'acceptImages', requireKey: 'requireImages' },
  { label: '上传视频', acceptKey: 'acceptVideos', requireKey: 'requireVideos' },
];
const statusLabelMap: Record<PromotionReviewStatus, string> = {
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核不通过',
  reward_pending: '奖励待下发',
  reward_issued: '奖励已下发',
};

const normalizeSubmissionConfig = (config?: Partial<PromotionSubmissionConfig>): PromotionSubmissionConfig => {
  const acceptTexts = Boolean(config?.acceptTexts);
  const acceptLinks = Boolean(config?.acceptLinks);
  const acceptImages = Boolean(config?.acceptImages);
  const acceptVideos = Boolean(config?.acceptVideos);

  return {
    acceptTexts,
    acceptLinks,
    acceptImages,
    acceptVideos,
    requireTexts: acceptTexts && Boolean(config?.requireTexts),
    requireLinks: acceptLinks && Boolean(config?.requireLinks),
    requireImages: acceptImages && Boolean(config?.requireImages),
    requireVideos: acceptVideos && Boolean(config?.requireVideos),
  };
};

const createEmptyForm = (): PromotionActivityPayload => ({
  title: '',
  coverImageUrl: '',
  summary: '',
  detailLinkUrl: '',
  internalLinkUrl: '',
  submissionConfig: { ...emptyConfig },
  isLongTerm: true,
  startAt: null,
  endAt: null,
  submissionLimitType: 'unlimited',
  submissionLimitDays: null,
  submissionLimitCount: null,
  rewardPoints: 10,
  status: 'draft',
  sortOrder: 0,
});

const createEmptyHomeTicker = (): HomePromotionTicker => ({
  id: null,
  text: '',
  linkUrl: '/promotions',
  createdAt: null,
  updatedAt: null,
});

const formatTime = (value?: string | null) => {
  if (!value) return '未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const formatDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const normalizeDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const isValidDetailLink = (value: string) => !value.trim() || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
const isValidInternalLink = (value: string) => !value.trim() || value.startsWith('/');
const buildOncePerActivityLimitSummary = () => '活动期内限制一次';
const buildLimitSummary = (activity: PromotionActivity) => activity.submissionLimitType === 'rolling_window' ? `每 ${activity.submissionLimitDays} 天限 ${activity.submissionLimitCount} 次` : '活动期内无限次';
const buildTimeSummary = (activity: PromotionActivity) => activity.isLongTerm ? '长期活动' : `${formatTime(activity.startAt)} - ${formatTime(activity.endAt)}`;
const getSubmissionDisplayName = (submission: PromotionSubmission) => submission.nickname || submission.userCode || submission.phoneNumber || '-';
const getSubmissionStatusClass = (status: PromotionReviewStatus) => (
  status === 'approved' || status === 'reward_issued'
    ? styles.statusApproved
    : status === 'rejected'
      ? styles.statusRejected
      : ''
);
const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));
void buildLimitSummary;
const getSubmissionLimitSummary = (activity: PromotionActivity) => {
  if (activity.submissionLimitType === 'once_per_activity') {
    return buildOncePerActivityLimitSummary();
  }
  if (activity.submissionLimitType === 'rolling_window') {
    return `每 ${activity.submissionLimitDays} 天限 ${activity.submissionLimitCount} 次`;
  }
  return '活动期内无限次';
};

type PromotionAdminManagerProps = {
  pendingReviewCount: number;
  onRefreshCounts: () => Promise<void>;
};

const PromotionAdminManager: React.FC<PromotionAdminManagerProps> = ({ pendingReviewCount, onRefreshCounts }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ promotionView?: string }>();
  const currentView = (params.promotionView === 'create' || params.promotionView === 'reviews' || params.promotionView === 'list' || params.promotionView === 'ticker'
    ? params.promotionView
    : 'list') as PromotionAdminView;
  const buildLimitSummary = getSubmissionLimitSummary;

  const [activities, setActivities] = useState<PromotionActivity[]>([]);
  const [submissions, setSubmissions] = useState<PromotionSubmission[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [form, setForm] = useState<PromotionActivityPayload>(createEmptyForm());
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewState, setReviewState] = useState<Record<number, ReviewDraft>>({});
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>(defaultReviewFilters);
  const [appliedReviewFilters, setAppliedReviewFilters] = useState<ReviewFilters>(defaultReviewFilters);
  const [submissionPagination, setSubmissionPagination] = useState<AdminPromotionSubmissionPagination>(emptyPagination);
  const [detailSubmissionId, setDetailSubmissionId] = useState<number | null>(null);
  const [detailSubmission, setDetailSubmission] = useState<PromotionSubmission | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [savingReviewIds, setSavingReviewIds] = useState<Record<number, boolean>>({});
  const [homeTicker, setHomeTicker] = useState<HomePromotionTicker>(createEmptyHomeTicker());
  const [isLoadingHomeTicker, setIsLoadingHomeTicker] = useState(false);
  const [isSavingHomeTicker, setIsSavingHomeTicker] = useState(false);

  const {
    cropPreset,
    pendingCropFile,
    openCropper,
    closeCropper,
    handleCropComplete,
  } = useImageCropper({
    preset: 'promotionCover',
    onCropped: async (croppedFile) => {
      await handleUploadCover(croppedFile);
    },
  });

  const selectedActivity = useMemo(() => activities.find((item) => item.id === selectedActivityId) || null, [activities, selectedActivityId]);

  useEffect(() => {
    if (location.pathname === '/admin/promotions') {
      navigate('/admin/promotions/list', { replace: true });
    }
  }, [location.pathname, navigate]);

  const loadActivities = async () => {
    try {
      setIsLoadingActivities(true);
      const response = await promotionApi.adminList();
      setActivities((response.data.data || []).map((activity) => ({
        ...activity,
        submissionConfig: normalizeSubmissionConfig(activity.submissionConfig),
      })));
    } catch (error) {
      toast.error(getApiErrorMessage(error, '推广活动加载失败'));
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const loadSubmissions = async (filters: AdminPromotionSubmissionFilters) => {
    try {
      setIsLoadingSubmissions(true);
      const response = await promotionApi.adminSubmissions(filters);
      const payload = response.data.data;
      const list = payload?.list || [];
      setSubmissions(list);
      setSubmissionPagination(payload?.pagination || emptyPagination);
      setReviewState(() => {
        const nextState: Record<number, ReviewDraft> = {};
        list.forEach((item) => {
          nextState[item.id] = { reviewStatus: item.reviewStatus, reviewRemark: item.reviewRemark || '' };
        });
        return nextState;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, '推广投稿加载失败'));
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  useEffect(() => {
    if (currentView === 'reviews') {
      void loadSubmissions(appliedReviewFilters);
    }
  }, [appliedReviewFilters, currentView]);

  useEffect(() => {
    if (currentView === 'ticker') {
      void loadHomeTicker();
    }
  }, [currentView]);

  const handleSelectActivity = (activity: PromotionActivity) => {
    setSelectedActivityId(activity.id);
    setForm({
      title: activity.title,
      coverImageUrl: activity.coverImageUrl,
      summary: activity.summary,
      detailLinkUrl: activity.detailLinkUrl,
      internalLinkUrl: activity.internalLinkUrl || '',
      submissionConfig: normalizeSubmissionConfig(activity.submissionConfig),
      isLongTerm: activity.isLongTerm,
      startAt: activity.startAt,
      endAt: activity.endAt,
      submissionLimitType: activity.submissionLimitType,
      submissionLimitDays: activity.submissionLimitDays,
      submissionLimitCount: activity.submissionLimitCount,
      rewardPoints: activity.rewardPoints,
      status: activity.status,
      sortOrder: activity.sortOrder,
    });
    navigate('/admin/promotions/create');
  };

  const resetForm = () => {
    setSelectedActivityId(null);
    setForm(createEmptyForm());
  };

  const updateSubmissionConfigAccept = (field: SubmissionConfigField, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      submissionConfig: normalizeSubmissionConfig({
        ...prev.submissionConfig,
        [field.acceptKey]: checked,
        [field.requireKey]: checked ? prev.submissionConfig[field.requireKey] : false,
      }),
    }));
  };

  const updateSubmissionConfigRequired = (field: SubmissionConfigField, checked: boolean) => {
    setForm((prev) => {
      if (!prev.submissionConfig[field.acceptKey]) {
        return prev;
      }

      // 实现 必填状态联动
      return {
        ...prev,
        submissionConfig: normalizeSubmissionConfig({
          ...prev.submissionConfig,
          [field.requireKey]: checked,
        }),
      };
    });
  };

  const validateForm = () => {
    if (!form.title.trim()) return toast.error('活动标题不能为空'), false;
    if (!form.summary.trim()) return toast.error('活动摘要不能为空'), false;
    if (!form.coverImageUrl.trim()) return toast.error('活动封面不能为空'), false;
    if (!isValidDetailLink(form.detailLinkUrl)) return toast.error('活动详情跳转地址仅支持站内路径或 http/https 链接'), false;
    if (!isValidInternalLink(form.internalLinkUrl)) return toast.error('站内跳转链接必须以 / 开头'), false;
    if (!form.submissionConfig.acceptTexts && !form.submissionConfig.acceptLinks && !form.submissionConfig.acceptImages && !form.submissionConfig.acceptVideos) return toast.error('请至少启用一种投稿方式'), false;

    if (!form.isLongTerm) {
      if (!form.startAt || !form.endAt) return toast.error('非长期活动必须填写开始和结束时间'), false;
      if (new Date(form.startAt).getTime() >= new Date(form.endAt).getTime()) return toast.error('活动结束时间必须晚于开始时间'), false;
    }

    if (form.submissionLimitType === 'rolling_window') {
      if (!Number.isInteger(form.submissionLimitDays) || Number(form.submissionLimitDays) <= 0) return toast.error('投稿限制天数必须为大于 0 的整数'), false;
      if (!Number.isInteger(form.submissionLimitCount) || Number(form.submissionLimitCount) <= 0) return toast.error('投稿限制次数必须为大于 0 的整数'), false;
    }

    if (!Number.isInteger(form.rewardPoints) || Number(form.rewardPoints) <= 0) return toast.error('奖励织梦豆必须为大于 0 的整数'), false;
    return true;
  };

  const handleUploadCover = async (file: File | null) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await promotionApi.adminUploadImage(formData);
      setForm((prev) => ({ ...prev, coverImageUrl: response.data.data?.imageUrl || '' }));
      toast.success('活动封面上传成功');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '活动封面上传失败'));
    }
  };

  const handleUploadCoverForCrop = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }

    void openCropper(file).catch((error) => {
      console.error('open promotion cover cropper failed:', error);
      toast.error('Failed to load image.');
    });
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const normalizedForm: PromotionActivityPayload = {
      ...form,
      detailLinkUrl: form.detailLinkUrl.trim(),
      internalLinkUrl: form.internalLinkUrl.trim(),
      // 实现 投稿方式配置规范化
      submissionConfig: normalizeSubmissionConfig(form.submissionConfig),
    };
    try {
      setIsSaving(true);
      if (selectedActivityId) {
        await promotionApi.adminUpdate(selectedActivityId, normalizedForm);
        toast.success('推广活动更新成功');
      } else {
        await promotionApi.adminCreate(normalizedForm);
        toast.success('推广活动创建成功');
      }
      resetForm();
      await loadActivities();
      navigate('/admin/promotions/list');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '推广活动保存失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除这个推广活动吗？')) return;
    try {
      await promotionApi.adminDelete(id);
      toast.success('推广活动删除成功');
      if (selectedActivityId === id) resetForm();
      await loadActivities();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '推广活动删除失败'));
    }
  };

  const loadHomeTicker = async () => {
    try {
      setIsLoadingHomeTicker(true);
      const response = await promotionApi.adminGetHomeTicker();
      setHomeTicker(response.data.data || createEmptyHomeTicker());
    } catch (error) {
      toast.error(getApiErrorMessage(error, '首页滚动通知加载失败'));
    } finally {
      setIsLoadingHomeTicker(false);
    }
  };

  const handleSaveHomeTicker = async () => {
    const text = homeTicker.text.trim();
    const linkUrl = homeTicker.linkUrl.trim() || '/promotions';

    if (!text) {
      toast.error('首页滚动通知文案不能为空');
      return;
    }
    if (!isValidDetailLink(linkUrl)) {
      toast.error('首页滚动通知跳转地址仅支持站内路径或 http/https 链接');
      return;
    }

    try {
      setIsSavingHomeTicker(true);
      const response = await promotionApi.adminUpdateHomeTicker({ text, linkUrl });
      setHomeTicker(response.data.data || { ...homeTicker, text, linkUrl });
      toast.success('首页滚动通知保存成功');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '首页滚动通知保存失败'));
    } finally {
      setIsSavingHomeTicker(false);
    }
  };

  const handleReview = async (submissionId: number) => {
    const current = reviewState[submissionId];
    if (!current) return;
    try {
      const response = await promotionApi.adminReviewSubmission(submissionId, current);
      if (detailSubmissionId === submissionId && response.data.data) {
        setDetailSubmission(response.data.data);
      }
      toast.success('投稿状态更新成功');
      await Promise.all([
        loadSubmissions(appliedReviewFilters),
        onRefreshCounts().catch(() => undefined),
      ]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '投稿状态更新失败'));
    }
  };

  const updateSubmissionReviewDraft = (submissionId: number, patch: Partial<ReviewDraft>) => {
    setReviewState((prev) => {
      const current = prev[submissionId] || {
        reviewStatus: detailSubmission?.id === submissionId ? detailSubmission.reviewStatus : 'pending_review',
        reviewRemark: detailSubmission?.id === submissionId ? (detailSubmission.reviewRemark || '') : '',
      };
      return {
        ...prev,
        [submissionId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleReviewStatusChange = async (submissionId: number, nextStatus: PromotionReviewStatus) => {
    const previousDraft = reviewState[submissionId] || {
      reviewStatus: detailSubmission?.id === submissionId ? detailSubmission.reviewStatus : 'pending_review',
      reviewRemark: detailSubmission?.id === submissionId ? (detailSubmission.reviewRemark || '') : '',
    };
    if (previousDraft.reviewStatus === nextStatus || savingReviewIds[submissionId]) return;

    const nextDraft = { ...previousDraft, reviewStatus: nextStatus };
    // 实现状态下拉自动保存
    setReviewState((prev) => ({
      ...prev,
      [submissionId]: nextDraft,
    }));
    setSavingReviewIds((prev) => ({
      ...prev,
      [submissionId]: true,
    }));

    try {
      const response = await promotionApi.adminReviewSubmission(submissionId, nextDraft);
      if (detailSubmissionId === submissionId && response.data.data) {
        setDetailSubmission(response.data.data);
      }
      toast.success('投稿状态更新成功');
      await Promise.all([
        loadSubmissions(appliedReviewFilters),
        onRefreshCounts().catch(() => undefined),
      ]);
    } catch (error) {
      setReviewState((prev) => ({
        ...prev,
        [submissionId]: previousDraft,
      }));
      toast.error(getApiErrorMessage(error, '投稿状态更新失败'));
    } finally {
      setSavingReviewIds((prev) => {
        const nextState = { ...prev };
        delete nextState[submissionId];
        return nextState;
      });
    }
  };

  const handleOpenSubmissionDetail = async (submission: PromotionSubmission) => {
    setDetailSubmissionId(submission.id);
    setDetailSubmission(submission);
    updateSubmissionReviewDraft(submission.id, {
      // 实现详情与列表审核草稿同步
      reviewStatus: submission.reviewStatus,
      reviewRemark: submission.reviewRemark || '',
    });
    setIsDetailLoading(true);
    try {
      // 实现投稿详情弹窗数据加载
      const response = await promotionApi.adminSubmissionDetail(submission.id);
      const nextSubmission = response.data.data || submission;
      setDetailSubmission(nextSubmission);
      updateSubmissionReviewDraft(submission.id, {
        reviewStatus: nextSubmission.reviewStatus,
        reviewRemark: nextSubmission.reviewRemark || '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, '投稿详情加载失败'));
      setDetailSubmission(submission);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseSubmissionDetail = () => {
    setDetailSubmissionId(null);
    setDetailSubmission(null);
    setIsDetailLoading(false);
  };

  const handleReviewFilterChange = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => {
    setReviewFilters((prev) => ({
      ...prev,
      // 实现审核条件变更后重置分页
      [key]: value,
      page: 1,
    }));
  };

  const handleSearchSubmit = () => {
    // 实现审核列表筛选参数组装
    setAppliedReviewFilters({ ...reviewFilters, keyword: reviewFilters.keyword.trim(), page: 1 });
  };

  const handleResetReviewFilters = () => {
    setReviewFilters(defaultReviewFilters);
    setAppliedReviewFilters(defaultReviewFilters);
  };

  const handleReviewPageChange = (page: number) => {
    setReviewFilters((prev) => ({ ...prev, page }));
    setAppliedReviewFilters((prev) => ({ ...prev, page }));
  };

  const renderHeaderButtons = () => (
    <div className={styles.headerActions}>
      <button type="button" className={`${styles.secondaryButton} ${currentView === 'ticker' ? styles.secondaryButtonActive : ''}`} onClick={() => navigate('/admin/promotions/ticker')}>首页滚动通知</button>
      <button type="button" className={`${styles.secondaryButton} ${currentView === 'create' ? styles.secondaryButtonActive : ''}`} onClick={() => navigate('/admin/promotions/create')}>新增活动</button>
      <button type="button" className={`${styles.secondaryButton} ${currentView === 'list' ? styles.secondaryButtonActive : ''}`} onClick={() => navigate('/admin/promotions/list')}>管理活动</button>
      <div className={styles.headerButtonWrap}>
        <button type="button" className={`${styles.secondaryButton} ${currentView === 'reviews' ? styles.secondaryButtonActive : ''}`} onClick={() => navigate('/admin/promotions/reviews')}>投稿审核</button>
        {pendingReviewCount > 0 ? <span className={styles.actionBadge}>{formatBadgeCount(pendingReviewCount)}</span> : null}
      </div>
    </div>
  );

  const renderForm = () => (
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h3 className={styles.cardTitle}>{selectedActivity ? '编辑推广活动' : '新增推广活动'}</h3></div></div>
      <div className={styles.formArea}>
        <label className={styles.fieldLabel}>活动标题<input className={styles.textInput} value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></label>
        <label className={styles.fieldLabel}>活动摘要<textarea className={styles.textArea} value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} /></label>
        <label className={styles.fieldLabel}>
          站内跳转链接（可选）
          <input
            className={styles.textInput}
            value={form.internalLinkUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, internalLinkUrl: event.target.value }))}
            placeholder={buildPromotionInternalLinkExample(form.title)}
          />
          <span className={styles.fieldHint}>用于广告/轮播等入口跳转，示例：{buildPromotionInternalLinkExample(form.title)}</span>
        </label>
        <label className={styles.fieldLabel}>活动详情跳转地址（可选）<input className={styles.textInput} value={form.detailLinkUrl} onChange={(event) => setForm((prev) => ({ ...prev, detailLinkUrl: event.target.value }))} placeholder="/game/xxx or https://example.com" /></label>
        <label className={styles.fieldLabel}>活动封面<input className={styles.textInput} type="file" accept="image/*" onChange={(event) => { handleUploadCoverForCrop(event.target.files?.[0] || null); event.currentTarget.value = ''; }} />{form.coverImageUrl && <img className={styles.coverPreview} src={getImageUrl(form.coverImageUrl)} alt="活动封面" />}</label>
        <label className={styles.fieldLabel}>活动时间<label className={styles.switchLabel}><input type="checkbox" checked={form.isLongTerm} onChange={(event) => setForm((prev) => ({ ...prev, isLongTerm: event.target.checked, startAt: event.target.checked ? null : prev.startAt, endAt: event.target.checked ? null : prev.endAt }))} />长期活动</label></label>
        {!form.isLongTerm && (
          <div className={styles.inlineGrid}>
            <label className={styles.fieldLabel}>开始时间<input className={styles.textInput} type="datetime-local" value={formatDateTimeLocal(form.startAt)} onChange={(event) => setForm((prev) => ({ ...prev, startAt: normalizeDateTimeLocal(event.target.value) }))} /></label>
            <label className={styles.fieldLabel}>截止时间<input className={styles.textInput} type="datetime-local" value={formatDateTimeLocal(form.endAt)} onChange={(event) => setForm((prev) => ({ ...prev, endAt: normalizeDateTimeLocal(event.target.value) }))} /></label>
          </div>
        )}
        <label className={styles.fieldLabel}>投稿次数限制<select className={styles.select} value={form.submissionLimitType} onChange={(event) => setForm((prev) => ({ ...prev, submissionLimitType: event.target.value as PromotionSubmissionLimitType, submissionLimitDays: event.target.value === 'rolling_window' ? (prev.submissionLimitDays || 1) : null, submissionLimitCount: event.target.value === 'rolling_window' ? (prev.submissionLimitCount || 1) : null }))}><option value="unlimited">活动期内无限次</option><option value="once_per_activity">活动期内限制一次</option><option value="rolling_window">每 a 天限 b 次</option></select></label>
        {form.submissionLimitType === 'rolling_window' && (
          <div className={styles.inlineGrid}>
            <label className={styles.fieldLabel}>{'天（a）'}<input className={styles.textInput} type="number" value={form.submissionLimitDays ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, submissionLimitDays: Number(event.target.value || 0) }))} /></label>
            <label className={styles.fieldLabel}>{'次（b）'}<input className={styles.textInput} type="number" value={form.submissionLimitCount ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, submissionLimitCount: Number(event.target.value || 0) }))} /></label>
          </div>
        )}
        <label className={styles.fieldLabel}>审核通过奖励织梦豆<input className={styles.textInput} type="number" value={form.rewardPoints} onChange={(event) => setForm((prev) => ({ ...prev, rewardPoints: Number(event.target.value || 0) }))} /></label>
        <label className={styles.fieldLabel}>排序值<input className={styles.textInput} type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))} /></label>
        <label className={styles.fieldLabel}>发布状态<select className={styles.select} value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PromotionActivityPayload['status'] }))}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
        <div className={styles.configSection}>
          <div className={styles.fieldLabel}>投稿方式配置</div>
          <div className={styles.configList}>
            {submissionConfigFields.map((field) => (
              <div key={field.acceptKey} className={styles.configItem}>
                <span className={styles.configItemTitle}>{field.label}</span>
                <div className={styles.toggleRow}>
                  <label className={styles.switchLabel}>
                    <input type="checkbox" checked={form.submissionConfig[field.acceptKey]} onChange={(event) => updateSubmissionConfigAccept(field, event.target.checked)} />
                    启用
                  </label>
                  <label className={`${styles.switchLabel} ${!form.submissionConfig[field.acceptKey] ? styles.switchLabelDisabled : ''}`}>
                    <input type="checkbox" checked={form.submissionConfig[field.requireKey]} disabled={!form.submissionConfig[field.acceptKey]} onChange={(event) => updateSubmissionConfigRequired(field, event.target.checked)} />
                    必填
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.actionRow}>
          <button type="button" className={styles.secondaryButton} onClick={resetForm}>清空</button>
          <button type="button" className={styles.primaryButton} onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? '保存中...' : selectedActivity ? '保存修改' : '创建活动'}</button>
        </div>
      </div>
    </section>
  );

  const renderActivityList = () => (
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h3 className={styles.cardTitle}>管理活动</h3></div></div>
      <div className={styles.list}>
        {isLoadingActivities ? <div className={styles.emptyState}>正在加载活动...</div> : activities.length === 0 ? <div className={styles.emptyState}>还没有推广活动，先去新增一个。</div> : activities.map((activity) => (
          <article key={activity.id} className={styles.itemCard}>
            <div className={styles.itemHeader}><div className={styles.itemTitle}>{activity.title}</div><span className={styles.statusTag}>{activity.status === 'published' ? '已发布' : '草稿'}</span></div>
            <div className={styles.itemMeta}>活动时间：{buildTimeSummary(activity)}</div>
            <div className={styles.itemMeta}>投稿限制：{buildLimitSummary(activity)}</div>
            <div className={styles.itemMeta}>固定奖励织梦豆：{activity.rewardPoints}</div>
            <div className={styles.itemMeta}>排序：{activity.sortOrder} · 更新时间：{formatTime(activity.updatedAt)}</div>
            <div className={styles.actionRow}><button type="button" className={styles.secondaryButton} onClick={() => handleSelectActivity(activity)}>编辑活动</button><button type="button" className={styles.dangerButton} onClick={() => void handleDelete(activity.id)}>删除活动</button></div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderReviews = () => (
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h3 className={styles.cardTitle}>投稿审核</h3></div></div>
      <div className={styles.formArea}>
        <div className={styles.reviewFilterBar}>
          <div className={styles.filterGrid}>
            <label className={styles.fieldLabel}>活动筛选<select className={styles.select} value={reviewFilters.activityId ?? ''} onChange={(event) => handleReviewFilterChange('activityId', event.target.value ? Number(event.target.value) : undefined)}><option value="">全部活动</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <label className={styles.fieldLabel}>活动范围<select className={styles.select} value={reviewFilters.activityPeriod} onChange={(event) => handleReviewFilterChange('activityPeriod', event.target.value as PromotionActivityPeriodFilter)}><option value="all">全部</option><option value="ongoing">正在进行</option><option value="history">历史活动</option></select></label>
            <label className={styles.fieldLabel}>审核状态<select className={styles.select} value={reviewFilters.reviewStatus} onChange={(event) => handleReviewFilterChange('reviewStatus', event.target.value as PromotionReviewStatusFilter)}><option value="all">全部</option><option value="pending_review">待审核</option><option value="approved">审核通过</option><option value="rejected">审核不通过</option><option value="reward_pending">奖励待下发</option><option value="reward_issued">奖励已下发</option></select></label>
            <label className={styles.fieldLabel}>搜索<input className={styles.textInput} value={reviewFilters.keyword} placeholder="搜索账户或活动名称" onChange={(event) => handleReviewFilterChange('keyword', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSearchSubmit(); } }} /></label>
          </div>
          <div className={styles.filterActions}>
            <button type="button" className={styles.primaryButton} onClick={handleSearchSubmit}>查询</button>
            <button type="button" className={styles.secondaryButton} onClick={handleResetReviewFilters}>重置</button>
          </div>
        </div>
      </div>
      <div className={styles.list}>
        {isLoadingSubmissions ? <div className={styles.emptyState}>正在加载投稿...</div> : submissions.length === 0 ? <div className={styles.emptyState}>当前条件下没有投稿记录。</div> : (
          <div className={styles.reviewTableWrapper}>
            {/* 实现投稿审核表格展示 */}
            <table className={styles.reviewTable}>
              {/* 实现审核表格列宽分配 */}
              <colgroup>
                <col className={styles.reviewStatusCol} />
                <col className={styles.reviewTitleCol} />
                <col className={styles.reviewAccountCol} />
                <col className={styles.reviewOperateCol} />
                <col className={styles.reviewDetailCol} />
              </colgroup>
              <thead>
                <tr>
                  <th>审核状态</th>
                  <th>活动名称</th>
                  <th>账户名</th>
                  <th>审核操作</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const currentReview = reviewState[submission.id] || { reviewStatus: submission.reviewStatus, reviewRemark: submission.reviewRemark || '' };
                  return (
                    <tr key={submission.id} className={styles.reviewTableRow}>
                      <td>
                        <span className={`${styles.statusTag} ${getSubmissionStatusClass(currentReview.reviewStatus)}`}>{statusLabelMap[currentReview.reviewStatus]}</span>
                      </td>
                      <td className={styles.reviewTitleCell}>{submission.activityTitle || `活动 #${submission.activityId}`}</td>
                      <td className={styles.reviewAccountCell}>{getSubmissionDisplayName(submission)}</td>
                      <td className={styles.reviewOperateCell}>
                        <div className={styles.reviewInlineActions}>
                          <select
                            className={`${styles.select} ${styles.reviewStatusSelect}`}
                            value={currentReview.reviewStatus}
                            disabled={Boolean(savingReviewIds[submission.id])}
                            onChange={(event) => void handleReviewStatusChange(submission.id, event.target.value as PromotionReviewStatus)}
                          >
                            <option value="pending_review">待审核</option>
                            <option value="approved">审核通过</option>
                            <option value="rejected">审核不通过</option>
                            <option value="reward_pending">奖励待下发</option>
                            <option value="reward_issued" disabled>奖励已下发</option>
                          </select>
                        </div>
                      </td>
                      <td className={styles.reviewDetailCell}>
                        <button type="button" className={`${styles.secondaryButton} ${styles.reviewDetailButton}`} onClick={() => void handleOpenSubmissionDetail(submission)}>
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        className={styles.paginationBar}
        currentPage={submissionPagination.page}
        totalPages={submissionPagination.totalPages}
        onPageChange={handleReviewPageChange}
        disabled={isLoadingSubmissions}
        summary={`第 ${submissionPagination.page} 页，共 ${submissionPagination.totalPages} 页，共 ${submissionPagination.total} 条记录`}
      />
    </section>
  );

  const renderTickerSettings = () => (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>首页滚动通知</h3>
          <p className={styles.cardDesc}>配置首页轮播图下方的喇叭滚动文案与跳转地址。</p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void loadHomeTicker()}
          disabled={isLoadingHomeTicker || isSavingHomeTicker}
        >
          刷新配置
        </button>
      </div>

      {isLoadingHomeTicker ? (
        <div className={styles.emptyState}>正在加载首页滚动通知...</div>
      ) : (
        <div className={styles.formArea}>
          <label className={styles.fieldLabel}>
            通知文案
            <textarea
              className={styles.textArea}
              value={homeTicker.text}
              placeholder="请输入首页轮播图下方展示的滚动文案"
              onChange={(event) => setHomeTicker((prev) => ({ ...prev, text: event.target.value }))}
            />
          </label>
          <label className={styles.fieldLabel}>
            跳转地址
            <input
              className={styles.textInput}
              value={homeTicker.linkUrl}
              placeholder="/promotions 或 https://example.com"
              onChange={(event) => setHomeTicker((prev) => ({ ...prev, linkUrl: event.target.value }))}
            />
            <span className={styles.tickerHint}>支持站内路径 `/xxx`，也支持 `http://` 或 `https://` 外链。</span>
          </label>
          <div className={styles.tickerPreview}>
            <div className={styles.tickerPreviewLabel}>效果预览</div>
            <div className={styles.tickerPreviewBar}>
              <span className={styles.tickerPreviewIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10V14H7L12 18V6L7 10H4Z" />
                  <path d="M16 9C17.2 10.2 17.2 13.8 16 15" />
                  <path d="M18.5 6.5C21 9 21 15 18.5 17.5" />
                </svg>
              </span>
              <span className={styles.tickerPreviewText}>{homeTicker.text.trim() || '这里会显示首页滚动通知文案'}</span>
            </div>
          </div>
          <div className={styles.tickerMeta}>
            默认跳转地址：`/promotions`
            {homeTicker.updatedAt ? ` · 最近更新：${formatTime(homeTicker.updatedAt)}` : ''}
          </div>
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setHomeTicker(createEmptyHomeTicker())}
              disabled={isSavingHomeTicker}
            >
              重置默认值
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSaveHomeTicker()}
              disabled={isSavingHomeTicker}
            >
              {isSavingHomeTicker ? '保存中...' : '保存首页滚动通知'}
            </button>
          </div>
        </div>
      )}
    </section>
  );

  const renderSubmissionDetailModal = () => {
    if (detailSubmissionId === null) return null;

    const submission = detailSubmission;
    const currentReview = submission
      ? (reviewState[submission.id] || {
        reviewStatus: submission.reviewStatus,
        reviewRemark: submission.reviewRemark || '',
      })
      : null;

    return (
      <div className={styles.detailOverlay} onClick={(event) => { if (event.target === event.currentTarget) handleCloseSubmissionDetail(); }}>
        <div className={styles.detailDialog} role="dialog" aria-modal="true" aria-label="投稿详情">
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>投稿详情</h3>
              <div className={styles.cardDesc}>这里集中查看投稿内容、用户信息和审核备注。</div>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={handleCloseSubmissionDetail}>关闭</button>
          </div>
          {isDetailLoading ? <div className={styles.emptyState}>正在加载详情...</div> : !submission ? <div className={styles.emptyState}>未找到投稿详情。</div> : (
            <div className={styles.detailBody}>
              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>基础信息</div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailField}><span className={styles.detailLabel}>活动名称</span><span className={styles.detailValue}>{submission.activityTitle || `活动 #${submission.activityId}`}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>审核状态</span><span className={`${styles.statusTag} ${getSubmissionStatusClass(currentReview?.reviewStatus || submission.reviewStatus)}`}>{statusLabelMap[currentReview?.reviewStatus || submission.reviewStatus]}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>参与人账户名</span><span className={styles.detailValue}>{getSubmissionDisplayName(submission)}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>投稿时间</span><span className={styles.detailValue}>{formatTime(submission.submittedAt)}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>Kuran号</span><span className={styles.detailValue}>{submission.userCode || '未填写'}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>手机号</span><span className={styles.detailValue}>{submission.phoneNumber || '未填写'}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>用户ID</span><span className={styles.detailValue}>{submission.userId || '未填写'}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>奖励织梦豆</span><span className={styles.detailValue}>{submission.rewardPoints ?? '无'}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>奖励任务ID</span><span className={styles.detailValue}>{submission.rewardTaskId ?? '无'}</span></div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>审核时间</span><span className={styles.detailValue}>{formatTime(submission.reviewedAt)}</span></div>
                </div>
              </section>

              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>审核备注</div>
                <label className={styles.fieldLabel}>
                  <span className={styles.detailLabel}>编辑审核备注</span>
                  <textarea
                    className={styles.textArea}
                    value={currentReview?.reviewRemark || ''}
                    onChange={(event) => submission && updateSubmissionReviewDraft(submission.id, { reviewRemark: event.target.value })}
                    placeholder="请输入审核备注"
                  />
                </label>
                <div className={styles.detailActionRow}>
                  <button type="button" className={styles.primaryButton} onClick={() => submission && void handleReview(submission.id)}>
                    保存备注
                  </button>
                </div>
              </section>

              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>投稿文本</div>
                {submission.submitPayload.texts.length === 0 ? <div className={styles.detailTextBlock}>无内容</div> : (
                  <div className={styles.detailLinkList}>
                    {submission.submitPayload.texts.map((item, index) => (
                      <div key={`${submission.id}-text-${index}`} className={styles.detailTextBlock}>{item}</div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>投稿链接</div>
                {submission.submitPayload.links.length === 0 ? <div className={styles.detailTextBlock}>无内容</div> : (
                  <div className={styles.detailLinkList}>
                    {submission.submitPayload.links.map((item) => (
                      <a key={item} className={styles.detailLinkItem} href={item} target="_blank" rel="noreferrer">{item}</a>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>投稿图片</div>
                {submission.submitPayload.images.length === 0 ? <div className={styles.detailTextBlock}>无内容</div> : (
                  <div className={styles.detailImageGrid}>
                    {submission.submitPayload.images.map((item) => (
                      <img key={item} className={styles.detailImage} src={getImageUrl(item)} alt="投稿图片" />
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>投稿视频</div>
                {submission.submitPayload.videos.length === 0 ? <div className={styles.detailTextBlock}>无内容</div> : (
                  <div className={styles.detailMediaGrid}>
                    {submission.submitPayload.videos.map((item) => (
                      <video key={item} className={styles.detailVideo} controls src={getImageUrl(item)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.panelStack}>
        <section className={styles.heroCard}><div className={styles.sectionBadge}>推广管理</div>{renderHeaderButtons()}</section>
        {currentView === 'create' && renderForm()}
        {currentView === 'list' && renderActivityList()}
        {currentView === 'reviews' && renderReviews()}
        {currentView === 'ticker' && renderTickerSettings()}
      </div>
      {renderSubmissionDetailModal()}
      {pendingCropFile ? (
        <ImageCropModal
          isOpen
          imageSrc={pendingCropFile.imageSrc}
          title={cropPreset.title}
          description={cropPreset.description}
          aspectRatio={cropPreset.aspectRatio}
          aspectLabel={cropPreset.aspectLabel}
          defaultCropScale={cropPreset.defaultCropScale}
          mimeType={pendingCropFile.mimeType}
          onClose={closeCropper}
          onCropComplete={handleCropComplete}
        />
      ) : null}
    </>
  );
};

export default PromotionAdminManager;
