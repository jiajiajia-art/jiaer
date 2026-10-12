import React, { useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from './CommonModal/ConfirmModal';
import adminShareRatioApi, {
    type AdminShareRatioGame,
    type AdminShareRatioUser,
} from '../api/admin/shareRatioApi';
import { getApiErrorMessage } from '../utils/error';
import type { Currency } from '../api/common/currency';
import styles from './PointsAdminManager.module.css';

type ShareRatioAdminManagerProps = {
    pendingCount?: number;
    onRefreshCounts?: () => Promise<void>;
};

const formatTime = (value: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const ShareRatioAdminManager: React.FC<ShareRatioAdminManagerProps> = () => {
    const [lookupMode, setLookupMode] = useState<'userCode' | 'phoneNumber'>('userCode');
    const [lookupKeyword, setLookupKeyword] = useState('');
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [userInfo, setUserInfo] = useState<AdminShareRatioUser | null>(null);
    const [games, setGames] = useState<AdminShareRatioGame[]>([]);
    const [editingGame, setEditingGame] = useState<AdminShareRatioGame | null>(null);
    const [editRatio, setEditRatio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const handleLookup = async () => {
        const keyword = lookupKeyword.trim();
        if (!keyword) {
            toast.error(lookupMode === 'userCode' ? '请输入 Kuran 号' : '请输入手机号');
            return;
        }

        try {
            setIsLookingUp(true);
            const response = await adminShareRatioApi.getShareRatioByUser(keyword);
            if (response.data.success) {
                setUserInfo(response.data.data!.user);
                setGames(response.data.data!.games);
                setEditingGame(null);
                setIsConfirmOpen(false);
                toast.success('查询成功');
            } else {
                toast.error(response.data.message || '查询失败');
            }
        } catch (error) {
            const msg = getApiErrorMessage(error, '查询失败');
            if (msg.includes('未找到')) {
                toast.error('未找到该用户');
            } else {
                toast.error(msg);
            }
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleStartEdit = (game: AdminShareRatioGame) => {
        if (!game.shareRatioEditable) return;
        setEditingGame(game);
        setEditRatio((game.shareRatio * 100).toFixed(1));
    };

    const handleCancelEdit = () => {
        setEditingGame(null);
        setEditRatio('');
        setIsConfirmOpen(false);
    };

    const handleRequestSaveRatio = () => {
        if (!editingGame) return;

        const ratio = parseFloat(editRatio);
        if (isNaN(ratio) || ratio < 0 || ratio > 100) {
            toast.error('分成比例必须在 0~100 之间');
            return;
        }
        setIsConfirmOpen(true);
    };

    const handleSaveRatio = async () => {
        if (!editingGame || !editingGame.shareRatioEditable) return;

        const ratio = parseFloat(editRatio);
        if (isNaN(ratio) || ratio < 0 || ratio > 100) return;
        setIsConfirmOpen(false);

        try {
            setIsSaving(true);
            const response = await adminShareRatioApi.setShareRatio({
                fileId: editingGame.fileId,
                shareRatio: ratio / 100,
            });

            if (response.data.success) {
                const newRatio = ratio / 100;
                setGames((prev) =>
                    prev.map((g) =>
                        g.fileId === editingGame.fileId
                            ? {
                                  ...g,
                                  shareRatio: newRatio,
                                  shareRatioDisplay: `${ratio.toFixed(1)}%`,
                                  effectiveShareRatio: newRatio,
                                  effectiveShareRatioDisplay: `${ratio.toFixed(1)}%`,
                                  updatedAt: response.data.data!.updatedAt,
                              }
                            : g
                    )
                );
                setEditingGame(null);
                setEditRatio('');
                toast.success('分成比例设置成功');
            } else {
                toast.error(response.data.message || '设置失败');
            }
        } catch (error) {
            toast.error(getApiErrorMessage(error, '设置失败'));
        } finally {
            setIsSaving(false);
        }
    };

    const getShareTypeLabel = (shareType: Currency) => {
        return shareType === 'points' ? '织梦豆' : 'KK币';
    };

    const getShareRatioSourceLabel = (game: AdminShareRatioGame) => {
        if (game.shareRatioSource === 'game') return '作品单独比例';
        return `${userInfo?.creatorBenefitLabel || '创作者权益'}比例`;
    };

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div>
                    <div className={styles.sectionBadge}>分成比例管理</div>
                    <h2 className={styles.heroTitle}>管理创作者作品分成比例</h2>
                    <p className={styles.heroDesc}>TXT 与自定义作品展示当前创作者权益比例；其他模式可单独设置作品分成比例。</p>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>查询创作者</h3>
                        <div className={styles.cardDesc}>输入 Kuran 号或手机号查询该创作者的所有作品。</div>
                    </div>
                </div>
                <div className={styles.formArea}>
                    <label className={styles.fieldLabel}>
                        定位方式
                        <select
                            className={styles.select}
                            value={lookupMode}
                            onChange={(e) => setLookupMode(e.target.value as 'userCode' | 'phoneNumber')}
                        >
                            <option value="userCode">Kuran 号</option>
                            <option value="phoneNumber">手机号</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        用户定位输入
                        <input
                            className={styles.textInput}
                            value={lookupKeyword}
                            onChange={(e) => setLookupKeyword(e.target.value)}
                            placeholder={lookupMode === 'userCode' ? '输入 Kuran 号' : '输入手机号'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    void handleLookup();
                                }
                            }}
                        />
                    </label>
                    <div className={styles.actionRow}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void handleLookup()}
                            disabled={isLookingUp}
                        >
                            {isLookingUp ? '查询中...' : '查询'}
                        </button>
                    </div>
                </div>
            </section>

            {userInfo && (
                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>用户信息</h3>
                        </div>
                    </div>
                    <div className={styles.userCard}>
                        <div className={styles.userName}>{userInfo.nickname || '未命名用户'}</div>
                        <div className={styles.itemMeta}>Kuran 号：{userInfo.userCode || '-'}</div>
                        <div className={styles.itemMeta}>手机号：{userInfo.phoneNumber || '-'}</div>
                        <div className={styles.itemMeta}>用户 ID：{userInfo.userId}</div>
                    </div>
                </section>
            )}

            {games.length > 0 && (
                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>作品列表</h3>
                            <div className={styles.cardDesc}>共 {games.length} 个作品</div>
                        </div>
                    </div>
                    <div className={styles.reviewTableWrapper}>
                        <table className={styles.reviewTable}>
                            <colgroup>
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>作品名称</th>
                                    <th>类型</th>
                                    <th>结算货币</th>
                                    <th>当前比例</th>
                                    <th>发布状态</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {games.map((game) => {
                                    const isEditing = editingGame?.fileId === game.fileId;
                                    return (
                                        <tr key={game.fileId} className={styles.reviewTableRow}>
                                            <td className={styles.rewardTitleCell}>{game.title || '-'}</td>
                                            <td className={styles.shareRatioTypeCell}>{game.gameMode || '-'}</td>
                                            <td className={styles.shareRatioValueCell}>
                                                <span
                                                    className={`${styles.statusTag} ${
                                                        game.shareType === 'diamonds'
                                                            ? styles.statusPending
                                                            : styles.statusIssued
                                                    }`}
                                                >
                                                    {getShareTypeLabel(game.shareType)}
                                                </span>
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <div className={styles.actionRow} style={{ justifyContent: 'center' }}>
                                                        <input
                                                            type="number"
                                                            className={styles.textInput}
                                                            style={{ width: '80px', minHeight: '36px', padding: '0 8px', fontSize: '14px' }}
                                                            value={editRatio}
                                                            onChange={(e) => setEditRatio(e.target.value)}
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                        />
                                                        <span style={{ fontSize: '14px', color: '#705b4b' }}>%</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <strong className={styles.shareRatioValue}>{game.effectiveShareRatioDisplay}</strong>
                                                        <small className={styles.shareRatioSource}>{getShareRatioSourceLabel(game)}</small>
                                                    </>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className={`${styles.statusTag} ${
                                                        game.isPublic ? styles.statusIssued : styles.statusPending
                                                    }`}
                                                >
                                                    {game.isPublic ? '已发布' : '未发布'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#705b4b' }}>
                                                {formatTime(game.createdAt)}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <div className={styles.actionRow} style={{ justifyContent: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className={styles.primaryButton}
                                                            style={{ padding: '8px 12px', fontSize: '13px' }}
                                                            onClick={handleRequestSaveRatio}
                                                            disabled={isSaving}
                                                        >
                                                            {isSaving ? '保存中...' : '保存'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '8px 12px', fontSize: '13px' }}
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                ) : game.shareRatioEditable ? (
                                                    <button
                                                        type="button"
                                                        className={`${styles.secondaryButton} ${styles.reviewDetailButton}`}
                                                        style={{ minWidth: '72px', padding: '8px 12px', fontSize: '13px' }}
                                                        onClick={() => handleStartEdit(game)}
                                                    >
                                                        修改比例
                                                    </button>
                                                ) : (
                                                    <span className={styles.shareRatioLocked}>随创作者权益生效</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {userInfo && games.length === 0 && (
                <section className={styles.card}>
                    <div className={styles.emptyState}>该用户暂无作品</div>
                </section>
            )}

            <ConfirmModal
                isOpen={isConfirmOpen}
                onCancel={() => setIsConfirmOpen(false)}
                onConfirm={() => void handleSaveRatio()}
                title="确认修改分成比例"
                message={editingGame
                    ? `确认将《${editingGame.title || '-'}》的作品分成比例从 ${editingGame.effectiveShareRatioDisplay} 调整为 ${Number(editRatio).toFixed(1)}%？当前未结算及后续收益将按新比例计算。`
                    : ''}
                confirmButtonText="确认修改"
                cancelButtonText="取消"
            />
        </div>
    );
};

export default ShareRatioAdminManager;
