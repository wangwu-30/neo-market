import React from 'react';
import styles from '../styles/Skeleton.module.css';

export const SkeletonCard: React.FC = () => {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonId}></div>
        <div className={styles.skeletonBadge}></div>
      </div>
      <div className={styles.skeletonTitle}></div>
      <div className={styles.skeletonMeta}>
        <div className={styles.skeletonRow}></div>
        <div className={styles.skeletonRow}></div>
      </div>
    </div>
  );
};
