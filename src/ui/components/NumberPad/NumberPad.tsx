/**
 * NumberPad Component - On-screen number input
 * Shows available numbers and used (placed) numbers
 */

import React from 'react';
import styles from './NumberPad.module.css';

interface NumberPadProps {
  onNumberClick: (value: number | null) => void;
  onUndo: () => void;
  onSolve?: () => void;
  onSwap?: () => void;
  onHint?: () => void;
  disabled: boolean;
  canUndo: boolean;
  /** Whether swap mode is currently active */
  swapMode?: boolean;
  /** Whether a first cell is selected in swap mode */
  swapFirstCellSelected?: boolean;
  /** Whether there are empty cells to give hints for */
  hasEmptyCells?: boolean;
  /** Available numbers that can be placed (includes duplicates) */
  availableNumbers: number[];
  /** Numbers that have been placed on the board */
  usedNumbers: number[];
  /** Currently highlighted number (for showing which cells have this value) */
  highlightedNumber?: number | null;
  /** Callback when a used number is clicked to highlight matching cells */
  onUsedNumberClick?: (value: number) => void;
}

export const NumberPad: React.FC<NumberPadProps> = ({ onNumberClick, onUndo, onSolve, onSwap, onHint, disabled, canUndo, swapMode, swapFirstCellSelected, hasEmptyCells, availableNumbers, usedNumbers, highlightedNumber, onUsedNumberClick }) => {
  // Group available numbers by value and count occurrences
  const numberCounts = new Map<number, number>();
  for (const num of availableNumbers) {
    numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
  }
  
  // Get unique numbers sorted
  const uniqueNumbers = Array.from(numberCounts.keys()).sort((a, b) => a - b);

  // Group used numbers by value and count occurrences
  const usedCounts = new Map<number, number>();
  for (const num of usedNumbers) {
    usedCounts.set(num, (usedCounts.get(num) || 0) + 1);
  }
  
  // Get unique used numbers sorted
  const uniqueUsedNumbers = Array.from(usedCounts.keys()).sort((a, b) => a - b);

  return (
    <div className={styles.numberPad}>
      {/* Row 1: Available numbers */}
      <div className={styles.row}>
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
      </div>
      
      {/* Row 2: Action buttons */}
      <div className={styles.row}>
        <button
          className={`${styles.numberButton} ${styles.clearButton}`}
          onClick={() => onNumberClick(null)}
          disabled={disabled}
          type="button"
          aria-label="Clear"
        >
          ✕
        </button>
        <button
          className={`${styles.numberButton} ${styles.undoButton}`}
          onClick={onUndo}
          disabled={!canUndo}
          type="button"
          aria-label="Undo"
        >
          ↩
        </button>
        {onSwap && (
          <button
            className={`${styles.numberButton} ${styles.swapButton} ${swapMode ? styles.swapActive : ''} ${swapFirstCellSelected ? styles.swapPending : ''}`}
            onClick={onSwap}
            type="button"
            aria-label={swapMode ? 'Exit swap mode' : 'Swap two cells'}
            title={swapMode ? (swapFirstCellSelected ? 'Click second cell to swap' : 'Click first cell to swap') : 'Swap two cells'}
          >
            ⇄
          </button>
        )}
        {onHint && (
          <button
            className={`${styles.numberButton} ${styles.hintButton}`}
            onClick={onHint}
            disabled={!hasEmptyCells}
            type="button"
            aria-label="Get a hint"
            title="Get a hint (fills a random cell)"
          >
            💡
          </button>
        )}
        {onSolve && (
          <button
            className={`${styles.numberButton} ${styles.solveButton}`}
            onClick={onSolve}
            type="button"
            aria-label="Auto-solve (dev only)"
            title="Auto-solve (dev only)"
          >
            🔓
          </button>
        )}
      </div>
      
      {/* Row 3: Used/placed numbers */}
      {uniqueUsedNumbers.length > 0 && (
        <div className={styles.row}>
          {uniqueUsedNumbers.map((num, index) => {
            const count = usedCounts.get(num) || 0;
            const isHighlighted = highlightedNumber === num;
            return (
              <button
                key={`used-${num}-${index}`}
                className={`${styles.numberButton} ${styles.usedButton} ${isHighlighted ? styles.usedHighlighted : ''}`}
                onClick={() => onUsedNumberClick?.(num)}
                type="button"
                title={count > 1 ? `${count} placed - click to highlight` : 'Placed - click to highlight'}
              >
                {num}
                {count > 1 && <span className={styles.usedBadge}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NumberPad;
