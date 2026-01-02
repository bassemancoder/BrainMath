/**
 * PlaceNumberUseCase - Handles placing a number in a cell
 * Validates the move and checks for win condition
 */

import type { Grid, CellError } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { setNumberValue } from '@domain/services/GridService';
import { validateGrid, checkWinCondition } from '@domain/services/ValidationService';

export interface PlaceNumberInput {
  grid: Grid;
  solution: Grid;
  row: number;
  col: number;
  value: number | null; // null = clear the cell
}

export interface PlaceNumberOutput {
  success: boolean;
  grid: Grid;
  errors: CellError[];
  isComplete: boolean;
  isWon: boolean;
  error?: string;
}

/**
 * Places a number in a cell and validates the result
 */
export function placeNumber(input: PlaceNumberInput): PlaceNumberOutput {
  const { grid, solution, row, col, value } = input;
  
  // Validate cell exists and is editable
  const cell = grid.cells[row]?.[col];
  if (!cell) {
    return {
      success: false,
      grid,
      errors: [],
      isComplete: false,
      isWon: false,
      error: 'Invalid cell position',
    };
  }
  
  if (!isNumberCell(cell)) {
    return {
      success: false,
      grid,
      errors: [],
      isComplete: false,
      isWon: false,
      error: 'Cannot place number in this cell type',
    };
  }
  
  if (cell.isFixed) {
    return {
      success: false,
      grid,
      errors: [],
      isComplete: false,
      isWon: false,
      error: 'Cannot modify a fixed cell',
    };
  }
  
  // Validate value range
  if (value !== null && (value < 1 || value > 200 || !Number.isInteger(value))) {
    return {
      success: false,
      grid,
      errors: [],
      isComplete: false,
      isWon: false,
      error: 'Value must be a positive integer',
    };
  }
  
  // Place the number
  const newGrid = setNumberValue(grid, row, col, value);
  
  // Validate the grid
  const validation = validateGrid(newGrid);
  
  // Check win condition
  const isWon = validation.isComplete && checkWinCondition(newGrid, solution);
  
  return {
    success: true,
    grid: newGrid,
    errors: validation.errors,
    isComplete: validation.isComplete,
    isWon,
  };
}

/**
 * Clears a cell (sets value to null)
 */
export function clearCell(input: Omit<PlaceNumberInput, 'value'>): PlaceNumberOutput {
  return placeNumber({ ...input, value: null });
}
