import React from 'react';
import styles from './PageSectionHeader.module.css';

interface PageSectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  headingLevel?: 'h1' | 'h2';
}

const PageSectionHeader: React.FC<PageSectionHeaderProps> = ({
  title,
  description,
  className,
  headingLevel = 'h2',
}) => {
  const Heading = headingLevel;

  return (
    <section className={`${styles.header} ${className ?? ''}`.trim()}>
      <Heading className={styles.title}>{title}</Heading>
      {description ? <p className={styles.desc}>{description}</p> : null}
    </section>
  );
};

export default PageSectionHeader;
