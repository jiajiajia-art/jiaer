import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { auth } from '../api/account/authApi';
import type {
    CheckInResponse,
    MembershipSignInStatus,
    SignInMakeupResponse,
    SignInDayState,
    SignInWeekDay,
} from '../api/account/auth.type';
import {
    buildMonthGrid,
    formatUtcMonthDay,
    getMonthProgress,
    getWeekdayKey,
    normalizeMembershipSignInStatus,
    type CheckInViewMode,
} from '../utils/checkInCalendar';
import { useAuthStore } from '../store/useAuthStore';
import styles from './CheckInModal.module.css';

const CHECKIN_COIN_SRC = `${import.meta.env.BASE_URL}data/assetsv2/home/icon_coin.webp`;

interface CheckInModalProps {
    isOpen: boolean;
    mode?: CheckInViewMode;
    presentation?: 'modal' | 'embedded';
    onClose: () => void;
    onSignInSuccess?: (result?: CheckInResponse) => void;
    onGoToDailyTasks?: () => void;
    embeddedActionContainer?: HTMLElement | null;
}

type MakeupDialogState =
    | { kind: 'makeupConfirm'; date: string }
    | { kind: 'noCard'; date: string }
    | { kind: 'makeupSuccess'; date: string; result: SignInMakeupResponse };

