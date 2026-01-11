/**
 * GeneratorService - Crossword-style puzzle generation
 * 
 * This is the main entry point (facade) for puzzle generation.
 * It orchestrates the generation pipeline:
 * 1. Generate valid equations (2-4 numbers each, results always positive)
 * 2. Place equations in crossword layout with intersections
 * 3. Remove clues to create the puzzle
 * 
 * Pure functions with no side effects.
 */

import type { Grid, Difficulty, Puzzle, RandomGenerator, Operator } from '@domain/types';
import { cloneGrid } from '@domain/entities/Grid';
import { parseHash } from '@domain/entities/GameHash';
import { debug } from '@utils/debug';
import { getAllNumberCells } from './GridService';
import { isValidSolution, hasUniqueSolutionAsync } from './SolverService';
import {
  getOperatorsForDifficulty,
} from './DifficultySettings';
import { Generation } from '@domain/constants';

// Re-export types from generator module
export type { GenerationProgress, ProgressCallback } from './generator';

// Import from generator module
import {
  generateCrosswordLayout,
  removeCluesAsync,
  generate2NumberEquation,
  generate3NumberEquation,
  generate2NumberEquationWithFirst,
} from './generator';

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Maximum attempts for generation based on grid size */
function getMaxGenerationAttempts(size: number): number {
  return size <= Generation.GRID_SIZE_THRESHOLD_FOR_ATTEMPTS 
    ? Generation.MAX_ATTEMPTS_SMALL_GRID 
    : Generation.MAX_ATTEMPTS_LARGE_GRID;
}

/** Yields to browser to prevent blocking */
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ============================================
// OPERATOR DIVERSITY VALIDATION
// ============================================

/**
 * Counts how many equations use each operator type
 */
function countEquationsByOperator(grid: Grid): Map<Operator, number> {
  const counts = new Map<Operator, number>();
  
  for (const eq of grid.equations) {
    for (const opCell of eq.operatorCells) {
      const op = opCell.value;
      counts.set(op, (counts.get(op) || 0) + 1);
    }
  }
  
  return counts;
}

/**
 * Checks if the grid has sufficient operator diversity
 * For × and ÷, requires at least MIN_COMPLEX_OPERATOR_EQUATIONS when they're in the allowed set
 */
function hasOperatorDiversity(grid: Grid, allowedOperators: Operator[]): boolean {
  const complexOperators: Operator[] = ['×', '÷'];
  const operatorCounts = countEquationsByOperator(grid);
  
  for (const op of complexOperators) {
    if (allowedOperators.includes(op)) {
      const count = operatorCounts.get(op) || 0;
      if (count < Generation.MIN_COMPLEX_OPERATOR_EQUATIONS) {
        debug.log(`Operator diversity check failed: ${op} has ${count} equations, need at least ${Generation.MIN_COMPLEX_OPERATOR_EQUATIONS}`);
        return false;
      }
    }
  }
  
  return true;
}

// ============================================
// MAIN GENERATION FUNCTIONS
// ============================================

/**
 * Main puzzle generation function
 * Takes a hash and returns a puzzle with its solution
 */
export async function generatePuzzle(
  hash: string,
  rng: RandomGenerator
): Promise<Puzzle | null> {
  const parsed = parseHash(hash);
  const { size, difficulty } = parsed;
  const allowedOperators = getOperatorsForDifficulty(difficulty);
  
  // Try to generate a valid crossword layout (with retries)
  let completedGrid: Grid | null = null;
  let attempts = 0;
  const maxAttempts = getMaxGenerationAttempts(size);
  
  while (!completedGrid && attempts < maxAttempts) {
    const candidateGrid = await generateCrosswordLayout(size, difficulty, rng);
    if (candidateGrid) {
      // Verify the generated grid is a valid solution
      if (!isValidSolution(candidateGrid)) {
        console.warn('Generated grid failed validation on attempt', attempts + 1);
        // Debug: log the equations
        for (const eq of candidateGrid.equations) {
          const nums = eq.numberCells.map(c => c.value ?? '?').join(', ');
          const ops = eq.operatorCells.map(c => c.value).join(', ');
          console.warn(`  Equation ${eq.id} (${eq.direction}): [${nums}] ops [${ops}] = ${eq.resultCell.value}`);
        }
      } else if (!hasOperatorDiversity(candidateGrid, allowedOperators)) {
        console.warn('Generated grid failed operator diversity on attempt', attempts + 1);
      } else {
        completedGrid = candidateGrid;
      }
    } else {
      console.warn('generateCrosswordLayout returned null on attempt', attempts + 1);
    }
    attempts++;
  }
  
  if (!completedGrid) {
    console.error('Failed to generate valid grid after', maxAttempts, 'attempts');
    return null;
  }
  
  // Store the solution
  const solution = cloneGrid(completedGrid);
  
  // Remove clues to create the puzzle (using async version to prevent UI blocking)
  const puzzleGrid = await removeCluesAsync(completedGrid, difficulty, rng);
  
  return {
    grid: puzzleGrid,
    solution,
    hash,
    difficulty,
  };
}

