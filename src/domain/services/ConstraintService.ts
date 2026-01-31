/**
 * ConstraintService - Fast constraint propagation for puzzle uniqueness verification
 * 
 * Uses AC-3 (Arc Consistency) algorithm to compute valid domains for each cell.
 * This is O(n²) instead of exponential backtracking, enabling uniqueness checks
 * on large grids.
 * 
 * Key insight: For math equations, most cells have highly constrained domains.
 * Division and subtraction often yield single-value domains.
 */

import type { Grid, Equation, NumberCell } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { getCellAt, getAllEquations } from './GridService';
import { Cell } from '@domain/constants';
import { computeDomainForCellInEquation, createFullDomain } from './DomainComputation';

// Re-export for backwards compatibility
export { computeDomainForCellInEquation } from './DomainComputation';

// ============================================
// TYPES
// ============================================

/** Domain of possible values for a cell */
export interface CellDomain {
  row: number;
  col: number;
  values: Set<number>;
}

/** Result of constraint propagation */
export interface PropagationResult {
  /** Whether a unique solution exists */
  isUnique: boolean;
  /** Whether any solution exists (false if contradiction found) */
  hasSolution: boolean;
  /** Domains for each empty cell after propagation */
  domains: Map<string, CellDomain>;
  /** Cells that still have multiple possible values */
  ambiguousCells: CellDomain[];
}

// ============================================
// CONSTRAINT PROPAGATION (AC-3)
// ============================================

/**
 * Performs constraint propagation using AC-3 algorithm
 * Returns whether the puzzle has a unique solution
 */
export function propagateConstraints(
  grid: Grid,
  maxValue: number = Cell.MAX_VALUE
): PropagationResult {
  const equations = getAllEquations(grid);
  const domains = new Map<string, CellDomain>();
  
  // Initialize domains for all empty cells
  for (const equation of equations) {
    for (const cell of equation.numberCells) {
      const key = `${cell.row},${cell.col}`;
      if (domains.has(key)) continue;
      
      const gridCell = getCellAt(grid, cell.row, cell.col);
      if (!gridCell || !isNumberCell(gridCell)) continue;
      
      if (gridCell.isFixed || gridCell.value !== null) {
        // Fixed cell - domain is just its value
        domains.set(key, {
          row: cell.row,
          col: cell.col,
          values: new Set([gridCell.value!]),
        });
      } else {
        // Empty cell - start with full domain
        domains.set(key, {
          row: cell.row,
          col: cell.col,
          values: createFullDomain(maxValue),
        });
      }
    }
  }
  
  // Build cell-to-equations index
  const cellToEquations = new Map<string, Equation[]>();
  for (const equation of equations) {
    for (const cell of equation.numberCells) {
      const key = `${cell.row},${cell.col}`;
      if (!cellToEquations.has(key)) {
        cellToEquations.set(key, []);
      }
      cellToEquations.get(key)!.push(equation);
    }
  }
  
  // AC-3 worklist algorithm
  const worklist: string[] = [...domains.keys()];
  let iterations = 0;
  const maxIterations = domains.size * 100; // Safety limit
  
  while (worklist.length > 0 && iterations < maxIterations) {
    iterations++;
    const cellKey = worklist.shift()!;
    const domain = domains.get(cellKey);
    if (!domain) continue;
    
    const cellEquations = cellToEquations.get(cellKey) || [];
    let domainChanged = false;
    
    for (const equation of cellEquations) {
      // Compute constrained domain from this equation
      const constrainedDomain = computeDomainForCellInEquation(
        createEquationWithCurrentDomains(equation, domains),
        domain.row,
        domain.col,
        maxValue
      );
      
      // Intersect with current domain
      const newValues = new Set<number>();
      for (const v of domain.values) {
        if (constrainedDomain.has(v)) {
          newValues.add(v);
        }
      }
      
      if (newValues.size < domain.values.size) {
        domain.values = newValues;
        domainChanged = true;
      }
    }
    
    // If domain changed, add related cells back to worklist
    if (domainChanged) {
      for (const equation of cellEquations) {
        for (const cell of equation.numberCells) {
          const relatedKey = `${cell.row},${cell.col}`;
          if (relatedKey !== cellKey && !worklist.includes(relatedKey)) {
            worklist.push(relatedKey);
          }
        }
      }
    }
  }
  
  // Analyze results
  let hasSolution = true;
  let isUnique = true;
  const ambiguousCells: CellDomain[] = [];
  
  for (const domain of domains.values()) {
    if (domain.values.size === 0) {
      hasSolution = false;
      isUnique = false;
      break;
    }
    if (domain.values.size > 1) {
      // Check if this is an empty cell (not fixed)
      const gridCell = getCellAt(grid, domain.row, domain.col);
      if (gridCell && isNumberCell(gridCell) && !gridCell.isFixed && gridCell.value === null) {
        isUnique = false;
        ambiguousCells.push(domain);
      }
    }
  }
  
  return {
    isUnique,
    hasSolution,
    domains,
    ambiguousCells,
  };
}

/**
 * Creates an equation copy with current domain values for analysis
 */
function createEquationWithCurrentDomains(
  equation: Equation,
  domains: Map<string, CellDomain>
): Equation {
  const numberCells = equation.numberCells.map(cell => {
    const key = `${cell.row},${cell.col}`;
    const domain = domains.get(key);
    
    // If domain has exactly one value, treat it as known
    if (domain && domain.values.size === 1) {
      const value = [...domain.values][0];
      return { ...cell, value };
    }
    
    return cell;
  });
  
  return {
    ...equation,
    numberCells: numberCells as NumberCell[],
  };
}

// ============================================
// UNIQUENESS VERIFICATION
// ============================================

