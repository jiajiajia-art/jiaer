import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';

const Profile: React.FC = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/home');
    };

    return (
        <div className={styles.pageRoot}>
            <div className={styles.mainContent}>
                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    {/* <img src={`${import.meta.env.BASE_URL}data/asset/设置.png`} alt="" className={styles.settingIcon} /> */}

                    <img 
                        className={styles.avatar}
                        src={`${import.meta.env.BASE_URL}data/avatars/hunter.png`} 
                        alt="头像" 
                    />
                    <div className={styles.profileInfo}>
                        <div className={styles.profileName}>
                            <span>用户名: {user?.user.nickname || '未设置'}</span>
                        </div>
                    </div>
                    <button 
                        className={styles.logoutBtn}
                        onClick={handleLogout}
                    >
                        退出登录
                    </button>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default Profile;