/**
 * Async puzzle generation with progress reporting
 * Yields to browser periodically to prevent blocking
 */
export async function generatePuzzleAsync(
  hash: string,
  rng: RandomGenerator,
  onProgress?: (progress: import('./generator').GenerationProgress) => void
): Promise<Puzzle | null> {
  const parsed = parseHash(hash);
  const { size, difficulty } = parsed;
  const allowedOperators = getOperatorsForDifficulty(difficulty);
  
  // Try to generate a valid crossword layout (with retries)
  let completedGrid: Grid | null = null;
  let attempts = 0;
  const maxAttempts = getMaxGenerationAttempts(size);
  
  while (!completedGrid && attempts < maxAttempts) {
    // Report progress
    onProgress?.({
      phase: 'layout',
      attempt: attempts + 1,
      maxAttempts: maxAttempts,
      message: `Generating layout (attempt ${attempts + 1}/${maxAttempts})...`,
    });
    
    // Yield to browser to prevent blocking
    await yieldToBrowser();
    
    const candidateGrid = await generateCrosswordLayout(size, difficulty, rng);
    if (candidateGrid) {
      onProgress?.({
        phase: 'validation',
        attempt: attempts + 1,
        maxAttempts: maxAttempts,
        message: 'Validating solution...',
      });
      
      await yieldToBrowser();
      
      // Verify the generated grid is a valid solution and has operator diversity
      if (!isValidSolution(candidateGrid)) {
        console.warn('Generated grid failed validation on attempt', attempts + 1);
      } else if (!hasOperatorDiversity(candidateGrid, allowedOperators)) {
        console.warn('Generated grid failed operator diversity on attempt', attempts + 1);
      } else {
        completedGrid = candidateGrid;
      }
    }
    attempts++;
  }
  
  if (!completedGrid) {
    onProgress?.({
      phase: 'failed',
      attempt: attempts,
      maxAttempts: maxAttempts,
      message: 'Failed to generate puzzle',
    });
    return null;
  }
  
  onProgress?.({
    phase: 'clues',
    attempt: attempts,
    maxAttempts: maxAttempts,
    message: 'Removing clues...',
  });
  
  await yieldToBrowser();
  
  // Store the solution
  const solution = cloneGrid(completedGrid);
  
  // Remove clues to create the puzzle (using async version to prevent UI blocking)
  const puzzleGrid = await removeCluesAsync(completedGrid, difficulty, rng);
  
  onProgress?.({
    phase: 'complete',
    attempt: attempts,
    maxAttempts: maxAttempts,
    message: 'Puzzle ready!',
  });
  
  return {
    grid: puzzleGrid,
    solution,
    hash,
    difficulty,
  };
}

/**
 * Validates that a puzzle is solvable and has a unique solution
 */
export async function validatePuzzle(puzzle: Puzzle): Promise<boolean> {
  return hasUniqueSolutionAsync(puzzle.grid);
}

/**
 * Gets statistics about a puzzle
 */
export function getPuzzleStats(puzzle: Puzzle): {
  totalCells: number;
  filledCells: number;
  emptyCells: number;
  difficulty: Difficulty;
} {
  const numberCells = getAllNumberCells(puzzle.grid);
  let filledCells = 0;
  let emptyCells = 0;
  
  for (const cell of numberCells) {
    if (cell.value !== null && cell.isFixed) {
      filledCells++;
    } else {
      emptyCells++;
    }
  }
  
  return {
    totalCells: numberCells.length,
    filledCells,
    emptyCells,
    difficulty: puzzle.difficulty,
  };
}

// Re-export for testing and backwards compatibility
export {
  generate2NumberEquation,
  generate3NumberEquation,
  generate2NumberEquationWithFirst,
  generateCrosswordLayout,
  removeCluesAsync,
};
