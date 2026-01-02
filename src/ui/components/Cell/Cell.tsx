/**
 * Cell Component - Individual cell in the game grid
 */

import React from 'react';
import type { Cell as CellType } from '@domain/types';
import { isNumberCell, isOperatorCell, isResultCell } from '@domain/entities/Cell';
import styles from './Cell.module.css';

interface CellProps {
  cell: CellType;
  isSelected: boolean;
  hasError: boolean;
  onClick: () => void;
}

export const Cell: React.FC<CellProps> = ({ cell, isSelected, hasError, onClick }) => {
  const getCellContent = (): string => {
    if (isNumberCell(cell)) {
      return cell.value !== null ? String(cell.value) : '';
    }
    if (isOperatorCell(cell)) {
      return cell.value;
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
      className={getCellClassName()}
      onClick={isClickable ? onClick : undefined}
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

export default Cell;