/**
 * Fast uniqueness check using constraint propagation
 * Falls back to limited backtracking only if needed
 */
export function hasUniqueSolutionFast(
  grid: Grid,
  maxValue: number = Cell.MAX_VALUE
): boolean {
  const result = propagateConstraints(grid, maxValue);
  
  if (!result.hasSolution) {
    return false;
  }
  
  if (result.isUnique) {
    return true;
  }
  
  // Ambiguous case - try limited backtracking on smallest domain cell
  if (result.ambiguousCells.length > 0) {
    return verifyUniquenessWithLimitedBacktracking(grid, result, maxValue);
  }
  
  return true;
}

/**
 * Async version of fast uniqueness check
 */
export async function hasUniqueSolutionFastAsync(
  grid: Grid,
  maxValue: number = Cell.MAX_VALUE
): Promise<boolean> {
  // Constraint propagation is fast enough to run synchronously
  // but we wrap it for API compatibility
  return hasUniqueSolutionFast(grid, maxValue);
}

/**
 * Limited backtracking for ambiguous cases
 * Only explores cells with small domains
 */
function verifyUniquenessWithLimitedBacktracking(
  grid: Grid,
  propagationResult: PropagationResult,
  maxValue: number
): boolean {
  // Sort by domain size - try smallest first
  const sortedCells = [...propagationResult.ambiguousCells]
    .sort((a, b) => a.values.size - b.values.size);
  
  // If smallest domain is too large, assume non-unique (conservative)
  if (sortedCells[0].values.size > 10) {
    return false;
  }
  
  // Try first few values of smallest domain
  const firstCell = sortedCells[0];
  let solutionCount = 0;
  
  for (const value of firstCell.values) {
    // Create test grid with this value
    const testGrid = setValueInGrid(grid, firstCell.row, firstCell.col, value);
    
    // Re-propagate
    const subResult = propagateConstraints(testGrid, maxValue);
    
    if (subResult.hasSolution) {
      if (subResult.isUnique) {
        solutionCount++;
      } else if (subResult.ambiguousCells.length === 0) {
        solutionCount++;
      } else {
        // Still ambiguous - conservatively count as potential solution
        solutionCount++;
      }
    }
    
    if (solutionCount > 1) {
      return false; // Not unique
    }
  }
  
  return solutionCount === 1;
}

/**
 * Sets a value in the grid (creates a copy)
 */
function setValueInGrid(grid: Grid, row: number, col: number, value: number): Grid {
  const newCells = grid.cells.map((r, rIdx) =>
    r.map((cell, cIdx) => {
      if (rIdx === row && cIdx === col && cell && isNumberCell(cell)) {
        return { ...cell, value, isFixed: true };
      }
      return cell;
    })
  );
  
  // Update equations with new value
  const newEquations = grid.equations.map(eq => ({
    ...eq,
    numberCells: eq.numberCells.map(c => {
      if (c.row === row && c.col === col) {
        return { ...c, value };
      }
      return c;
    }),
  }));
  
  return {
    ...grid,
    cells: newCells,
    equations: newEquations,
  };
}

// ============================================
// STRATEGIC CLUE ADDITION
// ============================================

/**
 * Finds the best cell to add as a clue to collapse ambiguous domains
 * Uses the solution grid for correct values
 */
export function findBestClueToAdd(
  puzzleGrid: Grid,
  solutionGrid: Grid,
  propagationResult: PropagationResult
): { row: number; col: number; value: number } | null {
  if (propagationResult.ambiguousCells.length === 0) {
    return null;
  }
  
  const equations = getAllEquations(puzzleGrid);
  const cellEquationCount = new Map<string, number>();
  
  for (const equation of equations) {
    for (const cell of equation.numberCells) {
      const key = `${cell.row},${cell.col}`;
      cellEquationCount.set(key, (cellEquationCount.get(key) || 0) + 1);
    }
  }
  
  // Score and sort cells: prefer small domains + cells in many equations
  const scoredCells = propagationResult.ambiguousCells
    .map(cell => {
      const key = `${cell.row},${cell.col}`;
      const equationCount = cellEquationCount.get(key) || 1;
      const score = equationCount * 10 - cell.values.size;
      return { cell, score };
    })
    .sort((a, b) => b.score - a.score);
  
  for (const { cell } of scoredCells) {
    // Get correct value from solution grid
    const solutionCell = getCellAt(solutionGrid, cell.row, cell.col);
    if (solutionCell && isNumberCell(solutionCell) && solutionCell.value !== null) {
      return {
        row: cell.row,
        col: cell.col,
        value: solutionCell.value,
      };
    }
  }
  
  return null;
}

/**
 * Adds strategic clues until the puzzle has a unique solution
 * Returns the modified grid and list of cells that were revealed
 */
export function addCluesUntilUnique(
  puzzleGrid: Grid,
  solutionGrid: Grid,
  maxValue: number = Cell.MAX_VALUE,
  maxClues: number = 5
): { grid: Grid; addedClues: Array<{ row: number; col: number }> } {
  let currentGrid = puzzleGrid;
  const addedClues: Array<{ row: number; col: number }> = [];
  
  for (let i = 0; i < maxClues; i++) {
    const result = propagateConstraints(currentGrid, maxValue);
    
    if (result.isUnique || result.ambiguousCells.length === 0) {
      break;
    }
    
    // Find best cell to reveal
    const bestCell = findBestClueToAdd(currentGrid, solutionGrid, result);
    
    if (!bestCell) {
      break;
    }
    
    // Reveal this cell
    currentGrid = setValueInGrid(
      currentGrid,
      bestCell.row,
      bestCell.col,
      bestCell.value
    );
    addedClues.push({ row: bestCell.row, col: bestCell.col });
  }
  
  return { grid: currentGrid, addedClues };
}
