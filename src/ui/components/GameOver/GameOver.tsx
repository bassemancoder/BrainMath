/**
 * GameOver Component - Win screen with share options and game stats
 */

import React, { useState, useMemo } from 'react';
import { TimeFormat, Timing } from '@domain/constants';
import { getScoreBreakdown, getGridSizeLabel, getDifficultyLabel } from '@domain/services';
import type { GridSize, Difficulty } from '@domain/types';
import styles from './GameOver.module.css';
import logo from '../../../assets/logo.png';

interface GameOverProps {
  time: number;
  score: number;
  hash: string;
  onNewGame: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  shareableUrl: string | null;
  // Game stats
  wrongAttemptCount: number;
  hintCount: number;
  difficulty: Difficulty;
  gridSize: GridSize;
  initialScore: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / TimeFormat.SECONDS_PER_MINUTE);
  const secs = seconds % TimeFormat.SECONDS_PER_MINUTE;
  return `${mins.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}:${secs.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}`;
}

export const GameOver: React.FC<GameOverProps> = ({
  time,
  score,
  hash,
  onNewGame,
  onPlayAgain,
  onClose,
  shareableUrl,
  wrongAttemptCount,
  hintCount,
  difficulty,
  gridSize,
  initialScore,
}) => {
  const [copied, setCopied] = useState(false);

  // Get score breakdown for detailed display
  const scoreBreakdown = getScoreBreakdown(
    initialScore,
    time,
    wrongAttemptCount,
    hintCount
  );

  const handleCopyLink = async () => {
    if (shareableUrl) {
      try {
        await navigator.clipboard.writeText(shareableUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), Timing.COPY_FEEDBACK_DURATION_MS);
      } catch {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = shareableUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), Timing.COPY_FEEDBACK_DURATION_MS);
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close when clicking the overlay (dark background), not the modal itself
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Pre-generated confetti data using deterministic pseudo-random based on index
  // This avoids calling Math.random during render
  // Reduce confetti count on mobile for better performance
  const confettiData = useMemo(() => {
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6fff', '#a855f7'];
    // Use a simple seeded approach based on index for deterministic "random" values
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };
    // Reduce count on mobile (50 -> 20) for performance
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;
    const confettiCount = isMobile ? 20 : 50;
    return [...Array(confettiCount)].map((_, i) => ({
      delay: `${seededRandom(i * 3 + 1) * 3}s`,
      x: `${seededRandom(i * 3 + 2) * 100}vw`,
      rotation: `${seededRandom(i * 3 + 3) * 360}deg`,
      color: colors[i % 6],
    }));
  }, []);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      {/* Confetti celebration */}
      <div className={styles.confettiContainer}>
        {confettiData.map((confetti, i) => (
          <div key={i} className={styles.confetti} style={{
            '--delay': confetti.delay,
            '--x': confetti.x,
            '--rotation': confetti.rotation,
            '--color': confetti.color,
          } as React.CSSProperties} />
        ))}
      </div>
      <div className={styles.modal}>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          ✕
        </button>
        {/* Logo assembly animation - 12 pieces fly in */}
        <div className={styles.logoAssembly}>
          {[...Array(12)].map((_, i) => (
            <img 
              key={i} 
              src={logo} 
              alt="" 
              className={styles.logoPiece} 
              style={{
                '--piece-index': i,
                '--col': i % 4,
                '--row': Math.floor(i / 4),
              } as React.CSSProperties}
            />
          ))}
        </div>
        <h2 className={styles.title}>Puzzle Complete!</h2>
        
        {/* Game Info Section */}
        <div className={styles.gameInfo}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Grid Size</span>
            <span className={styles.infoValue}>{getGridSizeLabel(gridSize)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Difficulty</span>
            <span className={styles.infoValue}>{getDifficultyLabel(difficulty)}</span>
          </div>
        </div>

        {/* Performance Stats Section */}
        <div className={styles.statsSection}>
          <h3 className={styles.sectionTitle}>Performance</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Time</span>
              <span className={styles.statValue}>{formatTime(time)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Errors</span>
              <span className={styles.statValue}>{wrongAttemptCount}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Hints</span>
              <span className={styles.statValue}>{hintCount}</span>
            </div>
          </div>
        </div>

        {/* Score Breakdown Section */}
        <div className={styles.scoreSection}>
          <h3 className={styles.sectionTitle}>Score Breakdown</h3>
          <div className={styles.breakdownTable}>
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Starting Score</span>
              <span className={styles.breakdownValue}>{scoreBreakdown.initialScore}</span>
            </div>
            {scoreBreakdown.timePenalty > 0 && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Time Penalty</span>
                <span className={styles.breakdownValue}>−{scoreBreakdown.timePenalty}</span>
              </div>
            )}
            {scoreBreakdown.wrongPenalty > 0 && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Error Penalty ({wrongAttemptCount}×)</span>
                <span className={styles.breakdownValue}>−{scoreBreakdown.wrongPenalty}</span>
              </div>
            )}
            {scoreBreakdown.hintPenalty > 0 && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Hint Penalty ({hintCount}×)</span>
                <span className={styles.breakdownValue}>−{scoreBreakdown.hintPenalty}</span>
              </div>
            )}
            <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
              <span className={styles.breakdownLabel}>Final Score</span>
              <span className={styles.breakdownValue}>{score}</span>
            </div>
          </div>
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