const STATE_CLASS: Record<SignInDayState, string> = {
    signed: styles.daySigned,
    made_up: styles.dayMadeUp,
    missed: styles.dayMissed,
    today: styles.dayToday,
    upcoming: styles.dayUpcoming,
};

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const trapFocus = (event: KeyboardEvent, root: HTMLElement | null) => {
    if (event.key !== 'Tab' || !root) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (!focusable.length) {
        event.preventDefault();
        root.focus();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

const describeMembershipRewards = (rewards: CheckInResponse['membershipRewards'] = []): string => (
    rewards.map((reward) => `${reward.planId === 'week' ? '周卡' : '月卡'} +${reward.amount}`).join('、')
);

const CheckInModal: React.FC<CheckInModalProps> = ({
    isOpen,
    mode = 'home',
    presentation = 'modal',
    onClose,
    onSignInSuccess,
    onGoToDailyTasks,
    embeddedActionContainer,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const updateUser = useAuthStore((state) => state.updateUser);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingStatus, setIsFetchingStatus] = useState(false);
    const [hasLoadError, setHasLoadError] = useState(false);
    const [isMonthExpanded, setIsMonthExpanded] = useState(false);
    const [signInStatus, setSignInStatus] = useState<MembershipSignInStatus | null>(null);
    const [makeupDialog, setMakeupDialog] = useState<MakeupDialogState | null>(null);
    const [isMakeupSubmitting, setIsMakeupSubmitting] = useState(false);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const makeupDialogRef = useRef<HTMLElement | null>(null);
    const makeupTriggerRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const suppressRestoreFocusRef = useRef(false);
    const isEmbedded = presentation === 'embedded';

    const applySignInStatus = useCallback((raw: MembershipSignInStatus | null | undefined) => {
        // 功能注释：旧接口缺 week/month 时本地补齐日历，避免签到格子整块消失
        const nextStatus = normalizeMembershipSignInStatus(raw);
        setSignInStatus(nextStatus);
        return nextStatus;
    }, []);

    const fetchSignInStatus = useCallback(async (): Promise<MembershipSignInStatus | null> => {
        setIsFetchingStatus(true);
        setHasLoadError(false);
        try {
            const response = await auth.getSignInStatus();
            const nextStatus = response.data.success
                ? applySignInStatus(response.data.data)
                : applySignInStatus(null);
            setHasLoadError(!nextStatus);
            return nextStatus;
        } catch (error) {
            console.error('Failed to load sign-in status:', error);
            setHasLoadError(true);
            applySignInStatus(null);
            return null;
        } finally {
            setIsFetchingStatus(false);
        }
    }, [applySignInStatus]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setSignInStatus(null);
        setHasLoadError(false);
        setIsMonthExpanded(false);
        setMakeupDialog(null);
        suppressRestoreFocusRef.current = false;
        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        void fetchSignInStatus();
        /* 功能注释：焦点落在弹窗根节点，避免关闭钮 focus-visible 粉框；Esc/焦点陷阱仍可用 */
        const frame = isEmbedded
            ? 0
            : window.requestAnimationFrame(() => modalRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
    }, [fetchSignInStatus, isEmbedded, isOpen]);

    useEffect(() => {
        if (!isOpen || isEmbedded) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                trapFocus(event, makeupDialog ? makeupDialogRef.current : modalRef.current);
                return;
            }
            if (event.key !== 'Escape') return;
            if (makeupDialog) {
                setMakeupDialog(null);
                window.requestAnimationFrame(() => makeupTriggerRef.current?.focus());
                return;
            }
            onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isEmbedded, isOpen, makeupDialog, onClose]);

    useEffect(() => {
        if (!isOpen || isEmbedded) return;
        return () => {
            if (!suppressRestoreFocusRef.current) previousFocusRef.current?.focus();
        };
    }, [isEmbedded, isOpen]);

    useEffect(() => {
        if (!makeupDialog) return;
        const frame = window.requestAnimationFrame(() => {
            makeupDialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [makeupDialog]);

    const monthGrid = useMemo(
        () => buildMonthGrid(signInStatus?.month?.days ?? []),
        [signInStatus?.month?.days],
    );

    const highlightTodayDate = useMemo(() => {
        const weekDays = signInStatus?.week?.days;
        if (!weekDays?.length) return null;
        const markedToday = weekDays.find((day) => day.state === 'today')?.date;
        if (markedToday) return markedToday;
        if (!signInStatus?.signedInToday) return null;
        const firstUpcoming = weekDays.findIndex((day) => day.state === 'upcoming');
        const todayIndex = firstUpcoming === -1 ? weekDays.length - 1 : firstUpcoming - 1;
        return todayIndex >= 0 ? weekDays[todayIndex]?.date ?? null : null;
    }, [signInStatus]);

    if (!isOpen) return null;

    const handleCheckIn = async () => {
        if (isSubmitting || isFetchingStatus || !signInStatus?.canClaim) return;
        setIsSubmitting(true);
        try {
            const response = await auth.checkIn();
            const result = response.data.success ? response.data.data : null;
            if (!result) {
                toast.error(response.data.message || t('checkIn.failed'));
                return;
            }

            // 功能注释：部分环境签到成功体只带 signInStatus；勿用空 status 把日历清空成「只剩标题条」
            const nextStatus = applySignInStatus(result.status ?? result.signInStatus);
            if (!nextStatus) {
                await fetchSignInStatus();
            }
            updateUser({ points: result.remainingPoints, hasSignedIn: true });
            if (result.alreadySigned) {
                toast.success(t('checkIn.alreadySigned'));
            } else {
                toast.success(t('checkIn.success', { points: result.pointsAdded }));
            }
            if (result.membershipRewards?.length) {
                toast.success(`会员签到额外获得永久KK币：${describeMembershipRewards(result.membershipRewards)}`);
                const userResponse = await auth.getUserInfo().catch(() => null);
                if (userResponse?.data.success && userResponse.data.data) {
                    updateUser(userResponse.data.data);
                }
            }
            onSignInSuccess?.(result);
        } catch (error) {
            console.error('Sign-in request failed:', error);
            const calibratedStatus = await fetchSignInStatus();
            if (calibratedStatus?.signedInToday) {
                const userResponse = await auth.getUserInfo().catch(() => null);
                if (userResponse?.data.success && userResponse.data.data) {
                    updateUser(userResponse.data.data);
                }
                toast.success(t('checkIn.reconciled'));
                onSignInSuccess?.();
            } else {
                toast.error(t('checkIn.requestFailed'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const openMakeupConfirm = (date: string, trigger: HTMLButtonElement) => {
        if (isSubmitting || isMakeupSubmitting) return;
        makeupTriggerRef.current = trigger;
        setMakeupDialog({ kind: 'makeupConfirm', date });
    };

    const closeMakeupDialog = () => {
        setMakeupDialog(null);
        window.requestAnimationFrame(() => makeupTriggerRef.current?.focus());
    };

    const handleMakeup = async (date: string) => {
        if (isMakeupSubmitting) return;
        setIsMakeupSubmitting(true);
        try {
            const response = await auth.makeUpSignIn(date);
            const result = response.data.success ? response.data.data : null;
            if (!result) {
                toast.error(response.data.message || t('checkIn.requestFailed'));
                return;
            }
            applySignInStatus(result.status);
            updateUser({ points: result.remainingPoints });
            onSignInSuccess?.();
            setMakeupDialog({ kind: 'makeupSuccess', date, result });
        } catch (error) {
            const payload = (error as {
                response?: {
                    data?: {
                        errorCode?: string;
                        message?: string;
                        data?: SignInMakeupResponse;
                    };
                };
            })?.response?.data;
            if (payload?.data?.status) {
                applySignInStatus(payload.data.status);
            }
            if (payload?.errorCode === 'MAKEUP_CARD_UNAVAILABLE') {
                setMakeupDialog({ kind: 'noCard', date });
                return;
            }

            const calibratedStatus = await fetchSignInStatus();
            const calibratedDay = calibratedStatus?.month?.days.find((day) => day.date === date);
            if (calibratedDay?.state === 'made_up') {
                const userResponse = await auth.getUserInfo().catch(() => null);
                if (userResponse?.data.success && userResponse.data.data) {
                    updateUser(userResponse.data.data);
                }
                toast.success(t('checkIn.reconciled'));
                onSignInSuccess?.();
                closeMakeupDialog();
            } else {
                toast.error(payload?.message || t('checkIn.requestFailed'));
            }
        } finally {
            setIsMakeupSubmitting(false);
        }
    };

    const handleGoToDailyTasks = () => {
        setMakeupDialog(null);
        suppressRestoreFocusRef.current = true;
        if (!isEmbedded) onClose();
        if (onGoToDailyTasks) {
            onGoToDailyTasks();
            return;
        }
        navigate('/profile?openDailyTasks=1');
    };

    const status = signInStatus;
    const monthProgress = status?.month ? getMonthProgress(status.month) : 0;
    const monthProgressPercent = status?.month?.targetDays
        ? Math.min(100, Math.round((monthProgress / status.month.targetDays) * 100))
        : 0;
    const [monthYear = '', monthNumber = ''] = status?.month?.monthKey?.split('-') ?? [];

    const renderWeekDay = (day: SignInWeekDay) => {
        const weekdayKey = getWeekdayKey(day.weekday);
        const stateLabel = t(`checkIn.states.${day.state}`);
        const isBonusDay = day.weekday === 7 || day.weeklyBonusPoints > 0;
        const displayPoints = isBonusDay ? Math.max(day.totalPoints, 15) : day.totalPoints;
        const isTodayHighlight = day.date === highlightTodayDate;
        return (
            <button
                type="button"
                key={day.date}
                className={[
                    styles.weekDay,
                    STATE_CLASS[day.state],
                    isBonusDay ? styles.bonusDay : '',
                    isTodayHighlight ? styles.dayToday : '',
                ].filter(Boolean).join(' ')}
                aria-label={`${t(`checkIn.weekdays.${weekdayKey}`)} ${formatUtcMonthDay(day.date)} ${stateLabel} +${displayPoints}`}
                data-can-makeup={day.canMakeup || undefined}
                disabled={!day.canMakeup || isMakeupSubmitting}
                onClick={(event) => openMakeupConfirm(day.date, event.currentTarget)}
            >
                <span className={styles.weekday}>{t(`checkIn.weekdays.${weekdayKey}`)}</span>
                <span className={styles.weekDate}>{formatUtcMonthDay(day.date)}</span>
                <span className={styles.coinWrap} aria-hidden="true">
                    {isEmbedded ? (
                        <span className={styles.coinImgClip}>
                            <img className={styles.coinImg} src={CHECKIN_COIN_SRC} alt="" draggable={false} />
                        </span>
                    ) : (
                        <span className={styles.coinGlyph} />
                    )}
                    <strong className={styles.dayReward}>+{displayPoints}</strong>
                </span>
                {day.canMakeup && isEmbedded && (
                    <span className={styles.dayState}>{t('checkIn.makeupAction')}</span>
                )}
                {/* 功能注释：弹窗按设计稿不显示角标对勾，仅嵌入态保留已签标记 */}
                {isEmbedded && (day.state === 'signed' || day.state === 'made_up') && !day.canMakeup && (
                    <span className={styles.dayState} aria-hidden="true">✓</span>
                )}
            </button>
        );
    };

    const signInButton = status ? (
        <button
            type="button"
            className={`${styles.signInButton} ${isEmbedded ? styles.embeddedSignInButton : ''}`}
            onClick={() => void handleCheckIn()}
            disabled={isSubmitting || isFetchingStatus || !status.canClaim}
        >
            {isSubmitting ? (
                <span className={styles.buttonLoading}>
                    <span className={styles.spinner} aria-hidden="true" />
                    {t('checkIn.signingIn')}
                </span>
            ) : status.signedInToday
                ? t('checkIn.titleSignedIn')
                : isEmbedded
                    ? t('checkIn.signInForPoints', { points: status.todayReward?.totalPoints ?? 0 })
                    : t('checkIn.signInCta')}
        </button>
    ) : null;

    // 功能注释：弹窗态补签确认用全屏 portal，卡片样式自包含，避免嵌套透边与裸按钮
    const makeupLayer = makeupDialog ? (
        <div
            className={isEmbedded ? styles.makeupDialogBackdrop : styles.makeupPortal}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeMakeupDialog();
            }}
        >
            <section
                ref={makeupDialogRef}
                className={isEmbedded ? styles.makeupDialog : styles.makeupCard}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="makeup-dialog-title"
                tabIndex={-1}
            >
                {makeupDialog.kind === 'makeupConfirm' && (
                    <>
                        <h3 id="makeup-dialog-title" className={styles.makeupTitle}>
                            {t('checkIn.makeupConfirmTitle')}
                        </h3>
                        <p className={styles.makeupDesc}>
                            {t('checkIn.makeupConfirm', { date: makeupDialog.date })}
                        </p>
                        <div className={styles.makeupActions}>
                            <button
                                type="button"
                                className={styles.makeupBtnGhost}
                                onClick={closeMakeupDialog}
                            >
                                {t('checkIn.makeupCancel')}
                            </button>
                            <button
                                type="button"
                                className={styles.makeupBtnPrimary}
                                disabled={isMakeupSubmitting}
                                onClick={() => void handleMakeup(makeupDialog.date)}
                            >
                                {isMakeupSubmitting
                                    ? t('checkIn.makeupSubmitting')
                                    : t('checkIn.makeupConfirmAction')}
                            </button>
                        </div>
                    </>
                )}

                {makeupDialog.kind === 'noCard' && (
                    <>
                        <h3 id="makeup-dialog-title" className={styles.makeupTitle}>
                            {t('checkIn.makeupNoCardTitle')}
                        </h3>
                        <p className={styles.makeupDesc}>{t('checkIn.makeupNoCard')}</p>
                        <div className={styles.makeupActions}>
                            <button
                                type="button"
                                className={styles.makeupBtnGhost}
                                onClick={closeMakeupDialog}
                            >
                                {t('common.close')}
                            </button>
                            <button
                                type="button"
                                className={styles.makeupBtnPrimary}
                                onClick={handleGoToDailyTasks}
                            >
                                {t('checkIn.makeupGoEarn')}
                            </button>
                        </div>
                    </>
                )}

                {makeupDialog.kind === 'makeupSuccess' && (
                    <>
                        <h3 id="makeup-dialog-title" className={styles.makeupTitle}>
                            {t('checkIn.makeupSuccessTitle')}
                        </h3>
                        <p className={styles.makeupDesc}>
                            {t('checkIn.makeupSuccess', {
                                date: makeupDialog.date,
                                points: makeupDialog.result.pointsAdded,
                            })}
                        </p>
                        <div className={styles.makeupRewardList}>
                            <span>{t('checkIn.makeupBaseReward', {
                                points: makeupDialog.result.rewardBreakdown.basePoints,
                            })}</span>
                            {makeupDialog.result.rewardBreakdown.weeklyBonusPoints > 0 && (
                                <span>{t('checkIn.weekBonus', {
                                    points: makeupDialog.result.rewardBreakdown.weeklyBonusPoints,
                                })}</span>
                            )}
                            {makeupDialog.result.rewardBreakdown.monthlyBonusPoints > 0 && (
                                <span>{t('checkIn.monthBonus', {
                                    points: makeupDialog.result.rewardBreakdown.monthlyBonusPoints,
                                })}</span>
                            )}
                            {makeupDialog.result.membershipRewards?.length ? (
                                <span>
                                    会员补签额外永久KK币：{describeMembershipRewards(makeupDialog.result.membershipRewards)}
                                </span>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className={styles.makeupBtnPrimary}
                            onClick={closeMakeupDialog}
                        >
                            {t('common.close')}
                        </button>
                    </>
                )}
            </section>
        </div>
    ) : null;

    return (
        <div
            className={isEmbedded ? styles.embeddedRoot : styles.overlay}
            onMouseDown={(event) => {
                if (!isEmbedded && event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={modalRef}
                className={`${styles.content} ${isMonthExpanded ? styles.contentExpanded : ''} ${isEmbedded ? styles.embeddedContent : ''}`}
                role={isEmbedded ? 'region' : 'dialog'}
                aria-modal={isEmbedded ? undefined : true}
                aria-labelledby={isEmbedded ? undefined : 'check-in-dialog-title'}
                aria-label={isEmbedded ? t('checkIn.title') : undefined}
                tabIndex={-1}
            >
                {!isEmbedded && (
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label={t('common.close')}
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                )}

                {!isEmbedded && (
                    <header className={styles.header}>
                        <div>
                            <h2 id="check-in-dialog-title" className={styles.title}>{t('checkIn.title')}</h2>
                        </div>
                    </header>
                )}

                <div className={styles.scrollArea}>
                    {isFetchingStatus && !status ? (
                        <div className={styles.feedbackPanel} role="status">
                            <span className={styles.spinner} aria-hidden="true" />
                            <p>{t('checkIn.loading')}</p>
                        </div>
                    ) : hasLoadError && !status ? (
                        <div className={styles.feedbackPanel} role="alert">
                            <p>{t('checkIn.loadFailed')}</p>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void fetchSignInStatus()}
                                disabled={isFetchingStatus}
                            >
                                {t('checkIn.retry')}
                            </button>
                        </div>
                    ) : status ? (
                        <>
                            {status.month && (
                                <section className={styles.monthReward} aria-label={t('checkIn.monthRewardTitle')}>
                                    <div className={styles.rewardProgress}>
                                        <div className={styles.rewardProgressTop}>
                                            <strong>
                                                {t('checkIn.monthStreakProgress')}
                                                {' '}
                                                <b>{monthProgress}</b>
                                                /{status.month.targetDays}
                                                {' '}
                                                {t('checkIn.monthStreakDaysUnit')}
                                            </strong>
                                        </div>
                                        <div className={styles.progressTrack}>
                                            <span style={{ width: `${monthProgressPercent}%` }} />
                                        </div>
                                        <p className={styles.monthExtraHint}>
                                            {t('checkIn.monthExtraHint', { days: status.month.targetDays })}
                                        </p>
                                    </div>
                                    <div className={styles.rewardBadge} aria-label={status.month.bonusRewarded
                                        ? t('checkIn.monthRewarded', { points: status.month.bonusPoints })
                                        : t('checkIn.monthRewardRule', { days: status.month.targetDays, points: status.month.bonusPoints })}>
                                        <div className={styles.rewardBadgeText}>
                                            <span>{t('checkIn.monthExtraBadge')}</span>
                                            <strong>+{status.month.bonusPoints}</strong>
                                        </div>
                                        <span className={styles.rewardCoinGlyph} aria-hidden="true" />
                                    </div>
                                </section>
                            )}
                            <section
                                className={styles.weekSection}
                                aria-labelledby="check-in-week-title"
                            >
                                {status.week && (
                                    <>
                                        <div className={styles.sectionHeading}>
                                            <div className={styles.headingInline}>
                                                <h3 id="check-in-week-title">{t('checkIn.weekTitle')}</h3>
                                                <p>{t('checkIn.weekProgress', { days: status.week.signedDays })}</p>
                                            </div>
                                            <span className={styles.makeupCardBalance}>
                                                {t('checkIn.makeupCards', { count: status.makeupCardCount ?? 0 })}
                                            </span>
                                        </div>
                                        <div className={styles.weekGrid}>{(status.week.days ?? []).map(renderWeekDay)}</div>

                                        {mode === 'profile' && (
                                            <button
                                                type="button"
                                                className={styles.expandButton}
                                                onClick={() => setIsMonthExpanded((value) => !value)}
                                                aria-expanded={isMonthExpanded}
                                                aria-controls="check-in-month-panel"
                                            >
                                                {isMonthExpanded ? t('checkIn.collapseMonth') : t('checkIn.expandMonth')}
                                                <span className={isMonthExpanded ? styles.chevronUp : styles.chevronDown} aria-hidden="true" />
                                            </button>
                                        )}
                                    </>
                                )}

                                {mode === 'profile' && isMonthExpanded && status.month && (
                                    <section id="check-in-month-panel" className={styles.monthSection} aria-labelledby="check-in-month-title">
                                        <div className={styles.monthHeading}>
                                            <h3 id="check-in-month-title">
                                                {t('checkIn.monthTitle', { year: monthYear, month: Number(monthNumber) })}
                                            </h3>
                                        </div>
                                        <div className={styles.monthWeekdays} aria-hidden="true">
                                            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                                                <span key={weekday}>{t(`checkIn.weekdays.${getWeekdayKey(weekday)}`)}</span>
                                            ))}
                                        </div>
                                        <div className={styles.monthGrid}>
                                            {monthGrid.map((day, index) => day ? (
                                                <button
                                                    type="button"
                                                    key={day.date}
                                                    className={`${styles.monthDay} ${STATE_CLASS[day.state]}`}
                                                    aria-label={`${day.date} ${t(`checkIn.states.${day.state}`)}`}
                                                    data-can-makeup={day.canMakeup || undefined}
                                                    disabled={!day.canMakeup || isMakeupSubmitting}
                                                    onClick={(event) => openMakeupConfirm(day.date, event.currentTarget)}
                                                >
                                                    <span className={styles.monthDayNum}>{day.dayOfMonth}</span>
                                                    <small className={styles.monthDayMark}>
                                                        {day.canMakeup
                                                            ? t('checkIn.makeupAction')
                                                            : day.state === 'signed' || day.state === 'made_up'
                                                                ? '✓'
                                                                : t(`checkIn.stateMarks.${day.state}`)}
                                                    </small>
                                                </button>
                                            ) : (
                                                <span key={`empty-${index}`} className={styles.monthEmpty} aria-hidden="true" />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </section>

                        </>
                    ) : null}
                </div>

                {status && (
                    <>
                        {isEmbedded && embeddedActionContainer
                            ? createPortal(signInButton, embeddedActionContainer)
                            : null}
                        <footer className={`${styles.footer} ${isEmbedded ? styles.embeddedFooter : ''}`}>
                            {(!isEmbedded || !embeddedActionContainer) && signInButton}
                            {isEmbedded && (
                                <section className={styles.embeddedRewardInfo} aria-label={t('checkIn.embeddedRewardTitle')}>
                                    <strong>{t('checkIn.embeddedRewardTitle')}</strong>
                                    <p>{t('checkIn.weekRule')}</p>
                                    {status.month ? (
                                        <p>{status.month.bonusRewarded
                                            ? t('checkIn.monthRewarded', { points: status.month.bonusPoints })
                                            : t('checkIn.monthRewardRule', {
                                                days: status.month.targetDays,
                                                points: status.month.bonusPoints,
                                            })}</p>
                                    ) : null}
                                </section>
                            )}
                        </footer>
                    </>
                )}

                {isEmbedded ? makeupLayer : null}
            </div>
            {!isEmbedded && makeupLayer ? createPortal(makeupLayer, document.body) : null}
        </div>
    );
};

export default CheckInModal;
