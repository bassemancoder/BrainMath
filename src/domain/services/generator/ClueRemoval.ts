/**
 * ClueRemoval - Removes clues from completed grids to create puzzles
 * 
 * Uses fast constraint propagation (AC-3) for uniqueness verification,
 * enabling uniqueness checks on large grids without exponential backtracking.
 * Respects difficulty settings for minimum removals and zero-revealed limits.
 */

import type { Grid, Difficulty, RandomGenerator } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { cloneGrid } from '@domain/entities/Grid';
import {
  markCellsAsEditable,
  getAllNumberCells,
  getCellAt,
} from '../GridService';
import {
  getRemovalPercentage,
  getMinRemovalsPerEquation,
  getMaxZeroRevealedEquations,
} from '../DifficultySettings';
import { 
  hasUniqueSolutionFastAsync,
  addCluesUntilUnique,
} from '../ConstraintService';

// ============================================
// ASYNC HELPERS
// ============================================

/** Yield control to browser to prevent UI blocking */
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ============================================
// ZERO-REVEALED TRACKING
// ============================================

/**
 * Counts how many equations have zero revealed (fixed) cells
 */
function countZeroRevealedEquations(grid: Grid): number {
  let count = 0;
  for (const equation of grid.equations) {
    const fixedCells = equation.numberCells.filter(cellPos => {
      const cell = getCellAt(grid, cellPos.row, cellPos.col);
      return cell && isNumberCell(cell) && cell.isFixed;
    });
    if (fixedCells.length === 0) {
      count++;
    }
  }
  return count;
}

/**
 * Checks if removing a cell would cause an equation to have zero revealed cells,
 * and if so, whether that would exceed the allowed limit
 */
