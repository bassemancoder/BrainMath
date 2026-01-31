/**
 * Board Component - Crossword-style game grid display
 *
 * Renders a sparse grid where null cells are empty spaces.
 * Supports pinch-to-zoom and pan via react-zoom-pan-pinch library.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import type { Grid, CellError, Cell as CellType } from '@domain/types';
import { isNumberCell, isOperatorCell, isResultCell, isEqualsCell, isEmptyCell } from '@domain/entities/Cell';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Cell } from '../Cell/Cell';
import { Zoom } from '@domain/constants';
import styles from './Board.module.css';

// ============================================
// TYPES
// ============================================

interface BoardProps {
  grid: Grid;
  selectedCell: { row: number; col: number } | null;
  errors: CellError[];
  highlightedNumber?: number | null;
  swapFirstCell?: { row: number; col: number } | null;
  hintedCell?: { row: number; col: number } | null;
  errorHintCell?: { row: number; col: number } | null;
  justPlacedCell?: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  onCellDoubleClick?: (row: number, col: number) => void;
  onDeselect?: () => void;
  // Mobile header toggle
  headerCollapsed?: boolean;
  onToggleHeader?: () => void;
}

export const Board: React.FC<BoardProps> = ({
  grid,
  selectedCell,
  errors,
  highlightedNumber,
  swapFirstCell,
  hintedCell,
  errorHintCell,
  justPlacedCell,
  onCellClick,
  onCellDoubleClick,
  onDeselect,
  headerCollapsed,
  onToggleHeader,
}) => {
  // ----------------------------------------
  // Refs for auto-scrolling
  // ----------------------------------------

  /** Ref for scrolling hinted cell into view */
  const hintedCellRef = useRef<HTMLDivElement>(null);
  /** Ref for scrolling first highlighted cell into view */
  const firstHighlightedRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------
  // Auto-scroll Effects
  // ----------------------------------------

  // Scroll hinted cell into view when it changes
  useEffect(() => {
    if (hintedCell && hintedCellRef.current) {
      hintedCellRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [hintedCell]);

  // Scroll first highlighted cell into view when highlightedNumber changes
  useEffect(() => {
    if (highlightedNumber !== null && highlightedNumber !== undefined && firstHighlightedRef.current) {
      firstHighlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [highlightedNumber]);

  // ----------------------------------------
  // Cell State Helpers
  // ----------------------------------------

  const hasError = (row: number, col: number): boolean => {
    return errors.some(e => e.row === row && e.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  const isHighlighted = (cell: CellType | null): boolean => {
    if (highlightedNumber === null || highlightedNumber === undefined) return false;
    if (cell === null) return false;
    // Only highlight user-placed cells (editable, not fixed)
    if (isNumberCell(cell) && !cell.isFixed && cell.value === highlightedNumber) return true;
    return false;
  };

  const isSwapSource = (row: number, col: number): boolean => {
    return swapFirstCell?.row === row && swapFirstCell?.col === col;
  };

  const isHintTarget = (row: number, col: number): boolean => {
    return hintedCell?.row === row && hintedCell?.col === col;
  };

  const isErrorHintTarget = (row: number, col: number): boolean => {
    return errorHintCell?.row === row && errorHintCell?.col === col;
  };

  const isJustPlaced = (row: number, col: number): boolean => {
    return justPlacedCell?.row === row && justPlacedCell?.col === col;
  };

  // Compute the first highlighted cell position (to avoid mutable variable during render)
  // React Compiler will auto-memoize this computation
  const getFirstHighlightedPosition = (): { row: number; col: number } | null => {
    if (highlightedNumber === null || highlightedNumber === undefined) return null;
    
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const cell = grid.cells[row]?.[col];
        if (cell && isNumberCell(cell) && !cell.isFixed && cell.value === highlightedNumber) {
          return { row, col };
        }
      }
    }
    return null;
  };
  
  const firstHighlightedPosition = getFirstHighlightedPosition();

  const isFirstHighlighted = (row: number, col: number): boolean => {
    return firstHighlightedPosition?.row === row && firstHighlightedPosition?.col === col;
  };

  /**
   * Renders a cell based on its type
   */
  const renderCell = (cell: CellType | null, rowIndex: number, colIndex: number): React.ReactNode => {
    const key = `${rowIndex}-${colIndex}`;
    
    // Null cells are empty space in the crossword
    if (cell === null) {
      return <div key={key} className={styles.empty} onClick={onDeselect} />;
    }
    
    // Empty cell type - crossword gap
    if (isEmptyCell(cell)) {
      return <div key={key} className={styles.empty} onClick={onDeselect} />;
    }
    
    // Equals cell - just show "="
    if (isEqualsCell(cell)) {
      return (
        <div key={key} className={styles.equalsSign} onClick={onDeselect}>
          =
        </div>
      );
    }
    
    // Number, operator, and result cells use the Cell component
    if (isNumberCell(cell) || isOperatorCell(cell) || isResultCell(cell)) {
      const isHint = isHintTarget(rowIndex, colIndex);
      const isErrorHint = isErrorHintTarget(rowIndex, colIndex);
      const cellIsHighlighted = isHighlighted(cell);
      const isFirst = isFirstHighlighted(rowIndex, colIndex);
      
      // Determine which ref to use (hint takes priority)
      let refToUse: React.RefObject<HTMLDivElement | null> | undefined;
      if (isHint) {
        refToUse = hintedCellRef;
      } else if (isFirst) {
        refToUse = firstHighlightedRef;
      }
      
      return (
        <Cell
          key={key}
          cell={cell}
          isSelected={isSelected(rowIndex, colIndex)}
          hasError={hasError(rowIndex, colIndex)}
          isHighlighted={cellIsHighlighted}
          isSwapSource={isSwapSource(rowIndex, colIndex)}
          isHintTarget={isHint}
          isErrorHint={isErrorHint}
          isJustPlaced={isJustPlaced(rowIndex, colIndex)}
          cellRef={refToUse}
          onClick={() => onCellClick(rowIndex, colIndex)}
          onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(rowIndex, colIndex) : undefined}
        />
      );
    }
    
    // Fallback for unknown cell types
    return <div key={key} className={styles.empty} />;
  };

  // Calculate the actual grid bounds (compact the rendering)
  // Memoized to avoid O(n²) scan on every render
  const { minRow, maxRow, minCol, maxCol } = useMemo(() => {
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
  }, [grid]);
  
  const displayWidth = maxCol - minCol + 1;
  const displayHeight = maxRow - minRow + 1;

  // Generate column headers (H1, H2, H3...) - using relative 1-based indexing
  const renderColumnHeaders = () => {
    return (
      <>
        {/* Corner cell - toggle button on mobile */}
        {onToggleHeader ? (
          <button
            className={styles.headerToggle}
            onClick={onToggleHeader}
            type="button"
            aria-label={headerCollapsed ? 'Show header' : 'Hide header'}
          >
            {headerCollapsed ? '▼' : '▲'}
          </button>
        ) : (
          <div className={styles.indexCorner} />
        )}
        {Array.from({ length: displayWidth }).map((_, colOffset) => {
          const displayIndex = colOffset + 1; // 1-based relative index
          return (
            <div key={`h-${displayIndex}`} className={styles.columnIndex}>
              H{displayIndex}
            </div>
          );
        })}
      </>
    );
  };

  // Generate row header cell - using relative 1-based indexing
  const renderRowIndex = (rowOffset: number) => {
    const displayIndex = rowOffset + 1; // 1-based relative index
    return (
      <div className={styles.rowIndex}>
        V{displayIndex}
      </div>
    );
  };

  return (
    <div className={styles.boardContainer}>
      <TransformWrapper
        initialScale={Zoom.DEFAULT_SCALE}
        minScale={Zoom.MIN_SCALE}
        maxScale={Zoom.MAX_SCALE}
        centerOnInit={true}
        limitToBounds={true}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
        alignmentAnimation={{ disabled: true }}
        velocityAnimation={{ disabled: true }}
      >
        <TransformComponent
          wrapperClass={styles.transformWrapper}
          contentClass={styles.transformContent}
        >
          <div
            className={styles.board}
            style={{
              gridTemplateColumns: `auto repeat(${displayWidth}, auto)`,
              gridTemplateRows: `auto repeat(${displayHeight}, auto)`,
            }}
          >
            {/* Top row: column headers */}
            {renderColumnHeaders()}

            {/* Grid rows with row index on left side only */}
            {Array.from({ length: displayHeight }).map((_, rowOffset) => {
              const rowIndex = minRow + rowOffset;
              return (
                <React.Fragment key={`row-${rowIndex}`}>
                  {/* Left row index */}
                  {renderRowIndex(rowOffset)}

                  {/* Grid cells */}
                  {Array.from({ length: displayWidth }).map((_, colOffset) => {
                    const colIndex = minCol + colOffset;
                    const cell = grid.cells[rowIndex]?.[colIndex] ?? null;
                    return renderCell(cell, rowIndex, colIndex);
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
};

export default Board;
