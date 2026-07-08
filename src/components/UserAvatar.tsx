import React from 'react';
import VerifiedBadge from './VerifiedBadge';
import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  verified?: boolean;
  badgeSize?: 'sm' | 'md' | 'lg';
  /** 导航栏等小头像容器内铺满；个人中心大头像勿开 */
  fill?: boolean;
  className?: string;
  children: React.ReactNode;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  verified = false,
  badgeSize = 'md',
  fill = false,
  className = '',
  children,
}) => {
  return (
    <div className={`${styles.root} ${fill ? styles.fill : ''} ${className}`.trim()}>
      <div className={styles.imageFrame}>{children}</div>
      {verified ? <VerifiedBadge variant="overlay" size={badgeSize} /> : null}
    </div>
  );
};

export default UserAvatar;
