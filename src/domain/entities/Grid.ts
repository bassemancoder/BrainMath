/**
 * Grid Entity - Factory functions and operations for the game grid
 * Pure functions with no side effects
 * 
 * Updated for crossword-style sparse grid with equations
 */

import type { Grid, GridSize, Cell, NumberCell, Equation } from '@domain/types';
import { isNumberCell } from './Cell';

/**
 * Creates an empty grid with specified dimensions
 */
export function createEmptyGrid(size: GridSize, width: number, height: number): Grid {
  const cells: (Cell | null)[][] = [];
  
  for (let row = 0; row < height; row++) {
    cells[row] = [];
    for (let col = 0; col < width; col++) {
      cells[row][col] = null;
    }
  }
  
  return {
    size,
    cells,
    width,
    height,
    equations: [],
  };
}

/**
 * Gets a cell at a specific position
 */
export function getCell(grid: Grid, row: number, col: number): Cell | null {
  if (row < 0 || row >= grid.height) return null;
  if (col < 0 || col >= grid.width) return null;
  return grid.cells[row]?.[col] ?? null;
}

/**
 * Sets a cell at a specific position (returns new grid)
 */
export function setCell(grid: Grid, row: number, col: number, cell: Cell | null): Grid {
  // Expand grid if needed
  let { width, height } = grid;
  if (row >= height) height = row + 1;
  if (col >= width) width = col + 1;
  
  const newCells: (Cell | null)[][] = [];
  for (let r = 0; r < height; r++) {
    newCells[r] = [];
    for (let c = 0; c < width; c++) {
      if (r === row && c === col) {
        newCells[r][c] = cell;
      } else {
        newCells[r][c] = grid.cells[r]?.[c] ?? null;
      }
    }
  }
  
  return {
    ...grid,
    cells: newCells,
    width,
    height,
  };
}

/**
 * Gets all editable (non-fixed) number cells from the grid
 */
export function getEditableCells(grid: Grid): NumberCell[] {
  const editable: NumberCell[] = [];
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = grid.cells[row]?.[col];
      if (cell && isNumberCell(cell) && !cell.isFixed) {
        editable.push(cell);
      }
    }
  }
  return editable;
}

/**
 * Gets all number cells from the grid
 */
export function getAllNumberCells(grid: Grid): NumberCell[] {
  const cells: NumberCell[] = [];
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = grid.cells[row]?.[col];
      if (cell && isNumberCell(cell)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * Checks if all editable number cells have values
 */
export function isGridComplete(grid: Grid): boolean {
  const editableCells = getEditableCells(grid);
  return editableCells.every(cell => cell.value !== null);
}

/**
 * Creates a deep copy of a grid
 */
export function cloneGrid(grid: Grid): Grid {
  const newCells: (Cell | null)[][] = [];
  for (let row = 0; row < grid.height; row++) {
    newCells[row] = [];
    for (let col = 0; col < grid.width; col++) {
      const cell = grid.cells[row]?.[col];
      newCells[row][col] = cell ? { ...cell } : null;
    }
  }
  
  // Clone equations with their cells
  const newEquations: Equation[] = grid.equations.map(eq => ({
    ...eq,
    numberCells: eq.numberCells.map(c => ({ ...c })),
    operatorCells: eq.operatorCells.map(c => ({ ...c })),
    resultCell: { ...eq.resultCell },
  }));
  
  return {
    size: grid.size,
    cells: newCells,
    width: grid.width,
    height: grid.height,
    equations: newEquations,
  };
}

/**
 * Gets the position key for a cell (used for Map keys)
 */
export function getCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Parses a cell key back to row and col
 */
export function parseCellKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

/**
 * Counts non-null cells in the grid
 */
export function countCells(grid: Grid): number {
  let count = 0;
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (grid.cells[row]?.[col] !== null) {
        count++;
      }
    }
  }
  return count;
}
