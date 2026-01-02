/**
 * GameOver Component - Win screen with share options
 */

import React, { useState } from 'react';
import styles from './GameOver.module.css';

interface GameOverProps {
  time: number;
  bestTime: number | null;
  hash: string;
  onNewGame: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  shareableUrl: string | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const GameOver: React.FC<GameOverProps> = ({
  time,
  bestTime,
  hash,
  onNewGame,
  onPlayAgain,
  onClose,
  shareableUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const isNewRecord = bestTime === null || time <= bestTime;

  const handleCopyLink = async () => {
    if (shareableUrl) {
      try {
        await navigator.clipboard.writeText(shareableUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = shareableUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleShare = async () => {
    if (navigator.share && shareableUrl) {
      try {
        await navigator.share({
          title: 'Brain Math Challenge',
          text: `I solved puzzle ${hash} in ${formatTime(time)}! Can you beat my time?`,
          url: shareableUrl,
        });
      } catch {
        // User cancelled or share failed, copy instead
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button 
          className={styles.closeButton} 
          onClick={onClose} 
          type="button"
          aria-label="Close"
        >
          ✕
        </button>
        <div className={styles.celebration}>🎉</div>
        <h2 className={styles.title}>Puzzle Complete!</h2>
        
        <div className={styles.stats}>
          <div className={styles.time}>
            <span className={styles.timeLabel}>Your Time</span>
            <span className={styles.timeValue}>{formatTime(time)}</span>
          </div>
          
          {isNewRecord && (
            <div className={styles.record}>
              🏆 New Record!
            </div>
          )}
          
          {bestTime !== null && !isNewRecord && (
            <div className={styles.bestTime}>
              Best: {formatTime(bestTime)}
            </div>
          )}
        </div>

        <div className={styles.hashSection}>
          <span className={styles.hashLabel}>Puzzle Code</span>
          <span className={styles.hash}>{hash}</span>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={onNewGame}
            type="button"
          >
            🎲 New Puzzle
          </button>
          <button
            className={styles.button}
            onClick={onPlayAgain}
            type="button"
          >
            🔄 Play Again
          </button>
        </div>

        <div className={styles.shareSection}>
          <span className={styles.shareLabel}>Challenge a friend:</span>
          <div className={styles.shareButtons}>
            <button
              className={`${styles.shareButton} ${copied ? styles.copied : ''}`}
              onClick={handleCopyLink}
              type="button"
            >
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            {'share' in navigator && (
              <button
                className={styles.shareButton}
                onClick={handleShare}
                type="button"
              >
                📤 Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameOver;
