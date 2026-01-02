/**
 * NumberPad Component - On-screen number input
 * Shows only the available numbers that need to be placed
 */

import React from 'react';
import styles from './NumberPad.module.css';

interface NumberPadProps {
  onNumberClick: (value: number | null) => void;
  disabled: boolean;
  /** Available numbers that can be placed (includes duplicates) */
  availableNumbers: number[];
}

export const NumberPad: React.FC<NumberPadProps> = ({ onNumberClick, disabled, availableNumbers }) => {
  // Group available numbers by value and count occurrences
  const numberCounts = new Map<number, number>();
  for (const num of availableNumbers) {
    numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
  }
  
  // Get unique numbers sorted
  const uniqueNumbers = Array.from(numberCounts.keys()).sort((a, b) => a - b);

  return (
    <div className={styles.numberPad}>
      <div className={styles.grid}>
        {uniqueNumbers.map((num, index) => {
          const count = numberCounts.get(num) || 0;
          return (
            <button
              key={`${num}-${index}`}
              className={styles.numberButton}
              onClick={() => onNumberClick(num)}
              disabled={disabled}
              type="button"
              title={count > 1 ? `${count} remaining` : undefined}
            >
              {num}
              {count > 1 && <span className={styles.badge}>{count}</span>}
            </button>
          );
        })}
        <button
          className={`${styles.numberButton} ${styles.clearButton}`}
          onClick={() => onNumberClick(null)}
          disabled={disabled}
          type="button"
          aria-label="Clear"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NumberPad;
