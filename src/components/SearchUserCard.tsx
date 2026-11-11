/**
 * 搜索结果作者卡：沿用社交列表视觉（头像、名字、作品/粉丝、关注）。
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../lib/gameCardAuthor';
import type { SearchUserItem } from '../api/account/userSearchApi';
import styles from './SearchUserCard.module.css';

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

export type SearchUserCardProps = {
  user: SearchUserItem;
  selfCode?: string;
  busy?: boolean;
  onToggleFollow?: (user: SearchUserItem) => void;
};

const followLabel = (
  user: SearchUserItem,
  t: (key: string) => string,
): string => {
  if (user.isFollowing && user.isFollowedBy) return t('create.socialMutualBtn');
  if (user.isFollowing) return t('create.socialFollowingBtn');
  if (user.isFollowedBy) return t('create.socialFollowBackBtn');
  return t('create.socialFollowBtn');
};

const SearchUserCard: React.FC<SearchUserCardProps> = ({
  user,
  selfCode = '',
  busy = false,
  onToggleFollow,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const avatar = getImageUrl(user.avatarUrl) || DEFAULT_AVATAR;
  const isSelf = Boolean(selfCode && user.userCode === selfCode);
  const works = typeof user.worksCount === 'number' ? user.worksCount : null;
  const fans = typeof user.followersCount === 'number' ? user.followersCount : null;

  const openUser = () => {
    if (!user.userCode) return;
    navigate(`/account/${encodeURIComponent(user.userCode)}`);
  };

  return (
    <div className={styles.card}>
      <button type="button" className={styles.avatarHit} onClick={openUser} aria-label={user.nickname}>
        <img className={styles.avatar} src={avatar} alt="" />
      </button>
      <div className={styles.body}>
        <button type="button" className={styles.metaHit} onClick={openUser}>
          <div className={styles.nickname}>{user.nickname || user.userCode}</div>
          <div className={styles.stats}>
            <span>
              {t('search.worksCount', { count: works ?? '—' })}
            </span>
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <span>
              {t('search.fansCount', { count: fans ?? '—' })}
            </span>
          </div>
        </button>
        {!isSelf && onToggleFollow ? (
          <button
            type="button"
            className={`${styles.followBtn} ${user.isFollowing ? styles.followBtnActive : styles.followBtnIdle}`}
            disabled={busy}
            onClick={() => onToggleFollow(user)}
          >
            {followLabel(user, t)}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default SearchUserCard;
