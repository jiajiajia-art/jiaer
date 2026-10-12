import React, { useCallback, useEffect, useState } from 'react';
import {
  IoAlertCircleOutline,
  IoCheckmarkCircle,
  IoDocumentTextOutline,
  IoRefresh,
  IoSearch,
  IoSettingsOutline,
} from 'react-icons/io5';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import ConfirmModal from './CommonModal/ConfirmModal';
import creatorBenefitsApi from '../api/creatorBenefits/creatorBenefitsApi';
import type {
  AdminCreatorBenefitUser,
  AdminManagedGame,
  AdminManagedGameResult,
} from '../api/creatorBenefits/creatorBenefits.type';
import { getApiErrorMessage } from '../utils/error';
import gamePublishAppealsApi from '../api/gamePublishAppeals/gamePublishAppealsApi';
import type {
  AdminGamePublishAppealResult,
  GamePublishAppeal,
  GamePublishAppealStatus,
} from '../api/gamePublishAppeals/gamePublishAppeals.type';
import styles from './CreatorBenefitsAdminManager.module.css';

export type CreatorBenefitsAdminView = 'benefits' | 'games';
type GameAction = { type: 'takedown' | 'restore'; game: AdminManagedGame } | null;
type GamesSection = 'works' | 'appeals';
type AppealReviewAction = { decision: 'approved' | 'rejected'; appeal: GamePublishAppeal } | null;

interface CreatorBenefitsAdminManagerProps {
  view: CreatorBenefitsAdminView;
  appealPendingCount?: number;
  onAppealPendingCountChange?: (count: number) => void;
}

