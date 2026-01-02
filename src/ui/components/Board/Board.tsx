/**
 * Board Component - Crossword-style game grid display
 * Renders a sparse grid where null cells are empty spaces
 */

import React from 'react';
import type { Grid, CellError, Cell as CellType } from '@domain/types';
import { isNumberCell, isOperatorCell, isResultCell, isEqualsCell, isEmptyCell } from '@domain/entities/Cell';
import { Cell } from '../Cell/Cell';
import styles from './Board.module.css';

interface BoardProps {
  grid: Grid;
  selectedCell: { row: number; col: number } | null;
  errors: CellError[];
  onCellClick: (row: number, col: number) => void;
}

export const Board: React.FC<BoardProps> = ({
  grid,
  selectedCell,
  errors,
  onCellClick,
}) => {
  const hasError = (row: number, col: number): boolean => {
    return errors.some(e => e.row === row && e.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  /**
   * Renders a cell based on its type
   */
  const renderCell = (cell: CellType | null, rowIndex: number, colIndex: number): React.ReactNode => {
    const key = `${rowIndex}-${colIndex}`;
    
    // Null cells are empty space in the crossword
    if (cell === null) {
      return <div key={key} className={styles.empty} />;
    }
    
    // Empty cell type - crossword gap
    if (isEmptyCell(cell)) {
      return <div key={key} className={styles.empty} />;
    }
    
    // Equals cell - just show "="
    if (isEqualsCell(cell)) {
      return (
        <div key={key} className={styles.equalsSign}>
          =
        </div>
      );
    }
    
    // Number, operator, and result cells use the Cell component
    if (isNumberCell(cell) || isOperatorCell(cell) || isResultCell(cell)) {
      return (
        <Cell
          key={key}
          cell={cell}
          isSelected={isSelected(rowIndex, colIndex)}
          hasError={hasError(rowIndex, colIndex)}
          onClick={() => onCellClick(rowIndex, colIndex)}
        />
      );
    }
    
    // Fallback for unknown cell types
    return <div key={key} className={styles.empty} />;
  };

  // Calculate the actual grid bounds (compact the rendering)
  const getGridBounds = () => {
    let minRow = grid.height;
    let maxRow = 0;
    let minCol = grid.width;
    let maxCol = 0;
    
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        if (grid.cells[row]?.[col] !== null) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }
    
    return { minRow, maxRow, minCol, maxCol };
  };
  
  const { minRow, maxRow, minCol, maxCol } = getGridBounds();
  const displayWidth = maxCol - minCol + 1;
  const displayHeight = maxRow - minRow + 1;

  return (
    <div className={styles.boardContainer}>
      <div
        className={styles.board}
        style={{
          gridTemplateColumns: `repeat(${displayWidth}, auto)`,
          gridTemplateRows: `repeat(${displayHeight}, auto)`,
        }}
      >
        {Array.from({ length: displayHeight }).map((_, rowOffset) => {
          const rowIndex = minRow + rowOffset;
          return Array.from({ length: displayWidth }).map((_, colOffset) => {
            const colIndex = minCol + colOffset;
            const cell = grid.cells[rowIndex]?.[colIndex] ?? null;
            return renderCell(cell, rowIndex, colIndex);
          });
        })}
      </div>
    </div>
  );
};

export default Board;
