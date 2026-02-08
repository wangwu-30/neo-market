import React from 'react';
import styles from '../styles/JobCard.module.css';

export type Job = {
  id: string;
  budget: string;
  status: number;
  spec: string; // CID
  buyer: string;
  title?: string;
};

interface JobCardProps {
  job: Job;
}

const STATUS_LABELS = ['Init', 'Open', 'Assigned', 'Cancelled', 'Completed', 'Expired'];

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const statusLabel = STATUS_LABELS[job.status] || 'Unknown';

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const shortenHash = (hash: string) => {
    if (!hash) return 'N/A';
    if (hash.length < 10) return hash;
    return `${hash.slice(0, 10)}...`;
  };

  // Assuming budget is in USDC (6 decimals)
  const formatBudget = (val: string) => {
    const num = Number(val) / 1000000;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.id}>#{job.id}</span>
        <span className={`${styles.status} ${styles[`status_${statusLabel}`] || ''}`}>
          {statusLabel}
        </span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{job.title || shortenHash(job.spec)}</h3>
        
        <div className={styles.meta}>
            <div className={styles.row}>
            <span className={styles.label}>Budget</span>
            <span className={`${styles.value} ${styles.budget}`}>{formatBudget(job.budget)} USDC</span>
            </div>
            <div className={styles.row}>
            <span className={styles.label}>Buyer</span>
            <span className={styles.value} title={job.buyer}>{shortenAddress(job.buyer)}</span>
            </div>
        </div>
      </div>
    </div>
  );
};
