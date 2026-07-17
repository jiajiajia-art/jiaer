import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import { FaRegThumbsUp, FaThumbsUp, FaRegCommentDots, FaEllipsisH } from 'react-icons/fa';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa6';
import gameRatingApi from '../../api/gameRating';
import i18n from '../../i18n';

type RatingItem = NonNullable<
  Awaited<ReturnType<typeof gameRatingApi.getRatings>>['data']['data']
>['ratingsComments']['list'][number];

type UserRating = NonNullable<
  Awaited<ReturnType<typeof gameRatingApi.getRatings>>['data']['data']
>['userRating'];

type RatingSummary = NonNullable<
  Awaited<ReturnType<typeof gameRatingApi.getRatings>>['data']['data']
>['ratingsComments']['summary'];
import { useAuthStore, authModalStore } from '../../store/useAuthStore';
import { getImageUrl } from '../../utils/constants';
import styles from './GameRating.module.css';

interface Props {
  fileId: string;
  onRatingChange?: (summary: RatingSummary) => void;
}

const DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';
const PAGE_SIZE = 10;
const DEBOUNCE_DELAY = 300;

const isChineseLanguage = (language: string): boolean => language.toLowerCase().startsWith('zh');

const getAnonymousUserLabel = (language: string): string =>
  isChineseLanguage(language) ? '匿名用户' : 'Anonymous User';

const getRepliesSummaryLabel = (count: number, language: string): string =>
  isChineseLanguage(language) ? `共${count}条回复 >` : `${count} replies >`;

const getExpandMoreRepliesLabel = (language: string): string =>
  isChineseLanguage(language) ? '展开更多' : 'Show more';

const getCollapseRepliesLabel = (language: string): string =>
  isChineseLanguage(language) ? '收起' : 'Collapse';

const formatDate = (dateString: string, language: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const useChinese = isChineseLanguage(language);

  if (minutes < 1) return useChinese ? '刚刚' : 'just now';
  if (minutes < 60) return useChinese ? `${minutes}分钟前` : `${minutes} min ago`;
  if (hours < 24) return useChinese ? `${hours}小时前` : `${hours} hr ago`;
  if (days < 30) return useChinese ? `${days}天前` : `${days} days ago`;
  return date.toLocaleDateString(useChinese ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
};

const getDisplayName = (nickname: string | null | undefined, fallbackName: string): string =>
  nickname?.trim() || fallbackName;

const isRiskyContentError = (error: unknown): { isRisky: boolean; message?: string } => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { code?: string; message?: string } } }).response;
    if (response?.data?.code === 'CONTENT_RISKY') {
      return { isRisky: true, message: response.data.message };
    }
  }
  return { isRisky: false };
};

