/**
 * NumberPad Component - On-screen number input
 * Shows available numbers and used (placed) numbers
 */

import React, { useState, useEffect } from 'react';
import styles from './NumberPad.module.css';

interface NumberPadProps {
  onNumberClick: (value: number | null) => void;
  onUndo: () => void;
  onSolve?: () => void;
  onSwap?: () => void;
  onHint?: () => void;
  onUncertain?: () => void;
  disabled: boolean;
  canUndo: boolean;
  /** Whether the selected cell can be cleared (has a value) */
  canClear?: boolean;
  /** Whether uncertain tagging mode is active */
  uncertainMode?: boolean;
  /** Whether swap mode is currently active */
  swapMode?: boolean;
  /** Whether a first cell is selected in swap mode */
  swapFirstCellSelected?: boolean;
  /** Whether there are empty cells to give hints for */
  hasEmptyCells?: boolean;
  /** Timestamp when hint cooldown expires */
  hintCooldownUntil?: number | null;
  /** Available numbers that can be placed (includes duplicates) */
  availableNumbers: number[];
  /** Numbers that have been placed on the board */
  usedNumbers: number[];
  /** Currently highlighted number (for showing which cells have this value) */
  highlightedNumber?: number | null;
  /** Callback when a used number is clicked to highlight matching cells */
  onUsedNumberClick?: (value: number) => void;
}

export const NumberPad: React.FC<NumberPadProps> = ({ onNumberClick, onUndo, onSolve, onSwap, onHint, onUncertain, disabled, canUndo, canClear, uncertainMode, swapMode, swapFirstCellSelected, hasEmptyCells, hintCooldownUntil, availableNumbers, usedNumbers, highlightedNumber, onUsedNumberClick }) => {
  // Track remaining cooldown in state (updated by interval)
  const [hintCooldownRemaining, setHintCooldownRemaining] = useState(() => {
    if (!hintCooldownUntil) return 0;
    return Math.max(0, Math.ceil((hintCooldownUntil - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!hintCooldownUntil) {
      return;
    }

    // Calculate remaining time
    const calculateRemaining = () => Math.max(0, Math.ceil((hintCooldownUntil - Date.now()) / 1000));

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setHintCooldownRemaining(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100); // Start quickly to get initial value, then updates every 100ms for smoother countdown
    
    return () => clearInterval(interval);
  }, [hintCooldownUntil]);

  const isHintOnCooldown = hintCooldownRemaining > 0;

  // Calculate progress percentage
  const totalNumbers = availableNumbers.length + usedNumbers.length;
  const progressPercent = totalNumbers > 0 ? Math.round((usedNumbers.length / totalNumbers) * 100) : 0;

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
        <span className={styles.progressText} title="Progress">{progressPercent}%</span>
        <button
          className={`${styles.numberButton} ${styles.clearButton}`}
          onClick={() => onNumberClick(null)}
          disabled={!canClear}
          type="button"
          aria-label="Clear"
        >
          ✕
        </button>
        {onUncertain && (
          <button
            className={`${styles.numberButton} ${styles.uncertainButton} ${uncertainMode ? styles.uncertainActive : ''}`}
            onClick={onUncertain}
            type="button"
            aria-label={uncertainMode ? "Exit uncertain tagging mode" : "Enter uncertain tagging mode"}
            title={uncertainMode ? "Exit uncertain tagging mode" : "Enter uncertain tagging mode (click cells to toggle)"}
          >
            ✏️
          </button>
        )}
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
            className={`${styles.numberButton} ${styles.hintButton} ${isHintOnCooldown ? styles.hintCooldown : ''}`}
            onClick={onHint}
            disabled={!hasEmptyCells || isHintOnCooldown}
            type="button"
            aria-label={isHintOnCooldown ? `Hint cooldown: ${hintCooldownRemaining}s` : "Get a hint"}
            title={isHintOnCooldown ? `Wait ${hintCooldownRemaining}s for next hint` : "Get a hint (fills a random cell)"}
          >
            {isHintOnCooldown ? hintCooldownRemaining : '💡'}
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
