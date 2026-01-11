/**
 * SolverService - Backtracking solver for puzzle validation
 * Used to verify puzzles have exactly one solution
 * Pure functions with no side effects
 */

import type { Grid, Equation } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { cloneGrid } from '@domain/entities/Grid';
import { getAllEquations, setNumberValue, getEditableNumberCells } from './GridService';
import { evaluateEquation, getExpectedResult, isEquationComplete } from './EquationService';
import { Solver } from '@domain/constants';
import { debug } from '@utils/debug';

// ============================================
// ASYNC HELPERS
// ============================================

/** Yield control to browser to prevent UI blocking */
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** How often to yield during solving (every N iterations) */
const YIELD_EVERY_N_ITERATIONS = 50;

// ============================================
// CELL FINDING
// ============================================

/**
 * Finds the first empty (null value) editable number cell
 */
export function findFirstEmptyCell(grid: Grid): { row: number; col: number } | null {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = grid.cells[row]?.[col];
      if (cell && isNumberCell(cell) && !cell.isFixed && cell.value === null) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Gets all empty editable cells
 */
export function getAllEmptyCells(grid: Grid): Array<{ row: number; col: number }> {
  return getEditableNumberCells(grid)
    .filter(cell => cell.value === null)
    .map(cell => ({ row: cell.row, col: cell.col }));
}

// ============================================
// VALIDATION
// ============================================

/**
 * Checks if placing a value at a position keeps all equations valid so far
 * An equation is valid if:
 * - It's incomplete (has nulls) - we can't validate yet
 * - It's complete and evaluates to its expected result
 */
export function isPlacementValid(grid: Grid, row: number, col: number, value: number): boolean {
  // Temporarily place the value
  const testGrid = setNumberValue(grid, row, col, value);
  
  // Check all equations that include this cell
  const equations = getAllEquations(testGrid);
  
  for (const equation of equations) {
    // Check if this equation includes the cell we just modified
    const includesCell = equation.numberCells.some(
      c => c.row === row && c.col === col
    );
    
    if (!includesCell) continue;
    
    // We need to get the updated equation from the test grid
    const updatedEquation = getUpdatedEquation(testGrid, equation);
    
    // If equation is complete, it must be valid
    if (isEquationComplete(updatedEquation)) {
      const result = evaluateEquation(updatedEquation);
      const expected = getExpectedResult(updatedEquation);
      
      if (result !== expected) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Gets an equation with updated cell values from the grid
 */
function getUpdatedEquation(grid: Grid, equation: Equation): Equation {
  const numberCells = equation.numberCells.map(cell => {
    const gridCell = grid.cells[cell.row]?.[cell.col];
    if (gridCell && isNumberCell(gridCell)) {
      return gridCell;
    }
    return cell;
  });
  
  return {
    ...equation,
    numberCells,
  };
}

/**
 * Gets possible values for a cell (positive integers that don't immediately violate constraints)
 */
export function getPossibleValues(
  grid: Grid,
  row: number,
  col: number,
  maxValue: number = Solver.DEFAULT_MAX_VALUE
): number[] {
  const possible: number[] = [];
  
  for (let value = 1; value <= maxValue; value++) {
    if (isPlacementValid(grid, row, col, value)) {
      possible.push(value);
    }
  }
  
  return possible;
}

// ============================================
// SOLVING
// ============================================

/**
 * Solves the puzzle using backtracking
 * Returns the solved grid or null if no solution exists
 */
export function solvePuzzle(grid: Grid, maxValue: number = Solver.DEFAULT_MAX_VALUE): Grid | null {
  const emptyCell = findFirstEmptyCell(grid);
  
  // No empty cells = puzzle is complete
  if (!emptyCell) {
    // Verify all equations are valid
    if (isValidSolution(grid)) {
      return grid;
    }
    return null;
  }
  
  const { row, col } = emptyCell;
  
  // Try each possible value
  for (let value = 1; value <= maxValue; value++) {
    if (isPlacementValid(grid, row, col, value)) {
      const newGrid = setNumberValue(grid, row, col, value);
      const solution = solvePuzzle(newGrid, maxValue);
      
      if (solution) {
        return solution;
      }
    }
  }
  
  // No valid value found
  return null;
}

/**
 * Counts the number of solutions for a puzzle (up to maxCount) - async version
 * Yields to browser periodically to prevent UI blocking on mobile devices
 */
export async function countSolutionsAsync(
  grid: Grid,
  maxCount: number = Solver.DEFAULT_MAX_COUNT,
  maxValue: number = Solver.DEFAULT_MAX_VALUE
): Promise<number> {
  let count = 0;
  let iterations = 0;
  
  async function solve(currentGrid: Grid): Promise<boolean> {
    iterations++;
    
    // Yield to browser periodically
    if (iterations % YIELD_EVERY_N_ITERATIONS === 0) {
      await yieldToBrowser();
    }
    
    const emptyCell = findFirstEmptyCell(currentGrid);
    
    if (!emptyCell) {
      // Check if this is a valid solution
      if (isValidSolution(currentGrid)) {
        count++;
        return count >= maxCount; // Stop if we've found enough
      }
      return false;
    }
    
    const { row, col } = emptyCell;
    
    for (let value = 1; value <= maxValue; value++) {
      if (isPlacementValid(currentGrid, row, col, value)) {
        const newGrid = setNumberValue(currentGrid, row, col, value);
        if (await solve(newGrid)) {
          return true; // Stop early if we've found enough solutions
        }
      }
    }
    
    return false;
  }
  
  await solve(grid);
  return count;
}

/**
 * Checks if a puzzle has exactly one solution (async)
 * Yields to browser periodically to prevent UI blocking on mobile devices
 */
export async function hasUniqueSolutionAsync(grid: Grid, maxValue: number = Solver.DEFAULT_MAX_VALUE): Promise<boolean> {
  const solutions = await countSolutionsAsync(grid, Solver.DEFAULT_MAX_COUNT, maxValue);
  return solutions === 1;
}

// ============================================
// GRID COMPLETION
// ============================================

/**
 * Checks if the grid is complete (all editable number cells have values)
 * Only checks non-fixed number cells - fixed cells are hints
 */
export function isGridComplete(grid: Grid): boolean {
  return findFirstEmptyCell(grid) === null;
}

/**
 * Checks if the current grid state is a valid solution
 */
export function isValidSolution(grid: Grid): boolean {
  if (!isGridComplete(grid)) {
    debug.log('Grid is not complete');
    return false;
  }
  
  const equations = getAllEquations(grid);
  debug.log('Checking', equations.length, 'equations');
  
  for (const equation of equations) {
    // Get updated equation with current grid values
    const updatedEquation = getUpdatedEquation(grid, equation);
    
    const result = evaluateEquation(updatedEquation);
    const expected = getExpectedResult(updatedEquation);
    
    debug.log(`Eq ${equation.id} (${equation.direction}):`, 
      'cells:', updatedEquation.numberCells.map(c => `(${c.row},${c.col})=${c.value}`).join(', '),
      'ops:', updatedEquation.operatorCells.map(c => c.value).join(', '),
      'result:', expected,
      'evaluated:', result);
    
    if (result !== expected) {
      debug.log('INVALID: result', result, '!= expected', expected);
      return false;
    }
  }
  
  return true;
}

// ============================================
// HINTS
// ============================================

/**
 * Gets a hint: returns a cell position and its correct value
 */
export function getHint(
  currentGrid: Grid,
  solution: Grid
): { row: number; col: number; value: number } | null {
  for (let row = 0; row < currentGrid.height; row++) {
    for (let col = 0; col < currentGrid.width; col++) {
      const cell = currentGrid.cells[row]?.[col];
      if (cell && isNumberCell(cell) && !cell.isFixed && cell.value === null) {
        const solutionCell = solution.cells[row]?.[col];
        if (solutionCell && isNumberCell(solutionCell) && solutionCell.value !== null) {
          return {
            row,
            col,
            value: solutionCell.value,
          };
        }
      }
    }
  }
  return null;
}

// Re-export cloneGrid for convenience
export { cloneGrid };
