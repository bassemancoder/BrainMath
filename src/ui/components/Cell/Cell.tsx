/**
 * Cell Component - Individual cell in the game grid
 */

import React, { useRef, useCallback } from 'react';
import type { Cell as CellType } from '@domain/types';
import { isNumberCell, isOperatorCell, isResultCell } from '@domain/entities/Cell';
import { Timing } from '@domain/constants';
import styles from './Cell.module.css';

interface CellProps {
  cell: CellType;
  isSelected: boolean;
  hasError: boolean;
  isHighlighted?: boolean;
  isSwapSource?: boolean;
  isHintTarget?: boolean;
  isErrorHint?: boolean;
  isJustPlaced?: boolean;
  cellRef?: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  onDoubleClick?: () => void;
}

// Wrap in React.memo to prevent unnecessary re-renders
// Cell only re-renders when its props actually change
const CellComponent: React.FC<CellProps> = ({ cell, isSelected, hasError, isHighlighted, isSwapSource, isHintTarget, isErrorHint, isJustPlaced, cellRef, onClick, onDoubleClick }) => {
  const lastTapTimeRef = useRef<number>(0);
  
  // Handle click with double-click/double-tap detection
  const handleClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    
    if (timeSinceLastTap < Timing.DOUBLE_TAP_THRESHOLD_MS && timeSinceLastTap > 0) {
      // Double-tap detected
      lastTapTimeRef.current = 0; // Reset to prevent triple-tap
      if (onDoubleClick) {
        onDoubleClick();
      }
    } else {
      // Single tap - schedule it but also call onClick for selection
      lastTapTimeRef.current = now;
      onClick();
    }
  }, [onClick, onDoubleClick]);

  const getCellContent = (): React.ReactNode => {
    if (isNumberCell(cell)) {
      return cell.value !== null ? String(cell.value) : '';
    }
    if (isOperatorCell(cell)) {
      // Display / instead of ÷ for better readability on mobile
      // Wrap in span for better vertical centering control
      const symbol = cell.value === '÷' ? '/' : cell.value;

      return <span className={styles.operatorSymbol}>{symbol}</span>;
    }
    if (isResultCell(cell)) {
      return String(cell.value);
    }
    return '';
  };

  const getCellClassName = (): string => {
    const classes = [styles.cell];

    if (isNumberCell(cell)) {
      classes.push(styles.numberCell);
      if (cell.isFixed) {
        classes.push(styles.fixed);
      } else {
        classes.push(styles.editable);
      }
      if (isSelected) {
        classes.push(styles.selected);
      }
      if (hasError) {
        classes.push(styles.error);
      }
      if (isSwapSource) {
        classes.push(styles.swapSource);
      }
      if (isHintTarget) {
        classes.push(styles.hintTarget);
      }
      if (isErrorHint) {
        classes.push(styles.errorHint);
      }
      if (isHighlighted && !isSelected && !isSwapSource && !isHintTarget) {
        classes.push(styles.highlighted);
      }
      if (isJustPlaced) {
        classes.push(styles.justPlaced);
      }
    } else if (isOperatorCell(cell)) {
      classes.push(styles.operatorCell);
    } else if (isResultCell(cell)) {
      classes.push(styles.resultCell);
    }

    return classes.join(' ');
  };

  const isClickable = isNumberCell(cell) && !cell.isFixed;

  return (
    <div
      ref={cellRef}
      className={getCellClassName()}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      } : undefined}
    >
      {getCellContent()}
    </div>
  );
};

// Wrap in React.memo to prevent unnecessary re-renders
// Cell only re-renders when its props actually change
export const Cell = React.memo(CellComponent);
export default Cell;
