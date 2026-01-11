/**
 * HashDisplay Component - Shows current hash with copy functionality
 */

import React, { useState, useRef } from 'react';
import { Timing } from '@domain/constants';
import styles from './HashDisplay.module.css';

interface HashDisplayProps {
  hash: string;
  onCopy?: () => Promise<boolean>;
  onShare?: () => void;
  onDebugDump?: () => void;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({ hash, onCopy, onShare, onDebugDump }) => {
  const [copied, setCopied] = useState(false);
  const clickTimesRef = useRef<number[]>([]);

  const handleCopy = async () => {
    // Track rapid clicks for debug dump
    if (onDebugDump) {
      const now = Date.now();
      clickTimesRef.current.push(now);
      clickTimesRef.current = clickTimesRef.current.filter(t => now - t < Timing.CHEAT_CODE_WINDOW_MS);
      
      if (clickTimesRef.current.length >= Timing.CHEAT_CODE_CLICK_COUNT) {
        clickTimesRef.current = [];
        onDebugDump();
        return; // Don't copy when triggering debug
      }
    }

    if (onCopy) {
      const success = await onCopy();
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), Timing.COPY_FEEDBACK_DURATION_MS);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hashRow}>
        <button
          className={`${styles.hashBox} ${onCopy ? styles.clickable : ''} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
          type="button"
          title={copied ? 'Copied!' : 'Copy puzzle code'}
        >
          <span className={styles.label}>Puzzle:</span>
          <span className={styles.hash}>{hash}</span>
          {copied && <span className={styles.copiedIndicator}>✓</span>}
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
