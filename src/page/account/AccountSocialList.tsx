import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './AccountSocialList.module.css';

type SocialTab = 'following' | 'followers';

type SocialUserItem = {
    id: string;
    nickname: string;
    bio: string;
    avatarUrl: string;
    isFollowing: boolean;
};

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;

/** 功能注释：关注/粉丝列表暂无接口，先用假数据展示布局 */
const MOCK_FOLLOWING: SocialUserItem[] = [
    {
        id: 'f1',
        nickname: '星尘叙事者',
        bio: '写点温柔的互动故事，欢迎来玩。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
    {
        id: 'f2',
        nickname: '夜航编辑部',
        bio: 'AVG / 文字冒险爱好者，偶尔更新长线剧本。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
    {
        id: 'f3',
        nickname: 'Kuran_lab',
        bio: '这位玩家还没有留下个人简介。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
    {
        id: 'f4',
        nickname: '月下书简',
        bio: '古风向文游创作者，主打选择分支与人物关系。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: false,
    },
    {
        id: 'f5',
        nickname: '雾港电台',
        bio: '喜欢悬疑与都市奇幻，正在连载第二部。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
];

const MOCK_FOLLOWERS: SocialUserItem[] = [
    {
        id: 'r1',
        nickname: '路过的读者A',
        bio: '追更中，催更请温柔。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: false,
    },
    {
        id: 'r2',
        nickname: '甜度超标',
        bio: '只吃糖，不吃刀。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
    {
        id: 'r3',
        nickname: '分支强迫症',
        bio: '每个选项都要存档试一遍。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: false,
    },
    {
        id: 'r4',
        nickname: '灰调摄影师',
        bio: '这位玩家还没有留下个人简介。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: false,
    },
    {
        id: 'r5',
        nickname: '剧本收藏夹',
        bio: '收藏了很多作品，慢慢看。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: true,
    },
    {
        id: 'r6',
        nickname: '晨雾旅人',
        bio: '新用户，先关注几位作者。',
        avatarUrl: DEFAULT_AVATAR,
        isFollowing: false,
    },
];

const isSocialTab = (value: string | null): value is SocialTab =>
    value === 'following' || value === 'followers';

const AccountSocialList: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userCode = '' } = useParams<{ userCode: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    const tabParam = searchParams.get('tab');
    const activeTab: SocialTab = isSocialTab(tabParam) ? tabParam : 'following';

    const [followingList, setFollowingList] = useState(MOCK_FOLLOWING);
    const [followersList, setFollowersList] = useState(MOCK_FOLLOWERS);

    useEffect(() => {
        if (!userCode.trim()) {
            navigate('/profile', { replace: true });
        }
    }, [userCode, navigate]);

    useEffect(() => {
        if (isSocialTab(tabParam)) return;
        setSearchParams({ tab: 'following' }, { replace: true });
    }, [tabParam, setSearchParams]);

    const list = activeTab === 'following' ? followingList : followersList;

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/profile');
    };

    const handleTabChange = (tab: SocialTab) => {
        setSearchParams({ tab }, { replace: true });
    };

    const handleToggleFollow = (id: string) => {
        const toggle = (items: SocialUserItem[]) =>
            items.map((item) => (
                item.id === id ? { ...item, isFollowing: !item.isFollowing } : item
            ));

        if (activeTab === 'following') {
            setFollowingList(toggle);
            return;
        }
        setFollowersList(toggle);
    };

    if (!userCode.trim()) {
        return null;
    }

    return (
        <div className={styles.pageRoot}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={handleBack}
                    aria-label={t('common.close')}
                >
                    <span className={styles.backIcon} aria-hidden="true" />
                </button>
                <h1 className={styles.title}>{t('create.socialFriendsTitle')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            <div className={styles.tabs} role="tablist" aria-label={t('create.socialFriendsTitle')}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'following'}
                    className={`${styles.tab} ${activeTab === 'following' ? styles.tabActive : ''}`}
                    onClick={() => handleTabChange('following')}
                >
                    {t('create.followingLabel')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'followers'}
                    className={`${styles.tab} ${activeTab === 'followers' ? styles.tabActive : ''}`}
                    onClick={() => handleTabChange('followers')}
                >
                    {t('create.followersLabel')}
                </button>
            </div>

            <div className={styles.countRow}>
                {activeTab === 'following'
                    ? t('create.socialFollowingCount', { count: followingList.length })
                    : t('create.socialFollowersCount', { count: followersList.length })}
            </div>

            <ul className={styles.list}>
                {list.map((item) => (
                    <li key={item.id} className={styles.listItem}>
                        <img className={styles.avatar} src={item.avatarUrl} alt={item.nickname} />
                        <div className={styles.meta}>
                            <div className={styles.nickname}>{item.nickname}</div>
                            <div className={styles.bio}>{item.bio}</div>
                        </div>
                        <button
                            type="button"
                            className={`${styles.followBtn} ${item.isFollowing ? styles.followBtnActive : styles.followBtnIdle}`}
                            onClick={() => handleToggleFollow(item.id)}
                        >
                            {item.isFollowing ? t('create.socialFollowingBtn') : t('create.socialFollowBtn')}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AccountSocialList;