const StarRating: React.FC<{
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'tiny' | 'small' | 'medium' | 'large';
}> = ({ value, onChange, readonly = false, size = 'medium' }) => {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;

  return (
    <div className={`${styles.starRating} ${styles[`starRating_${size}`]} ${readonly ? styles.starRating_readonly : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${styles.starButton} ${star <= displayValue ? styles.filled : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(0)}
          disabled={readonly}
          aria-label={`${star} star`}
        >
          {star <= displayValue ? <AiFillStar /> : <AiOutlineStar />}
        </button>
      ))}
    </div>
  );
};

const CommentCard: React.FC<{
  comment: RatingItem;
  onReply: (comment: RatingItem) => void;
  onLike: (comment: RatingItem) => void;
  onDelete: (comment: RatingItem) => void;
  onCopy: (comment: RatingItem) => void;
  isLiking: boolean;
  isOwner: boolean;
}> = ({ comment, onReply, onLike, onDelete, onCopy, isLiking, isOwner }) => {
  const { t } = useTranslation();
  const currentLanguage = i18n.language;
  const displayName = getDisplayName(comment.nickname, getAnonymousUserLabel(currentLanguage));
  const replyCount = comment.replies?.length ?? 0;
  const [visibleReplyCount, setVisibleReplyCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const visibleReplies = comment.replies?.slice(0, visibleReplyCount) ?? [];
  const isRepliesExpanded = visibleReplyCount > 0;
  const shouldShowExpandMore = isRepliesExpanded && visibleReplyCount < replyCount;

  useEffect(() => {
    setVisibleReplyCount(0);
  }, [comment.rating_id, replyCount]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  const handleExpandReplies = () => {
    if (replyCount <= 0) return;

    if (visibleReplyCount === 0) {
      setVisibleReplyCount(replyCount <= 3 ? replyCount : 3);
      return;
    }

    setVisibleReplyCount((prev) => Math.min(prev + 10, replyCount));
  };

  const handleCollapseReplies = () => {
    setVisibleReplyCount(0);
  };

  return (
    <div className={styles.commentCard}>
      <div className={styles.commentMain}>
        <img
          src={getImageUrl(comment.avatarUrl) || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
          alt={displayName}
          className={styles.commentAvatar}
        />
        <div className={styles.commentBody}>
          <div className={styles.commentHeader}>
            <div className={styles.commentMeta}>
              <div className={styles.commentUserInfo}>
                <span className={styles.commentNickname}>{displayName}</span>
                {comment.is_owner === 1 && <span className={styles.ownerBadge}>{t('gameRating.owner')}</span>}
                {comment.review_status === 'pending' && (
                  <span className={styles.pendingBadge}>{t('gameRating.pendingReview')}</span>
                )}
              </div>
              {comment.rating_value !== null && (
                <div className={styles.commentRatingBadge}>
                  <StarRating value={comment.rating_value} readonly size="small" />
                </div>
              )}
            </div>
            <div className={styles.headerActions}>
              <div className={styles.menuWrapper} ref={menuRef}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.menuBtn}`}
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label={t('gameRating.copyComment')}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <FaEllipsisH />
                </button>
                {menuOpen && (
                  <div className={styles.menuDropdown} role="menu">
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        onCopy(comment);
                        setMenuOpen(false);
                      }}
                    >
                      {t('gameRating.copyComment')}
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className={`${styles.menuItem} ${styles.menuItemDanger}`}
                        onClick={() => {
                          onDelete(comment);
                          setMenuOpen(false);
                        }}
                      >
                        {t('gameRating.deleteComment')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.headerActionBtn} ${comment.user_liked ? styles.liked : ''}`}
                onClick={() => onLike(comment)}
                disabled={isLiking}
              >
                {comment.user_liked ? <FaThumbsUp /> : <FaRegThumbsUp />}
                <span>{comment.like_count_real > 0 ? comment.like_count_real : ''}</span>
              </button>
            </div>
          </div>
          <div className={styles.commentContent}>{comment.comment_content}</div>
          <div className={styles.commentFooter}>
            <div className={styles.commentFooterMeta}>
              <div className={styles.commentTime}>{formatDate(comment.created_at, currentLanguage)}</div>
              <button type="button" className={styles.replyTextBtn} onClick={() => onReply(comment)}>
                {t('gameRating.reply')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {replyCount > 0 && (
        <div className={styles.repliesSection}>
          {visibleReplies.map((reply) => {
            const replyDisplayName = getDisplayName(reply.nickname, getAnonymousUserLabel(currentLanguage));

            return (
              <div key={reply.rating_id} className={styles.replyCard}>
                <div className={styles.replyMain}>
                  <img
                    src={getImageUrl(reply.avatarUrl) || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
                    alt={replyDisplayName}
                    className={styles.replyAvatar}
                  />
                  <div className={styles.replyBody}>
                    <div className={styles.replyUserInfo}>
                      <span className={`${styles.replyNickname} ${reply.parent_nickname && !reply.parent_rating_id?.startsWith('rating') ? styles.replyNicknameLimited : ''}`} title={displayName}>{replyDisplayName}</span>
                      {reply.parent_nickname && !reply.parent_rating_id?.startsWith('rating') && (
                        <>
                          <svg className={styles.replyArrowIcon} viewBox="0 0 1024 1024" width="16" height="16">
                            <path d="M384 768l256-256-256-256v512z" fill="rgba(0,0,0,0.42)" />
                          </svg>
                          <span className={styles.replyToInfo} title={reply.parent_nickname}>
                            {reply.parent_nickname}
                          </span>
                        </>
                      )}
                      {reply.is_owner === 1 && <span className={styles.ownerBadge}>{t('gameRating.owner')}</span>}
                    </div>
                    {reply.rating_value !== null && comment.user_id !== reply.user_id && (
                      <div className={styles.replyRatingBadge}>
                        <StarRating value={reply.rating_value} readonly size="tiny" />
                      </div>
                    )}
                    <div className={styles.replyContent}>{reply.comment_content}</div>
                    <div className={styles.replyFooter}>
                      <span className={styles.replyTime}>{formatDate(reply.created_at, currentLanguage)}</span>
                      <button type="button" className={styles.replyTextBtn} onClick={() => onReply(reply)}>
                        {t('gameRating.reply')}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.likeBtn} ${reply.user_liked ? styles.liked : ''}`}
                    onClick={() => onLike(reply as unknown as RatingItem)}
                  >
                    {reply.user_liked ? <FaThumbsUp /> : <FaRegThumbsUp />}
                    <span>{reply.like_count_real > 0 ? reply.like_count_real : ''}</span>
                  </button>
                </div>
              </div>
            );
          })}
          {!isRepliesExpanded ? (
            <button type="button" className={styles.replySummary} onClick={handleExpandReplies}>
              {getRepliesSummaryLabel(replyCount, currentLanguage)}
            </button>
          ) : (
            <div className={styles.replyActions}>
              {shouldShowExpandMore && (
                <button type="button" className={styles.replySummary} onClick={handleExpandReplies}>
                  <span>{getExpandMoreRepliesLabel(currentLanguage)}</span>
                  <FaChevronDown />
                </button>
              )}
              <button
                type="button"
                className={`${styles.replySummary} ${styles.replyCollapseBtn}`}
                onClick={handleCollapseReplies}
              >
                <span>{getCollapseRepliesLabel(currentLanguage)}</span>
                <FaChevronUp />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GameRating: React.FC<Props> = ({ fileId, onRatingChange }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { setIsAuthModalOpen } = authModalStore();
  const anonymousUserName = getAnonymousUserLabel(i18n.language);

  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<UserRating>(null);
  const [comments, setComments] = useState<RatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RatingSummary>({ average: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [showInput, setShowInput] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<RatingItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const likeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAuth = useCallback(() => {
    if (!user?.user?.id) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  }, [user, setIsAuthModalOpen]);

  const fetchRatings = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!fileId) return;

    try {
      const response = await gameRatingApi.getRatings(fileId, pageNum, PAGE_SIZE);
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        if (append) {
          setComments((prev) => [...prev, ...data.ratingsComments.list]);
        } else {
          setComments(data.ratingsComments.list);
        }
        setTotal(data.ratingsComments.total);
        setSummary(data.ratingsComments.summary);
        setHasMore(data.ratingsComments.list.length === PAGE_SIZE);
        setUserRating(data.userRating);
        onRatingChange?.(data.ratingsComments.summary);
      }
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
    } finally {
      setLoading(false);
    }
  }, [fileId, onRatingChange]);

  useEffect(() => {
    fetchRatings(1, false);
  }, [fetchRatings]);

  const handleLike = useCallback((comment: RatingItem) => {
    if (!checkAuth()) return;

    if (likeDebounceRef.current) {
      clearTimeout(likeDebounceRef.current);
    }

    likeDebounceRef.current = setTimeout(async () => {
      setLikingIds((prev) => new Set(prev).add(comment.rating_id));
      try {
        const response = await gameRatingApi.toggleLike(comment.rating_id);
        if (response.data.success && response.data.data) {
          const { isLiked, likeCount } = response.data.data;
          const updateComment = (list: RatingItem[]): RatingItem[] =>
            list.map((item) => {
              if (item.rating_id === comment.rating_id) {
                return { ...item, user_liked: isLiked, like_count_real: likeCount };
              }
              if (item.replies) {
                return { ...item, replies: updateComment(item.replies) };
              }
              return item;
            });
          setComments((prev) => updateComment(prev));
        }
      } catch (error) {
        console.error('Failed to toggle like:', error);
      } finally {
        setLikingIds((prev) => {
          const next = new Set(prev);
          next.delete(comment.rating_id);
          return next;
        });
        likeDebounceRef.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [checkAuth]);

  const handleReply = useCallback((comment: RatingItem) => {
    if (!checkAuth()) return;
    setReplyTo(comment);
    setReplyText('');
  }, [checkAuth]);

  const handleDelete = useCallback(async (comment: RatingItem) => {
    if (!checkAuth()) return;
    try {
      const response = await gameRatingApi.deleteRating(comment.rating_id);
      if (response.data.success) {
        toast.success(response.data.message || t('gameRating.deleteSuccess'));
        fetchRatings(1, false);
      } else {
        toast.error(response.data.message || t('gameRating.deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error(t('gameRating.deleteFailed'));
    }
  }, [checkAuth, fetchRatings, t]);

  const handleCopy = useCallback(async (comment: RatingItem) => {
    try {
      await navigator.clipboard.writeText(comment.comment_content);
      toast.success(t('gameRating.commentCopied'));
    } catch {
      toast.error(t('gameRating.copyFailed'));
    }
  }, [t]);

  const submitReply = async () => {
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    try {
      const response = await gameRatingApi.submitRating({
        parentRatingId: replyTo?.rating_id,
        comment: replyText.trim(),
      });
      if (response.data.success) {
        const replyData = response.data.data && 'reply' in response.data.data 
          ? (response.data.data as { reply: { review_status?: string } }).reply
          : null;
        const isPending = replyData?.review_status === 'pending';
        toast.success(isPending ? t('gameRating.submitSuccessPending') : t('gameRating.replySuccess'));
        setReplyTo(null);
        setReplyText('');
        fetchRatings(1, false);
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
      const riskyResult = isRiskyContentError(error);
      if (riskyResult.isRisky) {
        toast.error(t('gameRating.submitFailedRisky'));
      } else {
        toast.error(t('gameRating.replyFailed'));
      }
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const submitRating = async () => {
    if (ratingValue === 0) {
      toast.error(t('gameRating.pleaseSelectRating'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await gameRatingApi.submitRating({
        fileId,
        ratingValue,
        comment: commentText.trim(),
      });
      if (response.data.success) {
        const ratingData = response.data.data && 'rating' in response.data.data 
          ? (response.data.data as { rating: { rating_id: string; rating_value: number; comment_content: string; created_at: string; review_status?: string } }).rating
          : null;
        
        const isPending = ratingData?.review_status === 'pending';
        toast.success(isPending ? t('gameRating.submitSuccessPending') : t('gameRating.submitSuccess'));
        setShowInput(false);
        setRatingValue(0);
        setCommentText('');
        if (ratingData) {
          setUserRating(ratingData);
        }
        fetchRatings(1, false);
      }
    } catch (error) {
      console.error('Failed to submit rating:', error);
      const riskyResult = isRiskyContentError(error);
      if (riskyResult.isRisky) {
        toast.error(t('gameRating.submitFailedRisky'));
      } else {
        toast.error(t('gameRating.submitFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRatings(nextPage, true);
  };

  useEffect(() => {
    return () => {
      if (likeDebounceRef.current) {
        clearTimeout(likeDebounceRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 闂傚倸鍊峰ù鍥х暦閸偅鍙忛柡澶嬪殮濞差亜围闁搞儻绲芥禍鐐叏濡厧甯跺褍顕埀顒冾潐濞叉繈锝炴径鎰畾闁哄啫鐗嗛悡锟犳煕閳╁厾顏呯閹绢喗鈷掑ù锝勮閻掗箖鏌￠崼顐㈠闁瑰箍鍨归濂稿椽娴ｅ搫濮?*/}
      <div className={styles.summarySection}>
        <div className={styles.summaryLeft}>
          <div className={styles.averageScore}>{summary.average > 0 ? summary.average.toFixed(1) : '0.0'}</div>
          <div className={styles.totalCount}>{t('gameRating.totalReviews', { count: summary.total })}</div>
        </div>
        {!showInput && !userRating && (
          <button type="button" className={styles.writeReviewBtn} onClick={() => {
            if (checkAuth()) setShowInput(true);
          }}>
            {t('gameRating.writeReview')}
          </button>
        )}
      </div>

      {/* 闂傚倸鍊搁崐椋庣矆娴ｉ潻鑰块梺顒€绉寸壕濠氭煙閻愵剙澧柣鏂挎閹便劌顪冪拠韫闁诲氦顫夊ú锕傚垂閸洜宓佹慨妞诲亾闁硅櫕绮撳Λ鍐ㄢ槈濮橆剟鍙￠梻鍌氬€风粈渚€骞夐垾瓒佹椽鏁冮崒姘舵７濡炪倖娲嶉崑鎾垛偓?*/}
      {showInput && (
        <div className={styles.writeSection}>
          <div className={styles.writeHeader}>
            <span>{t('gameRating.rateThisGame')}</span>
            <button type="button" className={styles.closeBtn} onClick={() => setShowInput(false)}>x</button>
          </div>
          <StarRating value={ratingValue} onChange={setRatingValue} size="large" />
          <textarea
            className={styles.commentInput}
            placeholder={t('gameRating.commentPlaceholder')}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
          <button
            type="button"
            className={styles.submitBtn}
            onClick={submitRating}
            disabled={isSubmitting || ratingValue === 0}
          >
            {isSubmitting ? t('gameRating.submitting') : t('gameRating.submit')}
          </button>
        </div>
      )}

      {/* 闂傚倸鍊搁崐鐑芥倿閿曞倸绠栭柛顐ｆ礀绾惧潡鏌熼幆鐗堫棄缁惧墽绮换娑㈠箣閺冣偓閸ゅ秹鏌涢妷顔煎闁活厽顨呴…璺ㄦ崉娓氼垰鍓崇紓浣割槸閻栫厧顫忛搹瑙勫枂闁告洦鍋勬慨銏ゆ⒑閸濄儱鏋庨柣蹇旂箞椤?*/}
      {replyTo && (
        <div className={styles.replyInputSection}>
          <div className={styles.replyHeader}>
            <span>{t('gameRating.replyTo', { name: getDisplayName(replyTo.nickname, anonymousUserName) })}</span>
            <button type="button" className={styles.closeBtn} onClick={() => setReplyTo(null)}>x</button>
          </div>
          <textarea
            className={styles.replyInput}
            placeholder={t('gameRating.replyPlaceholder')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={2}
            autoFocus
          />
          <button
            type="button"
            className={styles.submitBtn}
            onClick={submitReply}
            disabled={isSubmittingReply || !replyText.trim()}
          >
            {isSubmittingReply ? t('gameRating.submitting') : t('gameRating.reply')}
          </button>
        </div>
      )}

      {/* 闂傚倸鍊峰ù鍥х暦閸偅鍙忛柡澶嬪殮濞差亜围闁搞儻绲芥禍鐐叏濡厧甯堕柣蹇ラ檮閵囧嫰濮€閿涘嫭鍣板Δ鐘靛仜椤戝寮崘顔肩劦妞ゆ帒鍊婚惌鍡涙煕閳╁厾鑲╂崲閸℃稒鐓忛柛顐ｇ箖閸ｈ銇勮箛瀣姦闁?*/}
      <div className={styles.commentsSection}>
        <div className={styles.commentsHeader}>
          <h3>{t('gameRating.reviews')}</h3>
          <span className={styles.commentsCount}>{total} {t('gameRating.reviews')}</span>
        </div>

        {comments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FaRegCommentDots /></div>
            <p>{t('gameRating.noReviews')}</p>
          </div>
        ) : (
          <div className={styles.commentsList}>
            {comments.map((comment) => (
              <CommentCard
                key={comment.rating_id}
                comment={comment}
                onReply={handleReply}
                onLike={handleLike}
                onDelete={handleDelete}
                onCopy={handleCopy}
                isLiking={likingIds.has(comment.rating_id)}
                isOwner={String(user?.user?.userId) === comment.user_id}
              />
            ))}
            {hasMore && (
              <button type="button" className={styles.loadMoreBtn} onClick={handleLoadMore}>
                {t('gameRating.loadMore')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRating;