function wouldExceedZeroRevealedLimit(
  grid: Grid,
  row: number,
  col: number,
  difficulty: Difficulty
): boolean {
  const maxPercentage = getMaxZeroRevealedEquations(difficulty);
  const totalEquations = grid.equations.length;
  const maxAllowed = Math.floor(totalEquations * maxPercentage);
  
  // Check current count of zero-revealed equations
  const currentZeroRevealed = countZeroRevealedEquations(grid);
  
  // Find equations that contain this cell
  const affectedEquations = grid.equations.filter(eq =>
    eq.numberCells.some(c => c.row === row && c.col === col)
  );
  
  // For each affected equation, check if removing this cell would make it zero-revealed
  for (const eq of affectedEquations) {
    const fixedCells = eq.numberCells.filter(cellPos => {
      const cell = getCellAt(grid, cellPos.row, cellPos.col);
      return cell && isNumberCell(cell) && cell.isFixed;
    });
    
    // If this equation has exactly 1 fixed cell and we're about to remove it,
    // it will become a zero-revealed equation
    if (fixedCells.length === 1 && fixedCells[0].row === row && fixedCells[0].col === col) {
      // Check if adding another zero-revealed equation would exceed the limit
      if (currentZeroRevealed >= maxAllowed) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================
// ENSURE MINIMUM BLANKS
// ============================================

/**
 * Counts how many equations contain a specific cell
 */
function countEquationsContainingCell(grid: Grid, row: number, col: number): number {
  return grid.equations.filter(eq =>
    eq.numberCells.some(c => c.row === row && c.col === col)
  ).length;
}

/**
 * Ensures every equation has at least one blank (editable) cell.
 * This prevents fully-revealed equations that serve no purpose in the puzzle.
 * Prioritizes non-shared cells for removal to minimize impact on other equations.
 */
function ensureMinimumBlanksPerEquation(grid: Grid, rng: RandomGenerator): Grid {
  let resultGrid = grid;
  
  for (const equation of resultGrid.equations) {
    // Count editable (blank) cells in this equation
    const editableCells = equation.numberCells.filter(cellPos => {
      const cell = getCellAt(resultGrid, cellPos.row, cellPos.col);
      return cell && isNumberCell(cell) && !cell.isFixed;
    });
    
    // If equation already has at least one blank, skip it
    if (editableCells.length > 0) continue;
    
    // This equation has no blanks - we need to force remove one cell
    // Get all fixed cells in this equation
    const fixedCells = equation.numberCells.filter(cellPos => {
      const cell = getCellAt(resultGrid, cellPos.row, cellPos.col);
      return cell && isNumberCell(cell) && cell.isFixed;
    });
    
    if (fixedCells.length === 0) continue; // No cells to remove (shouldn't happen)
    
    // Sort by number of equations containing the cell (prefer non-shared cells)
    // This minimizes cascading effects on other equations
    const sortedCells = [...fixedCells].sort((a, b) => {
      const countA = countEquationsContainingCell(resultGrid, a.row, a.col);
      const countB = countEquationsContainingCell(resultGrid, b.row, b.col);
      return countA - countB; // Prefer cells in fewer equations
    });
    
    // Find cells with the minimum sharing count
    const minCount = countEquationsContainingCell(resultGrid, sortedCells[0].row, sortedCells[0].col);
    const leastSharedCells = sortedCells.filter(c => 
      countEquationsContainingCell(resultGrid, c.row, c.col) === minCount
    );
    
    // Randomly pick one from the least-shared cells for variety
    const shuffled = [...leastSharedCells];
    rng.shuffle(shuffled);
    const cellToRemove = shuffled[0];
    
    // Mark this cell as editable
    resultGrid = markCellsAsEditable(resultGrid, [{ row: cellToRemove.row, col: cellToRemove.col }]);
  }
  
  return resultGrid;
}

// ============================================
// CLUE REMOVAL
// ============================================

/**
 * Removes clues from a completed grid to create a puzzle (async)
 * Yields to browser periodically to prevent UI blocking on mobile devices
 * Uses fast constraint propagation for uniqueness verification
 * Guarantees EACH EQUATION has minimum missing numbers based on difficulty
 * Respects the max percentage of equations allowed to have 0 revealed cells
 */
export async function removeCluesAsync(
  completedGrid: Grid,
  difficulty: Difficulty,
  rng: RandomGenerator
): Promise<Grid> {
  let puzzleGrid = cloneGrid(completedGrid);
  const minPerEquation = getMinRemovalsPerEquation(difficulty);
  
  // Step 1: Ensure each equation has minimum missing cells based on difficulty
  for (const equation of puzzleGrid.equations) {
    const eqNumberCells = equation.numberCells;
    if (eqNumberCells.length === 0) continue;
    
    // Yield to browser periodically
    await yieldToBrowser();
    
    // Shuffle cells for randomness
    const cellIndices = eqNumberCells.map((_, i) => i);
    rng.shuffle(cellIndices);
    
    // Remove up to minPerEquation cells from this equation
    let removedFromEq = 0;
    for (const idx of cellIndices) {
      if (removedFromEq >= minPerEquation) break;
      if (removedFromEq >= eqNumberCells.length - 1) break; // Keep at least 1 visible
      
      const cellToRemove = eqNumberCells[idx];
      const currentCell = getCellAt(puzzleGrid, cellToRemove.row, cellToRemove.col);
      
      if (currentCell && isNumberCell(currentCell) && currentCell.isFixed) {
        // Check if removal would exceed zero-revealed limit
        if (wouldExceedZeroRevealedLimit(puzzleGrid, cellToRemove.row, cellToRemove.col, difficulty)) {
          continue; // Skip this cell, try another
        }
        puzzleGrid = markCellsAsEditable(puzzleGrid, [{ row: cellToRemove.row, col: cellToRemove.col }]);
        removedFromEq++;
      }
    }
  }
  
  // Step 2: Remove additional clues based on difficulty percentage
  // Now uses fast constraint propagation - works for ALL grid sizes!
  const allNumberCells = getAllNumberCells(completedGrid);
  
  const numberCells = getAllNumberCells(puzzleGrid).filter(c => c.isFixed);
  const positions = numberCells.map(c => ({ row: c.row, col: c.col }));
  rng.shuffle(positions);
  
  const targetTotal = Math.floor(allNumberCells.length * getRemovalPercentage(difficulty));
  const alreadyRemoved = allNumberCells.length - numberCells.length;
  const additionalRemovals = Math.max(0, targetTotal - alreadyRemoved);
  
  let removed = 0;
  
  for (const { row, col } of positions) {
    if (removed >= additionalRemovals) break;
    
    // Yield to browser each iteration
    await yieldToBrowser();
    
    const cell = getCellAt(puzzleGrid, row, col);
    if (!cell || !isNumberCell(cell) || !cell.isFixed) continue;
    
    // Check if removal would exceed zero-revealed limit
    if (wouldExceedZeroRevealedLimit(puzzleGrid, row, col, difficulty)) {
      continue; // Skip this cell, try another
    }
    
    const testGrid = markCellsAsEditable(puzzleGrid, [{ row, col }]);
    
    // Use fast constraint propagation for uniqueness check
    if (await hasUniqueSolutionFastAsync(testGrid)) {
      puzzleGrid = testGrid;
      removed++;
    }
  }
  
  // Step 3: Final pass - ensure no equation is fully revealed
  puzzleGrid = ensureMinimumBlanksPerEquation(puzzleGrid, rng);
  
  // Step 4: Ensure uniqueness by adding strategic clues if needed
  // This handles edge cases where the puzzle might be ambiguous
  const { grid: uniqueGrid } = addCluesUntilUnique(puzzleGrid, completedGrid);
  
  return uniqueGrid;
}
