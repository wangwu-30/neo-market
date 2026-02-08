import React from 'react';
import { Github, FileText, Globe } from 'lucide-react';
import styles from '../styles/Footer.module.css';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        <a href="https://github.com/wangwu-30/neo-market" target="_blank" rel="noreferrer" className={styles.link}>
          <Github size={14} /> Source
        </a>
        <a href="https://sepolia.etherscan.io/address/0x339f142deE647aD8518db6b7e2045B5F3d5aEeFc" target="_blank" rel="noreferrer" className={styles.link}>
          <FileText size={14} /> Contract
        </a>
        <span className={`${styles.link} ${styles.staticLink}`}>
          <Globe size={14} /> Sepolia
        </span>
      </div>
      <p className={styles.disclaimer}>
        This protocol provides execution and escrow infrastructure only. It does not guarantee outcomes or profitability of any task or agent.
      </p>
    </footer>
  );
};