const EMPTY_GAMES: AdminManagedGameResult = {
  list: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const EMPTY_APPEALS: AdminGamePublishAppealResult = {
  list: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  pendingCount: 0,
};

const formatPercent = (ratio: number) => `${Math.round((Number(ratio) || 0) * 100)}%`;
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const CreatorBenefitsAdminManager: React.FC<CreatorBenefitsAdminManagerProps> = ({
  view,
  appealPendingCount = 0,
  onAppealPendingCountChange,
}) => {
  const { t } = useTranslation();
  const [userKeyword, setUserKeyword] = useState('');
  const [users, setUsers] = useState<AdminCreatorBenefitUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminCreatorBenefitUser | null>(null);
  const [specialDraft, setSpecialDraft] = useState({
    enabled: false,
    editorPercent: 45,
    customPercent: 85,
    freeTxtCreation: false,
    note: '',
  });
  const [isSavingSpecial, setIsSavingSpecial] = useState(false);

  const [gameKeyword, setGameKeyword] = useState('');
  const [gameStatus, setGameStatus] = useState('published');
  const [gamePage, setGamePage] = useState(1);
  const [games, setGames] = useState<AdminManagedGameResult>(EMPTY_GAMES);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gameAction, setGameAction] = useState<GameAction>(null);
  const [actionReason, setActionReason] = useState('');
  const [keepLevelContribution, setKeepLevelContribution] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState(false);
  const [contributionTarget, setContributionTarget] = useState<AdminManagedGame | null>(null);
  const [isSavingGame, setIsSavingGame] = useState(false);
  const [gamesSection, setGamesSection] = useState<GamesSection>('works');
  const [appealKeyword, setAppealKeyword] = useState('');
  const [appealStatus, setAppealStatus] = useState<GamePublishAppealStatus | ''>('pending');
  const [appealPage, setAppealPage] = useState(1);
  const [appeals, setAppeals] = useState<AdminGamePublishAppealResult>(EMPTY_APPEALS);
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false);
  const [appealReviewAction, setAppealReviewAction] = useState<AppealReviewAction>(null);
  const [appealReviewRemark, setAppealReviewRemark] = useState('');
  const [isAppealConfirmOpen, setIsAppealConfirmOpen] = useState(false);
  const [isReviewingAppeal, setIsReviewingAppeal] = useState(false);
  const displayedAppealPendingCount = appeals.pendingCount || appealPendingCount;

  const loadGames = useCallback(async () => {
    setIsLoadingGames(true);
    try {
      const response = await creatorBenefitsApi.listManagedGames({
        keyword: gameKeyword.trim() || undefined,
        status: gameStatus || undefined,
        page: gamePage,
        pageSize: 20,
      });
      setGames(response.data.data || EMPTY_GAMES);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.gamesLoadFailed')));
    } finally {
      setIsLoadingGames(false);
    }
  }, [gameKeyword, gamePage, gameStatus, t]);

  useEffect(() => {
    if (view === 'games' && gamesSection === 'works') void loadGames();
  }, [gamesSection, loadGames, view]);

  const loadAppeals = useCallback(async () => {
    setIsLoadingAppeals(true);
    try {
      const response = await gamePublishAppealsApi.listAdminAppeals({
        keyword: appealKeyword.trim() || undefined,
        status: appealStatus,
        page: appealPage,
        pageSize: 20,
      });
      const result = response.data.data || EMPTY_APPEALS;
      setAppeals(result);
      onAppealPendingCountChange?.(result.pendingCount);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.appealsLoadFailed')));
    } finally {
      setIsLoadingAppeals(false);
    }
  }, [appealKeyword, appealPage, appealStatus, onAppealPendingCountChange, t]);

  useEffect(() => {
    if (view === 'games' && gamesSection === 'appeals') void loadAppeals();
  }, [gamesSection, loadAppeals, view]);

  useEffect(() => {
    if (view !== 'games') return;
    let cancelled = false;
    const loadPendingCount = async () => {
      try {
        const response = await gamePublishAppealsApi.getPendingCount();
        const count = Number(response.data.data?.pendingCount || 0);
        if (!cancelled) {
          setAppeals((current) => ({ ...current, pendingCount: count }));
          onAppealPendingCountChange?.(count);
        }
      } catch {
        // 角标获取失败不阻断作品管理主流程。
      }
    };
    void loadPendingCount();
    return () => {
      cancelled = true;
    };
  }, [onAppealPendingCountChange, view]);

  const handleSearchUsers = async () => {
    const keyword = userKeyword.trim();
    if (!keyword) {
      toast.error(t('creatorBenefitsAdmin.keywordRequired'));
      return;
    }
    setIsSearchingUsers(true);
    try {
      const response = await creatorBenefitsApi.searchUsers(keyword);
      setUsers(response.data.data?.list || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.userSearchFailed')));
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const openSpecialEditor = (user: AdminCreatorBenefitUser) => {
    setEditingUser(user);
    setSpecialDraft({
      enabled: user.benefits.isSpecialAuthor,
      editorPercent: Math.round(user.benefits.editorShareRatio * 100),
      customPercent: Math.round(user.benefits.customShareRatio * 100),
      freeTxtCreation: user.benefits.freeTxtCreation,
      note: user.benefits.specialNote || '',
    });
  };

  const handleSaveSpecial = async () => {
    if (!editingUser) return;
    if (
      specialDraft.enabled
      && (!Number.isFinite(specialDraft.editorPercent)
        || !Number.isFinite(specialDraft.customPercent)
        || specialDraft.editorPercent < 0
        || specialDraft.editorPercent > 100
        || specialDraft.customPercent < 0
        || specialDraft.customPercent > 100)
    ) {
      toast.error(t('creatorBenefitsAdmin.ratioInvalid'));
      return;
    }
    setIsSavingSpecial(true);
    try {
      const response = await creatorBenefitsApi.updateSpecialAuthor(editingUser.userId, {
        enabled: specialDraft.enabled,
        editorShareRatio: specialDraft.editorPercent / 100,
        customShareRatio: specialDraft.customPercent / 100,
        freeTxtCreation: specialDraft.freeTxtCreation,
        note: specialDraft.note.trim(),
      });
      const benefits = response.data.data;
      if (benefits) {
        setUsers((current) => current.map((user) => (
          user.userId === editingUser.userId ? { ...user, benefits } : user
        )));
      }
      setEditingUser(null);
      toast.success(t('creatorBenefitsAdmin.specialSaved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.specialSaveFailed')));
    } finally {
      setIsSavingSpecial(false);
    }
  };

  const openGameAction = (type: 'takedown' | 'restore', game: AdminManagedGame) => {
    setGameAction({ type, game });
    setActionReason(type === 'restore' ? t('creatorBenefitsAdmin.restoreDefaultReason') : '');
    setKeepLevelContribution(game.keepLevelContribution);
    setSendNotification(true);
  };

  const requestGameActionConfirmation = () => {
    if (gameAction?.type === 'takedown' && !actionReason.trim()) {
      toast.error(t('creatorBenefitsAdmin.reasonRequired'));
      return;
    }
    setIsFinalConfirmOpen(true);
  };

  const executeGameAction = async () => {
    if (!gameAction) return;
    setIsSavingGame(true);
    setIsFinalConfirmOpen(false);
    try {
      if (gameAction.type === 'takedown') {
        await creatorBenefitsApi.takedownGame(gameAction.game.fileId, {
          reason: actionReason.trim(),
          keepLevelContribution,
          sendNotification,
        });
      } else {
        await creatorBenefitsApi.restoreGame(gameAction.game.fileId, {
          reason: actionReason.trim(),
          sendNotification,
        });
      }
      toast.success(t('creatorBenefitsAdmin.gameUpdated'));
      setGameAction(null);
      await loadGames();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.gameUpdateFailed')));
    } finally {
      setIsSavingGame(false);
    }
  };

  const executeContributionUpdate = async () => {
    if (!contributionTarget) return;
    setIsSavingGame(true);
    try {
      await creatorBenefitsApi.updateLevelContribution(
        contributionTarget.fileId,
        !contributionTarget.keepLevelContribution,
      );
      setContributionTarget(null);
      toast.success(t('creatorBenefitsAdmin.contributionUpdated'));
      await loadGames();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.gameUpdateFailed')));
    } finally {
      setIsSavingGame(false);
    }
  };

  const openAppealReview = (decision: 'approved' | 'rejected', appeal: GamePublishAppeal) => {
    setAppealReviewAction({ decision, appeal });
    setAppealReviewRemark('');
  };

  const requestAppealReviewConfirmation = () => {
    if (!appealReviewRemark.trim()) {
      toast.error(t('creatorBenefitsAdmin.appealRemarkRequired'));
      return;
    }
    setIsAppealConfirmOpen(true);
  };

  const executeAppealReview = async () => {
    if (!appealReviewAction || isReviewingAppeal) return;
    setIsAppealConfirmOpen(false);
    setIsReviewingAppeal(true);
    try {
      if (appealReviewAction.decision === 'approved') {
        await gamePublishAppealsApi.approveAppeal(
          appealReviewAction.appeal.id,
          appealReviewRemark.trim(),
        );
      } else {
        await gamePublishAppealsApi.rejectAppeal(
          appealReviewAction.appeal.id,
          appealReviewRemark.trim(),
        );
      }
      toast.success(t('creatorBenefitsAdmin.appealReviewed'));
      setAppealReviewAction(null);
      setAppealReviewRemark('');
      await Promise.all([loadAppeals(), loadGames()]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.appealReviewFailed')));
    } finally {
      setIsReviewingAppeal(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <span>{t('creatorBenefitsAdmin.eyebrow')}</span>
          <h2>{t(view === 'benefits' ? 'creatorBenefitsAdmin.specialTitle' : 'creatorBenefitsAdmin.gamesTitle')}</h2>
          <p>{t(view === 'benefits' ? 'creatorBenefitsAdmin.specialSubtitle' : 'creatorBenefitsAdmin.gamesSubtitle')}</p>
        </div>
      </header>

      {view === 'benefits' ? (
        <section className={styles.section}>
          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <span>{t('creatorBenefitsAdmin.userKeyword')}</span>
              <input value={userKeyword} onChange={(event) => setUserKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleSearchUsers(); }} />
            </label>
            <button type="button" className={styles.primaryButton} onClick={() => void handleSearchUsers()} disabled={isSearchingUsers}>
              <IoSearch aria-hidden="true" />
              {isSearchingUsers ? t('creatorBenefitsAdmin.searching') : t('creatorBenefitsAdmin.search')}
            </button>
          </div>

          <div className={styles.userList}>
            {users.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.searchUserEmpty')}</div> : users.map((user) => (
              <div key={user.userId} className={styles.userRow}>
                <div className={styles.userIdentity}>
                  <strong>{user.nickname || user.userCode}</strong>
                  <span>{user.userCode} · {user.phoneNumber || '-'}</span>
                </div>
                <div className={styles.userBenefits}>
                  <span>{user.benefits.label}</span>
                  <span>{t('creatorBenefitsAdmin.editorShort')} {formatPercent(user.benefits.editorShareRatio)}</span>
                  <span>{t('creatorBenefitsAdmin.customShort')} {formatPercent(user.benefits.customShareRatio)}</span>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={() => openSpecialEditor(user)}>
                  <IoSettingsOutline aria-hidden="true" />
                  {t('creatorBenefitsAdmin.configure')}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.section}>
          <div className={styles.managementTabs} role="tablist" aria-label={t('creatorBenefitsAdmin.gamesManagementTabs')}>
            <button
              type="button"
              role="tab"
              aria-selected={gamesSection === 'works'}
              className={gamesSection === 'works' ? styles.managementTabActive : ''}
              onClick={() => setGamesSection('works')}
            >
              <IoDocumentTextOutline aria-hidden="true" />
              {t('creatorBenefitsAdmin.worksSection')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={gamesSection === 'appeals'}
              className={gamesSection === 'appeals' ? styles.managementTabActive : ''}
              onClick={() => setGamesSection('appeals')}
            >
              <IoAlertCircleOutline aria-hidden="true" />
              {t('creatorBenefitsAdmin.appealsSection')}
              {displayedAppealPendingCount > 0 ? (
                <span className={styles.pendingBadge}>{displayedAppealPendingCount > 99 ? '99+' : displayedAppealPendingCount}</span>
              ) : null}
            </button>
          </div>

          {gamesSection === 'works' ? (
            <>
              <div className={styles.toolbar}>
                <label className={styles.searchField}>
                  <span>{t('creatorBenefitsAdmin.gameKeyword')}</span>
                  <input value={gameKeyword} onChange={(event) => { setGameKeyword(event.target.value); setGamePage(1); }} />
                </label>
                <label className={styles.selectField}>
                  <span>{t('creatorBenefitsAdmin.statusLabel')}</span>
                  <select value={gameStatus} onChange={(event) => { setGameStatus(event.target.value); setGamePage(1); }}>
                    <option value="">{t('creatorBenefitsAdmin.allStatuses')}</option>
                    <option value="published">{t('creatorBenefits.status.published')}</option>
                    <option value="operator_takedown">{t('creatorBenefits.status.operator_takedown')}</option>
                    <option value="unpublished">{t('creatorBenefits.status.unpublished')}</option>
                    <option value="deleted">{t('creatorBenefits.status.deleted')}</option>
                  </select>
                </label>
                <button type="button" className={styles.secondaryButton} onClick={() => void loadGames()} disabled={isLoadingGames}>
                  <IoRefresh aria-hidden="true" />
                  {t('creatorBenefitsAdmin.refresh')}
                </button>
              </div>

              <div className={styles.gameTable} role="table" aria-label={t('creatorBenefitsAdmin.gamesTab')}>
                <div className={styles.gameHeader} role="row">
                  <span>{t('creatorBenefitsAdmin.work')}</span>
                  <span>{t('creatorBenefitsAdmin.creator')}</span>
                  <span>{t('creatorBenefitsAdmin.pv')}</span>
                  <span>{t('creatorBenefitsAdmin.statusLabel')}</span>
                  <span>{t('creatorBenefitsAdmin.actions')}</span>
                </div>
                {isLoadingGames ? <div className={styles.empty}>{t('creatorBenefitsAdmin.loadingGames')}</div> : null}
                {!isLoadingGames && games.list.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.noGames')}</div> : null}
                {!isLoadingGames && games.list.map((game) => (
                  <div key={game.fileId} className={styles.gameRow} role="row">
                    <div data-label={t('creatorBenefitsAdmin.work')} className={styles.workCell}>
                      <strong>{game.title}</strong>
                      <span>{game.engine || '-'} · {game.fileId}</span>
                      {game.takedownReason ? <small>{game.takedownReason}</small> : null}
                    </div>
                    <div data-label={t('creatorBenefitsAdmin.creator')} className={styles.creatorCell}>
                      <strong>{game.creator.nickname || game.creator.userCode}</strong>
                      <span>{game.creator.userCode || game.creatorUserId}</span>
                    </div>
                    <div data-label={t('creatorBenefitsAdmin.pv')} className={styles.numericCell}>{game.pv.toLocaleString('zh-CN')}</div>
                    <div data-label={t('creatorBenefitsAdmin.statusLabel')}>
                      <span className={styles.statusTag}>{t(`creatorBenefits.status.${game.status}`)}</span>
                      {game.status === 'operator_takedown' ? (
                        <label className={styles.contributionToggle}>
                          <input
                            type="checkbox"
                            checked={game.keepLevelContribution}
                            onChange={() => setContributionTarget(game)}
                            disabled={isSavingGame}
                          />
                          <span>{t('creatorBenefitsAdmin.keepContribution')}</span>
                        </label>
                      ) : null}
                    </div>
                    <div data-label={t('creatorBenefitsAdmin.actions')} className={styles.actionsCell}>
                      {game.status === 'published' ? (
                        <button type="button" className={styles.dangerButton} onClick={() => openGameAction('takedown', game)}>{t('creatorBenefitsAdmin.takedown')}</button>
                      ) : null}
                      {game.status === 'operator_takedown' ? (
                        <button type="button" className={styles.secondaryButton} onClick={() => openGameAction('restore', game)}>{t('creatorBenefitsAdmin.restore')}</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.pagination}>
                <span>{t('creatorBenefitsAdmin.pageSummary', { page: games.pagination.page, totalPages: games.pagination.totalPages, total: games.pagination.total })}</span>
                <div>
                  <button type="button" onClick={() => setGamePage((page) => Math.max(1, page - 1))} disabled={gamePage <= 1 || isLoadingGames}>{t('creatorBenefitsAdmin.previous')}</button>
                  <button type="button" onClick={() => setGamePage((page) => Math.min(games.pagination.totalPages, page + 1))} disabled={gamePage >= games.pagination.totalPages || isLoadingGames}>{t('creatorBenefitsAdmin.next')}</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.toolbar}>
                <label className={styles.searchField}>
                  <span>{t('creatorBenefitsAdmin.appealKeyword')}</span>
                  <input
                    value={appealKeyword}
                    onChange={(event) => { setAppealKeyword(event.target.value); setAppealPage(1); }}
                    onKeyDown={(event) => { if (event.key === 'Enter') void loadAppeals(); }}
                  />
                </label>
                <label className={styles.selectField}>
                  <span>{t('creatorBenefitsAdmin.appealStatus')}</span>
                  <select
                    value={appealStatus}
                    onChange={(event) => {
                      setAppealStatus(event.target.value as GamePublishAppealStatus | '');
                      setAppealPage(1);
                    }}
                  >
                    <option value="">{t('creatorBenefitsAdmin.allAppealStatuses')}</option>
                    <option value="pending">{t('creatorBenefitsAdmin.appealPending')}</option>
                    <option value="approved">{t('creatorBenefitsAdmin.appealApproved')}</option>
                    <option value="rejected">{t('creatorBenefitsAdmin.appealRejected')}</option>
                  </select>
                </label>
                <button type="button" className={styles.secondaryButton} onClick={() => void loadAppeals()} disabled={isLoadingAppeals}>
                  <IoRefresh aria-hidden="true" />
                  {t('creatorBenefitsAdmin.refresh')}
                </button>
              </div>

              <div className={styles.appealList}>
                {isLoadingAppeals ? <div className={styles.empty}>{t('creatorBenefitsAdmin.appealsLoading')}</div> : null}
                {!isLoadingAppeals && appeals.list.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.noAppeals')}</div> : null}
                {!isLoadingAppeals && appeals.list.map((appeal) => (
                  <article key={appeal.id} className={styles.appealCard}>
                    <header className={styles.appealCardHeader}>
                      <div className={styles.appealTitle}>
                        <span className={`${styles.appealStatus} ${styles[`appealStatus_${appeal.status}`]}`}>
                          {t(`creatorBenefitsAdmin.appealStatus_${appeal.status}`)}
                        </span>
                        <h3>{appeal.gameTitle || appeal.fileId}</h3>
                        <small>{appeal.gameEngine || '-'} · {appeal.fileId}</small>
                      </div>
                      <div className={styles.appealCreator}>
                        <strong>{appeal.creator?.nickname || appeal.creator?.userCode || appeal.userId}</strong>
                        <span>{appeal.creator?.userCode || appeal.userId} · {appeal.creator?.phoneNumber || '-'}</span>
                      </div>
                    </header>
                    <div className={styles.appealDetails}>
                      <div>
                        <span>{t('creatorBenefitsAdmin.originalTakedownReason')}</span>
                        <p>{appeal.takedownReason || t('creatorBenefitsAdmin.noTakedownReason')}</p>
                        <small>{t('creatorBenefitsAdmin.takedownAt')} {formatDateTime(appeal.takedownAt)}</small>
                      </div>
                      <div>
                        <span>{t('creatorBenefitsAdmin.userAppealReason')}</span>
                        <p>{appeal.appealReason}</p>
                        <small>{t('creatorBenefitsAdmin.submittedAt')} {formatDateTime(appeal.createdAt)}</small>
                      </div>
                      {appeal.reviewRemark ? (
                        <div className={styles.reviewedRemark}>
                          <span>{t('creatorBenefitsAdmin.reviewRemark')}</span>
                          <p>{appeal.reviewRemark}</p>
                          <small>{t('creatorBenefitsAdmin.reviewedAt')} {formatDateTime(appeal.reviewedAt)}</small>
                        </div>
                      ) : null}
                    </div>
                    {appeal.status === 'pending' ? (
                      <footer className={styles.appealActions}>
                        <button type="button" className={styles.dangerButton} onClick={() => openAppealReview('rejected', appeal)}>
                          {t('creatorBenefitsAdmin.rejectAppeal')}
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => openAppealReview('approved', appeal)}>
                          {t('creatorBenefitsAdmin.approveAppeal')}
                        </button>
                      </footer>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className={styles.pagination}>
                <span>{t('creatorBenefitsAdmin.pageSummary', { page: appeals.pagination.page, totalPages: appeals.pagination.totalPages, total: appeals.pagination.total })}</span>
                <div>
                  <button type="button" onClick={() => setAppealPage((page) => Math.max(1, page - 1))} disabled={appealPage <= 1 || isLoadingAppeals}>{t('creatorBenefitsAdmin.previous')}</button>
                  <button type="button" onClick={() => setAppealPage((page) => Math.min(appeals.pagination.totalPages, page + 1))} disabled={appealPage >= appeals.pagination.totalPages || isLoadingAppeals}>{t('creatorBenefitsAdmin.next')}</button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {editingUser ? (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingSpecial) setEditingUser(null); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="special-author-title">
            <header>
              <div>
                <span>{editingUser.userCode}</span>
                <h3 id="special-author-title">{t('creatorBenefitsAdmin.specialEditorTitle')}</h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setEditingUser(null)} aria-label={t('creatorBenefitsAdmin.close')}>×</button>
            </header>
            <div className={styles.formBody}>
              <label className={styles.switchField}>
                <input type="checkbox" checked={specialDraft.enabled} onChange={(event) => setSpecialDraft((draft) => ({ ...draft, enabled: event.target.checked }))} />
                <span>{t('creatorBenefitsAdmin.enableSpecial')}</span>
              </label>
              <div className={styles.formGrid}>
                <label>
                  <span>{t('creatorBenefitsAdmin.editorPercent')}</span>
                  <input type="number" min="0" max="100" step="0.1" value={specialDraft.editorPercent} onChange={(event) => setSpecialDraft((draft) => ({ ...draft, editorPercent: Number(event.target.value) }))} disabled={!specialDraft.enabled} />
                  <small>{t('creatorBenefitsAdmin.editorRecommended')}</small>
                </label>
                <label>
                  <span>{t('creatorBenefitsAdmin.customPercent')}</span>
                  <input type="number" min="0" max="100" step="0.1" value={specialDraft.customPercent} onChange={(event) => setSpecialDraft((draft) => ({ ...draft, customPercent: Number(event.target.value) }))} disabled={!specialDraft.enabled} />
                  <small>{t('creatorBenefitsAdmin.customRecommended')}</small>
                </label>
              </div>
              <label className={styles.switchField}>
                <input type="checkbox" checked={specialDraft.freeTxtCreation} onChange={(event) => setSpecialDraft((draft) => ({ ...draft, freeTxtCreation: event.target.checked }))} disabled={!specialDraft.enabled} />
                <span>{t('creatorBenefitsAdmin.freeTxtCreation')}</span>
              </label>
              <label className={styles.textareaField}>
                <span>{t('creatorBenefitsAdmin.note')}</span>
                <textarea maxLength={500} value={specialDraft.note} onChange={(event) => setSpecialDraft((draft) => ({ ...draft, note: event.target.value }))} />
              </label>
            </div>
            <footer>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditingUser(null)} disabled={isSavingSpecial}>{t('creatorBenefitsAdmin.cancel')}</button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSaveSpecial()} disabled={isSavingSpecial}>
                <IoCheckmarkCircle aria-hidden="true" />
                {isSavingSpecial ? t('creatorBenefitsAdmin.saving') : t('creatorBenefitsAdmin.save')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {gameAction ? (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingGame) setGameAction(null); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="game-action-title">
            <header>
              <div>
                <span>{gameAction.game.fileId}</span>
                <h3 id="game-action-title">{gameAction.type === 'takedown' ? t('creatorBenefitsAdmin.takedownTitle') : t('creatorBenefitsAdmin.restoreTitle')}</h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setGameAction(null)} aria-label={t('creatorBenefitsAdmin.close')}>×</button>
            </header>
            <div className={styles.formBody}>
              <div className={styles.actionWorkName}>{gameAction.game.title}</div>
              <label className={styles.textareaField}>
                <span>{t('creatorBenefitsAdmin.reason')}</span>
                <textarea maxLength={500} value={actionReason} onChange={(event) => setActionReason(event.target.value)} />
              </label>
              {gameAction.type === 'takedown' ? (
                <label className={styles.switchField}>
                  <input type="checkbox" checked={keepLevelContribution} onChange={(event) => setKeepLevelContribution(event.target.checked)} />
                  <span>{t('creatorBenefitsAdmin.keepContribution')}</span>
                </label>
              ) : null}
              <label className={styles.switchField}>
                <input type="checkbox" checked={sendNotification} onChange={(event) => setSendNotification(event.target.checked)} />
                <span>{t('creatorBenefitsAdmin.sendNotification')}</span>
              </label>
            </div>
            <footer>
              <button type="button" className={styles.secondaryButton} onClick={() => setGameAction(null)}>{t('creatorBenefitsAdmin.cancel')}</button>
              <button type="button" className={gameAction.type === 'takedown' ? styles.dangerButton : styles.primaryButton} onClick={requestGameActionConfirmation}>
                {t('creatorBenefitsAdmin.continue')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {appealReviewAction ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isReviewingAppeal) setAppealReviewAction(null);
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appeal-review-title">
            <header>
              <div>
                <span>{appealReviewAction.appeal.fileId}</span>
                <h3 id="appeal-review-title">
                  {appealReviewAction.decision === 'approved'
                    ? t('creatorBenefitsAdmin.approveAppealTitle')
                    : t('creatorBenefitsAdmin.rejectAppealTitle')}
                </h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setAppealReviewAction(null)} aria-label={t('creatorBenefitsAdmin.close')}>×</button>
            </header>
            <div className={styles.formBody}>
              <div className={styles.actionWorkName}>{appealReviewAction.appeal.gameTitle}</div>
              <div className={styles.reviewContext}>
                <span>{t('creatorBenefitsAdmin.originalTakedownReason')}</span>
                <p>{appealReviewAction.appeal.takedownReason || t('creatorBenefitsAdmin.noTakedownReason')}</p>
              </div>
              <div className={styles.reviewContext}>
                <span>{t('creatorBenefitsAdmin.userAppealReason')}</span>
                <p>{appealReviewAction.appeal.appealReason}</p>
              </div>
              <label className={styles.textareaField}>
                <span>{t('creatorBenefitsAdmin.reviewRemarkRequired')}</span>
                <textarea
                  maxLength={500}
                  value={appealReviewRemark}
                  onChange={(event) => setAppealReviewRemark(event.target.value)}
                  placeholder={t('creatorBenefitsAdmin.reviewRemarkPlaceholder')}
                  disabled={isReviewingAppeal}
                />
              </label>
            </div>
            <footer>
              <button type="button" className={styles.secondaryButton} onClick={() => setAppealReviewAction(null)} disabled={isReviewingAppeal}>{t('creatorBenefitsAdmin.cancel')}</button>
              <button
                type="button"
                className={appealReviewAction.decision === 'approved' ? styles.primaryButton : styles.dangerButton}
                onClick={requestAppealReviewConfirmation}
                disabled={isReviewingAppeal}
              >
                {t('creatorBenefitsAdmin.continue')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={isFinalConfirmOpen}
        onCancel={() => setIsFinalConfirmOpen(false)}
        onConfirm={() => void executeGameAction()}
        title={t('creatorBenefitsAdmin.finalConfirmTitle')}
        message={gameAction?.type === 'takedown' ? t('creatorBenefitsAdmin.finalTakedownMessage') : t('creatorBenefitsAdmin.finalRestoreMessage')}
        confirmButtonText={t('creatorBenefitsAdmin.confirm')}
        cancelButtonText={t('creatorBenefitsAdmin.cancel')}
      />
      <ConfirmModal
        isOpen={isAppealConfirmOpen}
        onCancel={() => setIsAppealConfirmOpen(false)}
        onConfirm={() => void executeAppealReview()}
        title={t('creatorBenefitsAdmin.appealFinalConfirmTitle')}
        message={appealReviewAction?.decision === 'approved'
          ? t('creatorBenefitsAdmin.approveAppealConfirmMessage')
          : t('creatorBenefitsAdmin.rejectAppealConfirmMessage')}
        confirmButtonText={t('creatorBenefitsAdmin.confirm')}
        cancelButtonText={t('creatorBenefitsAdmin.cancel')}
      />
      <ConfirmModal
        isOpen={Boolean(contributionTarget)}
        onCancel={() => setContributionTarget(null)}
        onConfirm={() => void executeContributionUpdate()}
        title={t('creatorBenefitsAdmin.contributionConfirmTitle')}
        message={contributionTarget?.keepLevelContribution ? t('creatorBenefitsAdmin.excludeContributionMessage') : t('creatorBenefitsAdmin.includeContributionMessage')}
        confirmButtonText={t('creatorBenefitsAdmin.confirm')}
        cancelButtonText={t('creatorBenefitsAdmin.cancel')}
      />
    </div>
  );
};

export default CreatorBenefitsAdminManager;
