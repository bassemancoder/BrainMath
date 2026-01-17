/**
 * History Component - Shows completed games with replay option
 */

import React, { useState } from 'react';
import type { GameHistoryEntry } from '@application/ports/StoragePort';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import { getGridSizeLabel, getDifficultyLabel } from '@domain/services/DifficultySettings';
import { TimeFormat, Timing } from '@domain/constants';
import styles from './History.module.css';

interface HistoryProps {
  onClose: () => void;
  onReplay: (hash: string) => void;
}

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / TimeFormat.SECONDS_PER_MINUTE);
  const secs = seconds % TimeFormat.SECONDS_PER_MINUTE;
  return `${mins}:${String(secs).padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}`;
}

/**
 * Format ISO timestamp as localized date/time string
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const History: React.FC<HistoryProps> = ({ onClose, onReplay }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const history = localStorageAdapter.getHistory();

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), Timing.COPY_FEEDBACK_DURATION_MS);
    } catch {
      // Clipboard failed silently
    }
  };

  const handleReplay = (hash: string) => {
    onReplay(hash);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>
        
        <h2 className={styles.title}>Game History</h2>
        
        {history.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No completed games yet.</p>
            <p className={styles.emptyHint}>Start playing to build your history!</p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {history.map((entry: GameHistoryEntry) => (
              <div key={`${entry.hash}-${entry.completedAt}`} className={styles.historyItem}>
                <div className={styles.itemHeader}>
                  <button
                    className={styles.hashButton}
                    onClick={() => handleCopyHash(entry.hash)}
                    title="Copy puzzle code"
                  >
                    {entry.hash}
                    {copiedHash === entry.hash && <span className={styles.copied}>✓</span>}
                  </button>
                  <span className={styles.timestamp}>{formatTimestamp(entry.completedAt)}</span>
                </div>
                
                <div className={styles.itemDetails}>
                  <span className={styles.detail}>
                    {getGridSizeLabel(entry.gridSize)} • {getDifficultyLabel(entry.difficulty)}
                  </span>
                  <span className={styles.detail}>
                    ⏱ {formatTime(entry.timeSeconds)}
                  </span>
                  <span className={styles.detail}>
                    🏆 {entry.score}
                  </span>
                </div>
                
                <button
                  className={styles.replayButton}
                  onClick={() => handleReplay(entry.hash)}
                >
                  Play Again
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button className={styles.closeButtonBottom} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default History;
