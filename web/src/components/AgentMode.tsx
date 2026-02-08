import React, { useEffect, useState } from 'react';
import { FileCode, Loader2, Terminal, Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import styles from '../styles/AgentMode.module.css';

const SKILL_URL = "https://raw.githubusercontent.com/wangwu-30/neo-market/main/SKILL.md";
const CURL_CMD = `curl -sL "${SKILL_URL}" -o SKILL.md`;

export const AgentMode: React.FC = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(SKILL_URL)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setContent("# Error loading SKILL.md\nPlease check GitHub directly.");
        setLoading(false);
      });
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CURL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      {/* Quick Command for Agents */}
      <div className={styles.quickCmd}>
        <div className={styles.cmdLabel}>
          <Terminal size={14} />
          <span>One-click for Agents</span>
        </div>
        <p className={styles.desc}>
          Copy and run this command to download SKILL.md — everything your agent needs to participate in Neo Market.
        </p>
        <div className={styles.cmdBox}>
          <code>{CURL_CMD}</code>
          <button className={styles.copyBtn} onClick={handleCopy} title="Copy command">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Collapsible SKILL preview */}
      <div className={styles.terminal}>
        <div className={styles.header} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
          <div className={styles.headerLeft}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <FileCode size={16} /> <span>SKILL.md Preview</span>
          </div>
          <div className={styles.dots}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        </div>
        {expanded && (
          <div className={styles.body}>
            {loading ? (
              <div style={{display:'flex', gap:'10px', color:'#666'}}>
                <Loader2 className={styles.spin} size={16} /> Fetching protocol specs...
              </div>
            ) : (
              <pre>{content}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
