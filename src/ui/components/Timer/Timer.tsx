/**
 * Timer Component - Displays elapsed time
 */

import React from 'react';
import styles from './Timer.module.css';

interface TimerProps {
  time: number; // seconds
  isRunning: boolean;
  bestTime: number | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const Timer: React.FC<TimerProps> = ({ time, isRunning, bestTime }) => {
  return (
    <div className={styles.timerContainer}>
      <div className={`${styles.timer} ${isRunning ? styles.running : ''}`}>
        <span className={styles.icon}>⏱️</span>
        <span className={styles.time}>{formatTime(time)}</span>
      </div>
      {bestTime !== null && (
        <div className={styles.bestTime}>
          <span className={styles.bestIcon}>🏆</span>
          <span className={styles.bestLabel}>Best: {formatTime(bestTime)}</span>
        </div>
      )}
    </div>
  );
};

export default Timer;
