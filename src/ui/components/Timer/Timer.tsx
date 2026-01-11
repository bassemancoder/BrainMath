/**
 * Timer Component - Displays elapsed time and selected cell coordinates
 */

import React from 'react';
import { TimeFormat } from '@domain/constants';
import styles from './Timer.module.css';

interface TimerProps {
  time: number; // seconds
  isRunning: boolean;
  selectedCellCoords?: string | null; // e.g., "H5, V3"
  score: number; // current calculated score
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / TimeFormat.SECONDS_PER_MINUTE);
  const secs = seconds % TimeFormat.SECONDS_PER_MINUTE;
  return `${mins.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}:${secs.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}`;
}

export const Timer: React.FC<TimerProps> = ({ time, isRunning, selectedCellCoords, score }) => {
  return (
    <div className={styles.timerContainer}>
      <div className={`${styles.timer} ${isRunning ? styles.running : ''}`}>
        <span className={styles.icon}>⏱️</span>
        <span className={styles.time}>{formatTime(time)}</span>
      </div>
      <div className={styles.score}>
        <span className={styles.scoreIcon}>⭐</span>
        <span className={styles.scoreValue}>{score.toLocaleString()}</span>
      </div>
      {selectedCellCoords && (
        <div className={styles.cellCoords}>
          <span className={styles.coordsIcon}>📍</span>
          <span className={styles.coordsLabel}>{selectedCellCoords}</span>
        </div>
      )}
    </div>
  );
};

export default Timer;
