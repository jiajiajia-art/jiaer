import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IoAdd,
  IoCheckmarkCircle,
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
  AdminCreatorBenefitUserResult,
  AdminManagedGame,
  AdminManagedGameResult,
  CreatorAuthorType,
} from '../api/creatorBenefits/creatorBenefits.type';
import { authorTypeLabel, formatCreatorQuarterRange } from '../lib/creatorLevelView';
import { clampAuthorPage, isExistingSpecialAuthor } from '../lib/specialAuthorAdminView';
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

const EMPTY_AUTHORS: AdminCreatorBenefitUserResult = {
  list: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const formatPercent = (ratio: number) => `${Math.round((Number(ratio) || 0) * 100)}%`;
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const CreatorBenefitsAdminManager: React.FC<CreatorBenefitsAdminManagerProps> = ({
  view,
  onAppealPendingCountChange,
}) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [authorKeyword, setAuthorKeyword] = useState('');
  const [authorSearchKeyword, setAuthorSearchKeyword] = useState('');
  const [authorTypeFilter, setAuthorTypeFilter] = useState<'' | 'contracted' | 'special'>('');
  const [authorPage, setAuthorPage] = useState(1);
  const [authors, setAuthors] = useState<AdminCreatorBenefitUserResult>(EMPTY_AUTHORS);
  const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
  const authorLoadVersion = useRef(0);
  const [isAddAuthorOpen, setIsAddAuthorOpen] = useState(false);
  const [addUserKeyword, setAddUserKeyword] = useState('');
  const [addUserPage, setAddUserPage] = useState(1);
  const [addUsers, setAddUsers] = useState<AdminCreatorBenefitUserResult>(EMPTY_AUTHORS);
  const [hasSearchedAddUsers, setHasSearchedAddUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminCreatorBenefitUser | null>(null);
  const [authorDraft, setAuthorDraft] = useState({
    authorType: 'regular' as CreatorAuthorType,
    editorPercent: 22,
    customPercent: 80,
    freeTxtCreation: false,
    note: '',
  });
  const [isSavingAuthor, setIsSavingAuthor] = useState(false);

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
  const gamesSection: GamesSection = location.pathname.endsWith('/appeals') ? 'appeals' : 'works';
  const [appealKeyword, setAppealKeyword] = useState('');
  const [appealStatus, setAppealStatus] = useState<GamePublishAppealStatus | ''>('pending');
  const [appealPage, setAppealPage] = useState(1);
  const [appeals, setAppeals] = useState<AdminGamePublishAppealResult>(EMPTY_APPEALS);
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false);
  const [appealReviewAction, setAppealReviewAction] = useState<AppealReviewAction>(null);
  const [appealReviewRemark, setAppealReviewRemark] = useState('');
  const [isAppealConfirmOpen, setIsAppealConfirmOpen] = useState(false);
  const [isReviewingAppeal, setIsReviewingAppeal] = useState(false);

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

  const loadAuthors = useCallback(async (page = authorPage) => {
    const requestVersion = ++authorLoadVersion.current;
    setIsLoadingAuthors(true);
    try {
      const response = await creatorBenefitsApi.listAuthors({
        keyword: authorSearchKeyword || undefined,
        authorType: authorTypeFilter,
        page,
        pageSize: 20,
      });
      if (requestVersion !== authorLoadVersion.current) return;
      const result = response.data.data || EMPTY_AUTHORS;
      setAuthors(result);
      const validPage = clampAuthorPage(page, result.pagination.totalPages);
      if (validPage !== page) setAuthorPage(validPage);
    } catch (error) {
      if (requestVersion === authorLoadVersion.current) {
        toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.authorsLoadFailed')));
      }
    } finally {
      if (requestVersion === authorLoadVersion.current) setIsLoadingAuthors(false);
    }
  }, [authorPage, authorSearchKeyword, authorTypeFilter, t]);

  useEffect(() => {
    if (view === 'benefits') void loadAuthors(authorPage);
  }, [authorPage, loadAuthors, view]);

  const handleSearchAuthors = () => {
    const keyword = authorKeyword.trim();
    if (keyword === authorSearchKeyword && authorPage === 1) {
      void loadAuthors(1);
      return;
    }
    setAuthorSearchKeyword(keyword);
    setAuthorPage(1);
  };

  const handleSearchUsers = async (page = 1) => {
    const keyword = addUserKeyword.trim();
    if (!keyword) {
      toast.error(t('creatorBenefitsAdmin.keywordRequired'));
      return;
    }
    setIsSearchingUsers(true);
    try {
      const response = await creatorBenefitsApi.searchUsers({ keyword, page, pageSize: 20 });
      setAddUsers(response.data.data || EMPTY_AUTHORS);
      setAddUserPage(page);
      setHasSearchedAddUsers(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.userSearchFailed')));
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const openAuthorEditor = (user: AdminCreatorBenefitUser, adding = false) => {
    setIsAddingAuthor(adding);
    setEditingUser(user);
    setAuthorDraft({
      authorType: adding ? 'contracted' : user.benefits.authorType,
      editorPercent: user.benefits.isSpecialAuthor
        ? Math.round(user.benefits.editorShareRatio * 100)
        : 22,
      customPercent: user.benefits.isSpecialAuthor
        ? Math.round(user.benefits.customShareRatio * 100)
        : 80,
      freeTxtCreation: user.benefits.freeTxtCreation,
      note: user.benefits.authorNote || user.benefits.specialNote || '',
    });
  };

  const closeAuthorEditor = () => {
    setEditingUser(null);
    setIsAddingAuthor(false);
  };

  const handleSaveAuthor = async () => {
    if (!editingUser) return;
    if (
      authorDraft.authorType === 'special'
      && (!Number.isFinite(authorDraft.editorPercent)
        || !Number.isFinite(authorDraft.customPercent)
        || authorDraft.editorPercent < 0
        || authorDraft.editorPercent > 100
        || authorDraft.customPercent < 0
        || authorDraft.customPercent > 100)
    ) {
      toast.error(t('creatorBenefitsAdmin.ratioInvalid'));
      return;
    }
    setIsSavingAuthor(true);
    try {
      await creatorBenefitsApi.updateAuthor(editingUser.userId, {
        authorType: authorDraft.authorType,
        ...(authorDraft.authorType === 'special' ? {
          editorShareRatio: authorDraft.editorPercent / 100,
          customShareRatio: authorDraft.customPercent / 100,
          freeTxtCreation: authorDraft.freeTxtCreation,
        } : {}),
        note: authorDraft.note.trim(),
      });
      setEditingUser(null);
      if (isAddingAuthor) {
        setIsAddAuthorOpen(false);
        setIsAddingAuthor(false);
      }
      toast.success(t('creatorBenefitsAdmin.authorSaved'));
      await loadAuthors(authorPage);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('creatorBenefitsAdmin.authorSaveFailed')));
    } finally {
      setIsSavingAuthor(false);
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
      {view === 'benefits' ? (
        <section className={styles.section}>
          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <span>{t('creatorBenefitsAdmin.userKeyword')}</span>
              <input value={authorKeyword} onChange={(event) => setAuthorKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSearchAuthors(); }} />
            </label>
            <button type="button" className={styles.secondaryButton} onClick={handleSearchAuthors} disabled={isLoadingAuthors}>
              <IoSearch aria-hidden="true" />
              {t('creatorBenefitsAdmin.search')}
            </button>
            <label className={styles.selectField}>
              <span>{t('creatorBenefitsAdmin.authorTypeFilter')}</span>
              <select value={authorTypeFilter} onChange={(event) => { setAuthorTypeFilter(event.target.value as '' | 'contracted' | 'special'); setAuthorPage(1); }}>
                <option value="">{t('creatorBenefitsAdmin.allAuthorTypes')}</option>
                <option value="contracted">{authorTypeLabel('contracted')}</option>
                <option value="special">{authorTypeLabel('special')}</option>
              </select>
            </label>
            <button type="button" className={styles.secondaryButton} onClick={() => void loadAuthors(authorPage)} disabled={isLoadingAuthors} title={t('creatorBenefitsAdmin.authorsRefresh')} aria-label={t('creatorBenefitsAdmin.authorsRefresh')}>
              <IoRefresh aria-hidden="true" />
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => { setIsAddAuthorOpen(true); setAddUserKeyword(''); setAddUsers(EMPTY_AUTHORS); setAddUserPage(1); setHasSearchedAddUsers(false); }}>
              <IoAdd aria-hidden="true" />
              {t('creatorBenefitsAdmin.addAuthor')}
            </button>
          </div>

          <div className={styles.authorTable} role="table" aria-label={t('creatorBenefitsAdmin.specialTitle')}>
            <div className={styles.authorHeader} role="row">
              <span>{t('creatorBenefitsAdmin.authorIdentity')}</span>
              <span>{t('creatorBenefitsAdmin.authorTypeDetail')}</span>
              <span>{t('creatorBenefitsAdmin.authorLevelDetail')}</span>
              <span>{t('creatorBenefitsAdmin.authorShareDetail')}</span>
              <span>{t('creatorBenefitsAdmin.note')}</span>
              <span>{t('creatorBenefitsAdmin.actions')}</span>
            </div>
            {isLoadingAuthors && authors.list.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.authorsLoading')}</div> : null}
            {!isLoadingAuthors && authors.list.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.noAuthors')}</div> : null}
            {authors.list.map((user) => (
              <div key={user.userId} className={styles.authorRow} role="row">
                <div data-label={t('creatorBenefitsAdmin.authorIdentity')} className={styles.userIdentity}>
                  <strong>{user.nickname || user.userCode}</strong>
                  <span>{user.userCode} · {user.phoneNumber || '-'}</span>
                </div>
                <div data-label={t('creatorBenefitsAdmin.authorTypeDetail')}>
                  <span className={styles.authorTypeBadge}>{authorTypeLabel(user.benefits.authorType)}</span>
                </div>
                <div data-label={t('creatorBenefitsAdmin.authorLevelDetail')} className={styles.authorMetrics}>
                  <strong>{user.benefits.label}</strong>
                  <span>Lv.{user.benefits.permanentLevel || 0} · {t('creatorBenefitsAdmin.authorEffectiveCount')} {user.benefits.effectiveCount.toLocaleString('zh-CN')}</span>
                </div>
                <div data-label={t('creatorBenefitsAdmin.authorShareDetail')} className={styles.authorShares}>
                  <span>{t('creatorBenefitsAdmin.editorShort')} {formatPercent(user.benefits.editorShareRatio)}</span>
                  <span>{t('creatorBenefitsAdmin.customShort')} {formatPercent(user.benefits.customShareRatio)}</span>
                  {user.benefits.authorType === 'special' ? (
                    <span>{user.benefits.freeTxtCreation ? t('creatorBenefitsAdmin.authorTxtFree') : t('creatorBenefitsAdmin.authorTxtPaid')}</span>
                  ) : null}
                </div>
                <div data-label={t('creatorBenefitsAdmin.note')} className={styles.authorNote}>
                  {user.benefits.authorNote || t('creatorBenefitsAdmin.notSet')}
                </div>
                <div data-label={t('creatorBenefitsAdmin.actions')}>
                  <button type="button" className={styles.secondaryButton} onClick={() => openAuthorEditor(user)}>
                    <IoSettingsOutline aria-hidden="true" />
                    {t('creatorBenefitsAdmin.configure')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.pagination}>
            <span>{t('creatorBenefitsAdmin.pageSummary', { page: authors.pagination.page, totalPages: authors.pagination.totalPages, total: authors.pagination.total })}</span>
            <div>
              <button type="button" onClick={() => setAuthorPage((page) => Math.max(1, page - 1))} disabled={authorPage <= 1 || isLoadingAuthors}>{t('creatorBenefitsAdmin.previous')}</button>
              <button type="button" onClick={() => setAuthorPage((page) => Math.min(authors.pagination.totalPages, page + 1))} disabled={authorPage >= authors.pagination.totalPages || isLoadingAuthors}>{t('creatorBenefitsAdmin.next')}</button>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.section}>
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

      {isAddAuthorOpen && !editingUser ? (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSearchingUsers) setIsAddAuthorOpen(false); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-author-title">
            <header>
              <div>
                <span>{t('creatorBenefitsAdmin.addAuthorSubtitle')}</span>
                <h3 id="add-author-title">{t('creatorBenefitsAdmin.addAuthorTitle')}</h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setIsAddAuthorOpen(false)} aria-label={t('creatorBenefitsAdmin.close')}>×</button>
            </header>
            <div className={styles.formBody}>
              <div className={styles.addUserSearchRow}>
                <label className={styles.searchField}>
                  <span>{t('creatorBenefitsAdmin.userKeyword')}</span>
                  <input value={addUserKeyword} onChange={(event) => { setAddUserKeyword(event.target.value); setHasSearchedAddUsers(false); setAddUsers(EMPTY_AUTHORS); setAddUserPage(1); }} onKeyDown={(event) => { if (event.key === 'Enter') void handleSearchUsers(); }} disabled={isSearchingUsers} />
                </label>
                <button type="button" className={styles.primaryButton} onClick={() => void handleSearchUsers()} disabled={isSearchingUsers}>
                  <IoSearch aria-hidden="true" />
                  {isSearchingUsers ? t('creatorBenefitsAdmin.searching') : t('creatorBenefitsAdmin.addAuthorSearch')}
                </button>
              </div>
              {!hasSearchedAddUsers ? <div className={styles.empty}>{t('creatorBenefitsAdmin.addAuthorSubtitle')}</div> : null}
              {hasSearchedAddUsers && addUsers.list.length === 0 ? <div className={styles.empty}>{t('creatorBenefitsAdmin.addAuthorSearchEmpty')}</div> : null}
              {hasSearchedAddUsers && addUsers.list.length > 0 ? (
                <div className={styles.addUserList}>
                  {addUsers.list.map((user) => {
                    const alreadyConfigured = isExistingSpecialAuthor(user);
                    return (
                      <div key={user.userId} className={styles.addUserRow}>
                        <div className={styles.userIdentity}>
                          <strong>{user.nickname || user.userCode}</strong>
                          <span>{user.userCode} · {user.phoneNumber || '-'}</span>
                        </div>
                        <span className={styles.authorTypeBadge}>{alreadyConfigured ? authorTypeLabel(user.benefits.authorType) : authorTypeLabel('regular')}</span>
                        <button type="button" className={styles.secondaryButton} onClick={() => openAuthorEditor(user, true)} disabled={alreadyConfigured || isAddingAuthor}>
                          {alreadyConfigured ? t('creatorBenefitsAdmin.addAuthorAlreadyConfigured') : t('creatorBenefitsAdmin.addAuthorSelect')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {hasSearchedAddUsers ? (
                <div className={styles.pagination}>
                  <span>{t('creatorBenefitsAdmin.pageSummary', { page: addUsers.pagination.page, totalPages: addUsers.pagination.totalPages, total: addUsers.pagination.total })}</span>
                  <div>
                    <button type="button" onClick={() => void handleSearchUsers(Math.max(1, addUserPage - 1))} disabled={addUserPage <= 1 || isSearchingUsers}>{t('creatorBenefitsAdmin.previous')}</button>
                    <button type="button" onClick={() => void handleSearchUsers(Math.min(addUsers.pagination.totalPages, addUserPage + 1))} disabled={addUserPage >= addUsers.pagination.totalPages || isSearchingUsers}>{t('creatorBenefitsAdmin.next')}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingAuthor) closeAuthorEditor(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="author-editor-title">
            <header>
              <div>
                <span>{editingUser.nickname || editingUser.userCode} · {editingUser.userCode} · {editingUser.phoneNumber || '-'}</span>
                <h3 id="author-editor-title">{t(isAddingAuthor ? 'creatorBenefitsAdmin.addAuthorTitle' : 'creatorBenefitsAdmin.authorEditorTitle')}</h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeAuthorEditor} disabled={isSavingAuthor} aria-label={t('creatorBenefitsAdmin.close')}>×</button>
            </header>
            <div className={styles.formBody}>
              <label className={styles.authorTypeField}>
                <span>{t('creatorBenefitsAdmin.authorType')}</span>
                <select
                  value={authorDraft.authorType}
                  onChange={(event) => setAuthorDraft((draft) => ({
                    ...draft,
                    authorType: event.target.value as CreatorAuthorType,
                  }))}
                  disabled={isSavingAuthor}
                >
                  {!isAddingAuthor ? <option value="regular">{authorTypeLabel('regular')}</option> : null}
                  <option value="contracted">{authorTypeLabel('contracted')}</option>
                  <option value="special">{authorTypeLabel('special')}</option>
                </select>
              </label>
              <div className={styles.authorSnapshot}>
                <div>
                  <span>{t('creatorBenefitsAdmin.currentLevel')}</span>
                  <strong>{editingUser.benefits.label}</strong>
                </div>
                <div>
                  <span>{t('creatorBenefitsAdmin.permanentLevel')}</span>
                  <strong>Lv.{editingUser.benefits.permanentLevel || 0}</strong>
                </div>
                <div>
                  <span>{t('creatorBenefitsAdmin.quarterEffectiveCount')}</span>
                  <strong>{editingUser.benefits.effectiveCount.toLocaleString('zh-CN')}</strong>
                </div>
              </div>
              <p className={styles.authorQuarter}>
                {editingUser.benefits.quarterKey} · {formatCreatorQuarterRange(editingUser.benefits.effectiveStart, editingUser.benefits.periodEnd)}
              </p>
              {authorDraft.authorType === 'special' ? (
                <>
                  <div className={styles.formGrid}>
                    <label>
                      <span>{t('creatorBenefitsAdmin.editorPercent')}</span>
                      <input type="number" min="0" max="100" step="0.1" value={authorDraft.editorPercent} onChange={(event) => setAuthorDraft((draft) => ({ ...draft, editorPercent: Number(event.target.value) }))} disabled={isSavingAuthor} />
                      <small>{t('creatorBenefitsAdmin.editorRecommended')}</small>
                    </label>
                    <label>
                      <span>{t('creatorBenefitsAdmin.customPercent')}</span>
                      <input type="number" min="0" max="100" step="0.1" value={authorDraft.customPercent} onChange={(event) => setAuthorDraft((draft) => ({ ...draft, customPercent: Number(event.target.value) }))} disabled={isSavingAuthor} />
                      <small>{t('creatorBenefitsAdmin.customRecommended')}</small>
                    </label>
                  </div>
                  <label className={styles.switchField}>
                    <input type="checkbox" checked={authorDraft.freeTxtCreation} onChange={(event) => setAuthorDraft((draft) => ({ ...draft, freeTxtCreation: event.target.checked }))} disabled={isSavingAuthor} />
                    <span>{t('creatorBenefitsAdmin.freeTxtCreation')}</span>
                  </label>
                </>
              ) : (
                <p className={styles.authorTypeHint}>
                  {t(authorDraft.authorType === 'contracted'
                    ? 'creatorBenefitsAdmin.contractedTypeHint'
                    : 'creatorBenefitsAdmin.regularTypeHint')}
                </p>
              )}
              <label className={styles.textareaField}>
                <span>{t('creatorBenefitsAdmin.note')}</span>
                <textarea maxLength={500} value={authorDraft.note} onChange={(event) => setAuthorDraft((draft) => ({ ...draft, note: event.target.value }))} disabled={isSavingAuthor} />
              </label>
            </div>
            <footer>
              <button type="button" className={styles.secondaryButton} onClick={closeAuthorEditor} disabled={isSavingAuthor}>{t('creatorBenefitsAdmin.cancel')}</button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSaveAuthor()} disabled={isSavingAuthor}>
                <IoCheckmarkCircle aria-hidden="true" />
                {isSavingAuthor ? t('creatorBenefitsAdmin.saving') : t('creatorBenefitsAdmin.save')}
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
