/**
 * HashDisplay Component - Shows current hash with copy functionality
 */

import React, { useState } from 'react';
import styles from './HashDisplay.module.css';

interface HashDisplayProps {
  hash: string;
  onCopy: () => Promise<boolean>;
  onShare?: () => void;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({ hash, onCopy, onShare }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hashRow}>
        <div className={styles.hashBox}>
          <span className={styles.label}>Puzzle:</span>
          <span className={styles.hash}>{hash}</span>
        </div>
        <button
          className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
          type="button"
          title={copied ? 'Copied!' : 'Copy puzzle code'}
        >
          {copied ? '✓' : '📋'}
        </button>
      </div>
      {onShare && (
        <button
          className={styles.button}
          onClick={onShare}
          type="button"
        >
          🔗 Share
        </button>
      )}
    </div>
  );
};

export default HashDisplay;
