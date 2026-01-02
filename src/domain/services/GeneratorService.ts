/**
 * GeneratorService - Crossword-style puzzle generation
 * 
 * Strategy:
 * 1. Generate valid equations (2-3 numbers each, results always positive)
 * 2. Place equations in crossword layout with intersections
 * 3. Remove clues to create the puzzle
 * 
 * Pure functions with no side effects
 */

import type { Grid, GridSize, Difficulty, Puzzle, RandomGenerator, Operator } from '@domain/types';
import { isNumberCell, createNumberCell, createOperatorCell, createEqualsCell, createResultCell } from '@domain/entities/Cell';
import { cloneGrid } from '@domain/entities/Grid';
import { parseHash } from '@domain/entities/GameHash';
import {
  createEmptyGrid,
  placeHorizontalEquation,
  placeVerticalEquation,
  canPlaceVerticalEquation,
  markCellsAsEditable,
  getAllNumberCells,
  getCellAt,
  setCellAt,
} from './GridService';
import { applyOperator } from './EquationService';
import { hasUniqueSolution, isValidSolution } from './SolverService';
import {
  getNumberRange,
  getOperatorsForDifficulty,
  getRemovalPercentage,
  getMinRemovalsPerEquation,
  getTargetEquationCount,
  getGridDimensions,
  pickEquationSize,
  getSharedResultProbability,
  type NumberRange,
} from './DifficultySettings';

// ============================================
// CONSTANTS
// ============================================

/** Maximum attempts for generation */
const MAX_GENERATION_ATTEMPTS = 20;

// ============================================
// EQUATION GENERATION
// ============================================

/**
 * Generates a valid equation with 2 numbers (A op B = R)
 * Ensures result is positive and within range
 */
function generate2NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: { min: number; max: number; maxResult: number } = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operator: Operator; result: number } | null {
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    const operator = rng.pick(operators);
    
    const result = applyOperator(a, operator, b);
    
    // Result must be positive and within range
    if (result !== null && result > 0 && result <= numRange.maxResult) {
      return { numbers: [a, b], operator, result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with 3 numbers (A op B op C = R)
 * Ensures intermediate and final results are positive
 */
function generate3NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operators: Operator[]; result: number } | null {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    const c = rng.int(numRange.min, numRange.max);
    const op1 = rng.pick(operators);
    const op2 = rng.pick(operators);
    
    // Evaluate left to right
    const intermediate = applyOperator(a, op1, b);
    if (intermediate === null || intermediate < 0) continue;
    
    const result = applyOperator(intermediate, op2, c);
    
    // Result must be positive and within range
    if (result !== null && result > 0 && result <= numRange.maxResult) {
      return { numbers: [a, b, c], operators: [op1, op2], result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with 4 numbers (A op B op C op D = R)
 * Ensures all intermediate and final results are positive
 */
function generate4NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operators: Operator[]; result: number } | null {
  const maxAttempts = 150;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    const c = rng.int(numRange.min, numRange.max);
    const d = rng.int(numRange.min, numRange.max);
    const op1 = rng.pick(operators);
    const op2 = rng.pick(operators);
    const op3 = rng.pick(operators);
    
    // Evaluate left to right
    const inter1 = applyOperator(a, op1, b);
    if (inter1 === null || inter1 < 0) continue;
    
    const inter2 = applyOperator(inter1, op2, c);
    if (inter2 === null || inter2 < 0) continue;
    
    const result = applyOperator(inter2, op3, d);
    
    // Result must be positive and within range
    if (result !== null && result > 0 && result <= numRange.maxResult) {
      return { numbers: [a, b, c, d], operators: [op1, op2, op3], result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with a fixed first number (for intersections)
 * Supports 2, 3, or 4 number equations based on size parameter
 */
function generateEquationWithFirst(
  firstNumber: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operators: Operator[]; result: number } | null {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (equationSize === 2) {
      const b = rng.int(numRange.min, numRange.max);
      const op = rng.pick(operators);
      const result = applyOperator(firstNumber, op, b);
      
      if (result !== null && result > 0 && result <= numRange.maxResult) {
        return { numbers: [firstNumber, b], operators: [op], result };
      }
    } else if (equationSize === 3) {
      const b = rng.int(numRange.min, numRange.max);
      const c = rng.int(numRange.min, numRange.max);
      const op1 = rng.pick(operators);
      const op2 = rng.pick(operators);
      
      const inter = applyOperator(firstNumber, op1, b);
      if (inter === null || inter < 0) continue;
      
      const result = applyOperator(inter, op2, c);
      if (result !== null && result > 0 && result <= numRange.maxResult) {
        return { numbers: [firstNumber, b, c], operators: [op1, op2], result };
      }
    } else {
      // 4 numbers
      const b = rng.int(numRange.min, numRange.max);
      const c = rng.int(numRange.min, numRange.max);
      const d = rng.int(numRange.min, numRange.max);
      const op1 = rng.pick(operators);
      const op2 = rng.pick(operators);
      const op3 = rng.pick(operators);
      
      const inter1 = applyOperator(firstNumber, op1, b);
      if (inter1 === null || inter1 < 0) continue;
      
      const inter2 = applyOperator(inter1, op2, c);
      if (inter2 === null || inter2 < 0) continue;
      
      const result = applyOperator(inter2, op3, d);
      if (result !== null && result > 0 && result <= numRange.maxResult) {
        return { numbers: [firstNumber, b, c, d], operators: [op1, op2, op3], result };
      }
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with a fixed value at a specific position (for using result cells as inputs)
 * @param fixedValue The value that must appear at the specified position
 * @param position The 0-indexed position where the fixed value must appear (0 = first, 1 = second, etc.)
 * @param equationSize The number of numbers in the equation (2, 3, or 4)
 */
function generateEquationWithValueAt(
  fixedValue: number,
  position: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operators: Operator[]; result: number } | null {
  if (position >= equationSize) return null;
  
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random numbers for all positions except the fixed one
    const numbers: number[] = [];
    for (let i = 0; i < equationSize; i++) {
      if (i === position) {
        numbers.push(fixedValue);
      } else {
        numbers.push(rng.int(numRange.min, numRange.max));
      }
    }
    
    // Generate random operators
    const ops: Operator[] = [];
    for (let i = 0; i < equationSize - 1; i++) {
      ops.push(rng.pick(operators));
    }
    
    // Calculate result (left to right evaluation)
    let result: number | null = numbers[0];
    for (let i = 0; i < ops.length; i++) {
      result = applyOperator(result!, ops[i], numbers[i + 1]);
      if (result === null || result < 0) break;
    }
    
    if (result !== null && result > 0 && result <= numRange.maxResult && Number.isInteger(result)) {
      return { numbers, operators: ops, result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation that evaluates to a specific target result (for shared result cells)
 * Supports 2, 3, or 4 number equations based on size parameter
 */
function generateEquationWithResult(
  targetResult: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operators: Operator[]; result: number } | null {
  const maxAttempts = 200; // More attempts since we're targeting a specific result
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (equationSize === 2) {
      // A op B = targetResult
      const a = rng.int(numRange.min, numRange.max);
      const op = rng.pick(operators);
      
      // Solve for B: what value of B gives us targetResult?
      let b: number | null = null;
      if (op === '+') {
        b = targetResult - a;
      } else if (op === '-') {
        b = a - targetResult;
      } else if (op === '×') {
        if (a !== 0 && targetResult % a === 0) {
          b = targetResult / a;
        }
      } else if (op === '÷') {
        // a / b = targetResult => b = a / targetResult
        if (targetResult !== 0 && a % targetResult === 0) {
          b = a / targetResult;
        }
      }
      
      if (b !== null && Number.isInteger(b) && b >= numRange.min && b <= numRange.max && b > 0) {
        const check = applyOperator(a, op, b);
        if (check === targetResult) {
          return { numbers: [a, b], operators: [op], result: targetResult };
        }
      }
    } else if (equationSize === 3) {
      // A op1 B op2 C = targetResult
      const a = rng.int(numRange.min, numRange.max);
      const b = rng.int(numRange.min, numRange.max);
      const op1 = rng.pick(operators);
      const op2 = rng.pick(operators);
      
      const inter = applyOperator(a, op1, b);
      if (inter === null || inter < 0) continue;
      
      // Solve for C
      let c: number | null = null;
      if (op2 === '+') {
        c = targetResult - inter;
      } else if (op2 === '-') {
        c = inter - targetResult;
      } else if (op2 === '×') {
        if (inter !== 0 && targetResult % inter === 0) {
          c = targetResult / inter;
        }
      } else if (op2 === '÷') {
        if (targetResult !== 0 && inter % targetResult === 0) {
          c = inter / targetResult;
        }
      }
      
      if (c !== null && Number.isInteger(c) && c >= numRange.min && c <= numRange.max && c > 0) {
        const check = applyOperator(inter, op2, c);
        if (check === targetResult) {
          return { numbers: [a, b, c], operators: [op1, op2], result: targetResult };
        }
      }
    } else {
      // 4 numbers: A op1 B op2 C op3 D = targetResult
      const a = rng.int(numRange.min, numRange.max);
      const b = rng.int(numRange.min, numRange.max);
      const c = rng.int(numRange.min, numRange.max);
      const op1 = rng.pick(operators);
      const op2 = rng.pick(operators);
      const op3 = rng.pick(operators);
      
      const inter1 = applyOperator(a, op1, b);
      if (inter1 === null || inter1 < 0) continue;
      
      const inter2 = applyOperator(inter1, op2, c);
      if (inter2 === null || inter2 < 0) continue;
      
      // Solve for D
      let d: number | null = null;
      if (op3 === '+') {
        d = targetResult - inter2;
      } else if (op3 === '-') {
        d = inter2 - targetResult;
      } else if (op3 === '×') {
        if (inter2 !== 0 && targetResult % inter2 === 0) {
          d = targetResult / inter2;
        }
      } else if (op3 === '÷') {
        if (targetResult !== 0 && inter2 % targetResult === 0) {
          d = inter2 / targetResult;
        }
      }
      
      if (d !== null && Number.isInteger(d) && d >= numRange.min && d <= numRange.max && d > 0) {
        const check = applyOperator(inter2, op3, d);
        if (check === targetResult) {
          return { numbers: [a, b, c, d], operators: [op1, op2, op3], result: targetResult };
        }
      }
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with a fixed first number (for intersections)
 * @deprecated Use generateEquationWithFirst instead
 */
function generate2NumberEquationWithFirst(
  firstNumber: number,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: { min: number; max: number; maxResult: number } = { min: 1, max: 9, maxResult: 99 }
): { numbers: number[]; operator: Operator; result: number } | null {
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const b = rng.int(numRange.min, numRange.max);
    const operator = rng.pick(operators);
    
    const result = applyOperator(firstNumber, operator, b);
    
    if (result !== null && result > 0 && result <= numRange.maxResult) {
      return { numbers: [firstNumber, b], operator, result };
    }
  }
  
  return null;
}

// ============================================
// CROSSWORD LAYOUT
// ============================================

/**
 * Generates a crossword-style grid layout
 * ALL equations are guaranteed to be connected to each other.
 * Strategy:
 * 1. Place first horizontal equation
 * 2. Place vertical equations from horizontal number cells
 * 3. Place additional horizontals ONLY at vertical result/number positions
 * 4. Continue growing the connected structure
 */
function generateCrosswordLayout(
  size: GridSize,
  difficulty: Difficulty,
  rng: RandomGenerator
): Grid | null {
  const operators = getOperatorsForDifficulty(difficulty);
  const numRange = getNumberRange(difficulty, size);
  const targetEquations = getTargetEquationCount(size, difficulty);
  const { width, height } = getGridDimensions(size);
  const sharedResultProb = getSharedResultProbability(difficulty);
  
  let grid = createEmptyGrid(size, width, height);
  
  // Track all intersection points available for new equations
  type IntersectionPoint = {
    row: number;
    col: number;
    value: number;
    canPlaceVertical: boolean;
    canPlaceHorizontal: boolean;
    used: boolean;
    isResultCell?: boolean; // Marks this as a result position for potential shared results
  };
  
  // Track result cell positions separately for shared result placement
  type ResultCellPosition = {
    row: number;
    col: number;
    value: number;
    used: boolean;
  };
  const resultCells: ResultCellPosition[] = [];
  
  const intersectionPoints: IntersectionPoint[] = [];
  let equationId = 0;
  
  // Helper: Calculate vertical equation height (how many rows it spans)
  const getVerticalEquationHeight = (numNumbers: number) => numNumbers * 2; // numbers + operators + equals + result
  
  // Helper: Check if we can place a vertical equation ending at a specific result position
  const canPlaceVerticalEndingAt = (resultRow: number, col: number, numNumbers: number): boolean => {
    const startRow = resultRow - getVerticalEquationHeight(numNumbers);
    if (startRow < 0) return false;
    
    // Check all positions except the result cell (which already exists)
    for (let i = 0; i < numNumbers; i++) {
      const numRow = startRow + i * 2;
      const existing = getCellAt(grid, numRow, col);
      if (existing !== null) return false;
      
      // Check operator position (except after last number)
      if (i < numNumbers - 1) {
        const opRow = startRow + i * 2 + 1;
        const opExisting = getCellAt(grid, opRow, col);
        if (opExisting !== null) return false;
      }
    }
    
    // Check equals position
    const equalsRow = resultRow - 1;
    const equalsExisting = getCellAt(grid, equalsRow, col);
    if (equalsExisting !== null) return false;
    
    return true;
  };
  
  // Step 1: Place first horizontal equation
  {
    const eqSize = pickEquationSize(difficulty, rng.random());
    let eq: { numbers: number[]; operators: Operator[]; result: number } | null = null;
    
    if (eqSize === 2) {
      const gen = generate2NumberEquation(operators, rng, numRange);
      if (gen) eq = { numbers: gen.numbers, operators: [gen.operator], result: gen.result };
    } else if (eqSize === 3) {
      eq = generate3NumberEquation(operators, rng, numRange);
    } else {
      eq = generate4NumberEquation(operators, rng, numRange);
    }
    
    if (!eq) return null;
    
    grid = placeHorizontalEquation(
      grid,
      equationId++,
      0,
      0,
      eq.numbers,
      eq.operators,
      eq.result
    );
    
    // Add intersection points for vertical equations (at each number position)
    for (let i = 0; i < eq.numbers.length; i++) {
      const col = i * 2; // Numbers at columns 0, 2, 4, 6...
      intersectionPoints.push({
        row: 0, col, value: eq.numbers[i],
        canPlaceVertical: true, canPlaceHorizontal: false, used: false
      });
    }
    
    // Track result position - it can START a vertical equation (result becomes input)
    const resultCol = eq.numbers.length * 2;
    resultCells.push({
      row: 0, col: resultCol, value: eq.result, used: false
    });
    // Add result as intersection point - vertical can START here (going down)
    intersectionPoints.push({
      row: 0, col: resultCol, value: eq.result,
      canPlaceVertical: true, canPlaceHorizontal: false, used: false,
      isResultCell: true // Mark as result so the number is already revealed
    });
  }
  
  // Step 2: Iteratively add connected equations
  let attempts = 0;
  const maxAttempts = 100; // More attempts for larger grids
  
  while (grid.equations.length < targetEquations && attempts < maxAttempts) {
    attempts++;
    
    // Occasionally try to place a shared result equation
    // Try on every iteration at hard difficulty to maximize chances
    if (sharedResultProb > 0 && resultCells.length > 0) {
      const availableResultCells = resultCells.filter(r => !r.used);
      
      // Debug: Log shared result candidates
      if (attempts === 1 && typeof window !== 'undefined') {
        console.log(`📊 Shared Result Debug:`, {
          sharedResultProb,
          totalResultCells: resultCells.length,
          availableResultCells: availableResultCells.length,
          resultCellDetails: resultCells.map(r => ({ row: r.row, col: r.col, value: r.value, used: r.used }))
        });
      }
      
      if (availableResultCells.length > 0 && rng.random() < sharedResultProb) {
        rng.shuffle(availableResultCells);
        
        for (const resultCell of availableResultCells) {
          const eqSize = pickEquationSize(difficulty, rng.random());
          const vertHeight = eqSize * 2; // Total height of vertical equation
          const startRow = resultCell.row - vertHeight;
          
          // Debug: Log placement check
          if (typeof window !== 'undefined') {
            const canPlace = startRow >= 0 && canPlaceVerticalEndingAt(resultCell.row, resultCell.col, eqSize);
            console.log(`🔍 Checking result cell (${resultCell.row},${resultCell.col})=${resultCell.value}: startRow=${startRow}, eqSize=${eqSize}, canPlace=${canPlace}`);
          }
          
          // Check if we can place a vertical equation ending at the result cell
          if (startRow >= 0 && canPlaceVerticalEndingAt(resultCell.row, resultCell.col, eqSize)) {
            const vertEq = generateEquationWithResult(resultCell.value, eqSize, operators, rng, numRange);
            if (vertEq) {
              // Place numbers and operators (not the result - it already exists)
              for (let i = 0; i < vertEq.numbers.length; i++) {
                const numRow = startRow + i * 2;
                const numCell = createNumberCell(numRow, resultCell.col, vertEq.numbers[i], true);
                grid = setCellAt(grid, numRow, resultCell.col, numCell);
                
                // Add operator after each number except the last
                if (i < vertEq.operators.length) {
                  const opRow = startRow + i * 2 + 1;
                  const opCell = createOperatorCell(opRow, resultCell.col, vertEq.operators[i]);
                  grid = setCellAt(grid, opRow, resultCell.col, opCell);
                }
              }
              
              // Place equals sign
              const equalsRow = resultCell.row - 1;
              const equalsCell = createEqualsCell(equalsRow, resultCell.col);
              grid = setCellAt(grid, equalsRow, resultCell.col, equalsCell);
              
              // The result cell already exists - just register the equation
              const existingResultCell = getCellAt(grid, resultCell.row, resultCell.col);
              
              // Create equation entry
              const numberCells = vertEq.numbers.map((val, i) => 
                createNumberCell(startRow + i * 2, resultCell.col, val, true)
              );
              const operatorCells = vertEq.operators.map((op, i) => 
                createOperatorCell(startRow + i * 2 + 1, resultCell.col, op)
              );
              
              const equation = {
                id: equationId++,
                direction: 'vertical' as const,
                numberCells,
                operatorCells,
                resultCell: existingResultCell as import('@domain/types').ResultCell,
                startRow,
                startCol: resultCell.col,
              };
              
              grid = { ...grid, equations: [...grid.equations, equation] };
              resultCell.used = true;
              
              // Log shared result placement for debugging
              if (typeof window !== 'undefined') {
                console.log(`🎯 SHARED RESULT placed at (${resultCell.row}, ${resultCell.col}) = ${resultCell.value}`);
              }
              
              // Add intersection points for the number cells
              for (let i = 0; i < vertEq.numbers.length; i++) {
                const numRow = startRow + i * 2;
                intersectionPoints.push({
                  row: numRow, col: resultCell.col, value: vertEq.numbers[i],
                  canPlaceVertical: false, canPlaceHorizontal: true, used: false
                });
              }
              
              break; // Successfully placed a shared result equation
            }
          }
        }
      }
    }
    
    // Try to place an equation using a result cell as input at ANY position (not just first)
    // This allows equations like: A + [RESULT] + B = C where [RESULT] is a revealed answer
    if (sharedResultProb > 0 && resultCells.length > 0 && rng.random() < sharedResultProb) {
      const availableResultCells = resultCells.filter(r => !r.used);
      rng.shuffle(availableResultCells);
      
      for (const resultCell of availableResultCells) {
        const eqSize = pickEquationSize(difficulty, rng.random()) as 2 | 3 | 4;
        
        // Try each possible position for the result value (0, 1, 2, or 3 depending on size)
        const positions = Array.from({ length: eqSize }, (_, i) => i);
        rng.shuffle(positions);
        
        let placedResultAsInput = false;
        
        for (const position of positions) {
          if (position === 0) {
            // Position 0 is already handled by intersection points - skip to avoid duplicates
            continue;
          }
          
          // Try placing a VERTICAL equation where result cell is at position `position`
          // The result cell is at (resultCell.row, resultCell.col)
          // If result is at position `position`, the equation starts at row: resultCell.row - position * 2
          const vertStartRow = resultCell.row - position * 2;
          const vertEndRow = vertStartRow + eqSize * 2; // result row
          
          if (vertStartRow >= 0 && vertEndRow < height) {
            // Check if we can place this vertical (except at the result cell position)
            let canPlace = true;
            for (let i = 0; i < eqSize; i++) {
              if (i === position) continue; // This is the result cell - already exists
              const numRow = vertStartRow + i * 2;
              if (getCellAt(grid, numRow, resultCell.col) !== null) {
                canPlace = false;
                break;
              }
            }
            // Check operator positions
            if (canPlace) {
              for (let i = 0; i < eqSize - 1; i++) {
                const opRow = vertStartRow + i * 2 + 1;
                if (getCellAt(grid, opRow, resultCell.col) !== null) {
                  canPlace = false;
                  break;
                }
              }
            }
            // Check equals and result positions
            if (canPlace) {
              const equalsRow = vertStartRow + eqSize * 2 - 1;
              const resultRow = vertStartRow + eqSize * 2;
              if (getCellAt(grid, equalsRow, resultCell.col) !== null ||
                  getCellAt(grid, resultRow, resultCell.col) !== null) {
                canPlace = false;
              }
            }
            
            if (canPlace) {
              const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange);
              if (eq) {
                // Place the equation cells
                for (let i = 0; i < eq.numbers.length; i++) {
                  const numRow = vertStartRow + i * 2;
                  if (i === position) {
                    // This is the result cell - convert to a fixed number cell (revealed, non-editable)
                    const sharedCell = createNumberCell(numRow, resultCell.col, eq.numbers[i], true);
                    grid = setCellAt(grid, numRow, resultCell.col, sharedCell);
                  } else {
                    const numCell = createNumberCell(numRow, resultCell.col, eq.numbers[i], true);
                    grid = setCellAt(grid, numRow, resultCell.col, numCell);
                  }
                  
                  if (i < eq.operators.length) {
                    const opRow = vertStartRow + i * 2 + 1;
                    const opCell = createOperatorCell(opRow, resultCell.col, eq.operators[i]);
                    grid = setCellAt(grid, opRow, resultCell.col, opCell);
                  }
                }
                
                // Place equals and result
                const equalsRow = vertStartRow + eqSize * 2 - 1;
                const equalsCell = createEqualsCell(equalsRow, resultCell.col);
                grid = setCellAt(grid, equalsRow, resultCell.col, equalsCell);
                
                const resultRow = vertStartRow + eqSize * 2;
                const resultCellNew = createResultCell(resultRow, resultCell.col, eq.result);
                grid = setCellAt(grid, resultRow, resultCell.col, resultCellNew);
                
                // Create equation entry
                const numberCells = eq.numbers.map((val, i) => 
                  createNumberCell(vertStartRow + i * 2, resultCell.col, val, i !== position)
                );
                const operatorCells = eq.operators.map((op, i) => 
                  createOperatorCell(vertStartRow + i * 2 + 1, resultCell.col, op)
                );
                
                const equation = {
                  id: equationId++,
                  direction: 'vertical' as const,
                  numberCells,
                  operatorCells,
                  resultCell: resultCellNew,
                  startRow: vertStartRow,
                  startCol: resultCell.col,
                };
                
                grid = { ...grid, equations: [...grid.equations, equation] };
                resultCell.used = true;
                
                if (typeof window !== 'undefined') {
                  console.log(`🔗 Result as middle input: (${resultCell.row},${resultCell.col})=${resultCell.value} at position ${position}`);
                }
                
                // Add intersection points
                for (let i = 0; i < eq.numbers.length; i++) {
                  if (i !== position) {
                    const numRow = vertStartRow + i * 2;
                    intersectionPoints.push({
                      row: numRow, col: resultCell.col, value: eq.numbers[i],
                      canPlaceVertical: false, canPlaceHorizontal: true, used: false
                    });
                  }
                }
                
                // Track new result
                const newResultRow = vertStartRow + eqSize * 2;
                resultCells.push({
                  row: newResultRow, col: resultCell.col, value: eq.result, used: false
                });
                
                placedResultAsInput = true;
                break;
              }
            }
          }
          
          // Try placing a HORIZONTAL equation where result cell is at position `position`
          const horizStartCol = resultCell.col - position * 2;
          const horizEndCol = horizStartCol + eqSize * 2; // result column
          
          if (horizStartCol >= 0 && horizEndCol < width) {
            // Check if we can place this horizontal (except at the result cell position)
            let canPlace = true;
            for (let i = 0; i < eqSize; i++) {
              if (i === position) continue;
              const numCol = horizStartCol + i * 2;
              if (getCellAt(grid, resultCell.row, numCol) !== null) {
                canPlace = false;
                break;
              }
            }
            if (canPlace) {
              for (let i = 0; i < eqSize - 1; i++) {
                const opCol = horizStartCol + i * 2 + 1;
                if (getCellAt(grid, resultCell.row, opCol) !== null) {
                  canPlace = false;
                  break;
                }
              }
            }
            if (canPlace) {
              const equalsCol = horizStartCol + eqSize * 2 - 1;
              const resultCol = horizStartCol + eqSize * 2;
              if (getCellAt(grid, resultCell.row, equalsCol) !== null ||
                  getCellAt(grid, resultCell.row, resultCol) !== null) {
                canPlace = false;
              }
            }
            
            if (canPlace) {
              const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange);
              if (eq) {
                // Place the equation cells
                for (let i = 0; i < eq.numbers.length; i++) {
                  const numCol = horizStartCol + i * 2;
                  if (i === position) {
                    // This is the result cell - convert to a fixed number cell (revealed, non-editable)
                    const sharedCell = createNumberCell(resultCell.row, numCol, eq.numbers[i], true);
                    grid = setCellAt(grid, resultCell.row, numCol, sharedCell);
                  } else {
                    const numCell = createNumberCell(resultCell.row, numCol, eq.numbers[i], true);
                    grid = setCellAt(grid, resultCell.row, numCol, numCell);
                  }
                  
                  if (i < eq.operators.length) {
                    const opCol = horizStartCol + i * 2 + 1;
                    const opCell = createOperatorCell(resultCell.row, opCol, eq.operators[i]);
                    grid = setCellAt(grid, resultCell.row, opCol, opCell);
                  }
                }
                
                const equalsCol = horizStartCol + eqSize * 2 - 1;
                const equalsCell = createEqualsCell(resultCell.row, equalsCol);
                grid = setCellAt(grid, resultCell.row, equalsCol, equalsCell);
                
                const resultCol = horizStartCol + eqSize * 2;
                const resultCellNew = createResultCell(resultCell.row, resultCol, eq.result);
                grid = setCellAt(grid, resultCell.row, resultCol, resultCellNew);
                
                const numberCells = eq.numbers.map((val, i) => 
                  createNumberCell(resultCell.row, horizStartCol + i * 2, val, i !== position)
                );
                const operatorCells = eq.operators.map((op, i) => 
                  createOperatorCell(resultCell.row, horizStartCol + i * 2 + 1, op)
                );
                
                const equation = {
                  id: equationId++,
                  direction: 'horizontal' as const,
                  numberCells,
                  operatorCells,
                  resultCell: resultCellNew,
                  startRow: resultCell.row,
                  startCol: horizStartCol,
                };
                
                grid = { ...grid, equations: [...grid.equations, equation] };
                resultCell.used = true;
                
                if (typeof window !== 'undefined') {
                  console.log(`🔗 Result as middle input (horiz): (${resultCell.row},${resultCell.col})=${resultCell.value} at position ${position}`);
                }
                
                for (let i = 0; i < eq.numbers.length; i++) {
                  if (i !== position) {
                    const numCol = horizStartCol + i * 2;
                    intersectionPoints.push({
                      row: resultCell.row, col: numCol, value: eq.numbers[i],
                      canPlaceVertical: true, canPlaceHorizontal: false, used: false
                    });
                  }
                }
                
                const newResultCol = horizStartCol + eqSize * 2;
                resultCells.push({
                  row: resultCell.row, col: newResultCol, value: eq.result, used: false
                });
                
                placedResultAsInput = true;
                break;
              }
            }
          }
        }
        
        if (placedResultAsInput) break;
      }
    }
    
    // Shuffle intersection points to add variety
    const availablePoints = intersectionPoints.filter(p => !p.used);
    rng.shuffle(availablePoints);
    
    let placed = false;
    
    for (const point of availablePoints) {
      // Try to place a vertical equation from this point
      if (point.canPlaceVertical && !point.isResultCell) {
        const eqSize = pickEquationSize(difficulty, rng.random());
        
        // Normal vertical placement (with first number as intersection)
        if (canPlaceVerticalEquation(grid, point.row, point.col, eqSize, eqSize - 1)) {
          const vertEq = generateEquationWithFirst(point.value, eqSize, operators, rng, numRange);
          if (vertEq) {
            grid = placeVerticalEquation(
              grid,
              equationId++,
              point.row,
              point.col,
              vertEq.numbers,
              vertEq.operators,
              vertEq.result
            );
            
            point.used = true;
            
            // The vertical equation creates new intersection points:
            // - At each subsequent number cell (row + 2, row + 4, etc.)
            // - At the result (last position) - can start a horizontal here
            for (let i = 1; i < vertEq.numbers.length; i++) {
              const numRow = point.row + i * 2;
              intersectionPoints.push({
                row: numRow, col: point.col, value: vertEq.numbers[i],
                canPlaceVertical: false, canPlaceHorizontal: true, used: false
              });
            }
            // Result position - track for potential shared results
            const resultRow = point.row + vertEq.numbers.length * 2;
            resultCells.push({
              row: resultRow, col: point.col, value: vertEq.result, used: false
            });
            // Also allow horizontal equations to start from result (result becomes input)
            intersectionPoints.push({
              row: resultRow, col: point.col, value: vertEq.result,
              canPlaceVertical: false, canPlaceHorizontal: true, used: false,
              isResultCell: true // Mark as result so the number is already revealed
            });
            
            placed = true;
            break;
          }
        }
      }
      
      // Try to place a horizontal equation from this point
      if (point.canPlaceHorizontal) {
        const eqSize = pickEquationSize(difficulty, rng.random());
        const requiredWidth = eqSize * 2 + 1; // e.g., 2-number: 5 cells, 3-number: 7 cells
        
        // Check if we can place a horizontal starting here
        let hasConflict = false;
        for (let c = point.col + 1; c < point.col + requiredWidth; c++) {
          const existing = getCellAt(grid, point.row, c);
          if (existing !== null) {
            hasConflict = true;
            break;
          }
        }
        
        if (!hasConflict) {
          const horizEq = generateEquationWithFirst(point.value, eqSize, operators, rng, numRange);
          if (horizEq) {
            // Convert result cell to number cell if needed (for sharing)
            const existingCell = getCellAt(grid, point.row, point.col);
            if (existingCell && existingCell.type === 'result') {
              const sharedCell = createNumberCell(point.row, point.col, point.value, true);
              grid = setCellAt(grid, point.row, point.col, sharedCell);
            }
            
            grid = placeHorizontalEquation(
              grid,
              equationId++,
              point.row,
              point.col,
              horizEq.numbers,
              horizEq.operators,
              horizEq.result
            );
            
            point.used = true;
            
            // The horizontal equation creates new intersection points for verticals
            // At each subsequent number position
            for (let i = 1; i < horizEq.numbers.length; i++) {
              const numCol = point.col + i * 2;
              intersectionPoints.push({
                row: point.row, col: numCol, value: horizEq.numbers[i],
                canPlaceVertical: true, canPlaceHorizontal: false, used: false
              });
            }
            
            // Track result position - it can START a vertical equation (result becomes input)
            const resultCol = point.col + horizEq.numbers.length * 2;
            resultCells.push({
              row: point.row, col: resultCol, value: horizEq.result, used: false
            });
            // Add result as intersection point - vertical can START here (going down)
            intersectionPoints.push({
              row: point.row, col: resultCol, value: horizEq.result,
              canPlaceVertical: true, canPlaceHorizontal: false, used: false,
              isResultCell: true // Mark as result so the number is already revealed
            });
            
            placed = true;
            break;
          }
        }
      }
    }
    
    // If we couldn't place any equation, we're stuck
    if (!placed && availablePoints.length > 0) {
      // Mark remaining points as used to avoid infinite loop
      for (const p of availablePoints) {
        p.used = true;
      }
    }
  }
  
  // Verify we have at least 2 equations
  if (grid.equations.length < 2) {
    return null;
  }
  
  return grid;
}

// ============================================
// CLUE REMOVAL
// ============================================

/**
 * Removes clues from a completed grid to create a puzzle
 * Ensures the puzzle still has exactly one solution after each removal
 * Guarantees EACH EQUATION has minimum missing numbers based on difficulty
 */
function removeClues(
  completedGrid: Grid,
  difficulty: Difficulty,
  rng: RandomGenerator
): Grid {
  let puzzleGrid = cloneGrid(completedGrid);
  const minPerEquation = getMinRemovalsPerEquation(difficulty);
  
  // Step 1: Ensure each equation has minimum missing cells based on difficulty
  for (const equation of puzzleGrid.equations) {
    const eqNumberCells = equation.numberCells;
    if (eqNumberCells.length === 0) continue;
    
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
        puzzleGrid = markCellsAsEditable(puzzleGrid, [{ row: cellToRemove.row, col: cellToRemove.col }]);
        removedFromEq++;
      }
    }
  }
  
  // Step 2: Remove additional clues based on difficulty percentage
  const numberCells = getAllNumberCells(puzzleGrid).filter(c => c.isFixed);
  const positions = numberCells.map(c => ({ row: c.row, col: c.col }));
  rng.shuffle(positions);
  
  const allNumberCells = getAllNumberCells(completedGrid);
  const targetTotal = Math.floor(allNumberCells.length * getRemovalPercentage(difficulty));
  const alreadyRemoved = allNumberCells.length - numberCells.length;
  const additionalRemovals = Math.max(0, targetTotal - alreadyRemoved);
  
  let removed = 0;
  
  for (const { row, col } of positions) {
    if (removed >= additionalRemovals) break;
    
    const cell = getCellAt(puzzleGrid, row, col);
    if (!cell || !isNumberCell(cell) || !cell.isFixed) continue;
    
    const testGrid = markCellsAsEditable(puzzleGrid, [{ row, col }]);
    
    if (hasUniqueSolution(testGrid)) {
      puzzleGrid = testGrid;
      removed++;
    }
  }
  
  return puzzleGrid;
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Main puzzle generation function
 * Takes a hash and returns a puzzle with its solution
 */
export function generatePuzzle(
  hash: string,
  rng: RandomGenerator
): Puzzle | null {
  const parsed = parseHash(hash);
  const { size, difficulty } = parsed;
  
  // Try to generate a valid crossword layout (with retries)
  let completedGrid: Grid | null = null;
  let attempts = 0;
  
  while (!completedGrid && attempts < MAX_GENERATION_ATTEMPTS) {
    const candidateGrid = generateCrosswordLayout(size, difficulty, rng);
    if (candidateGrid) {
      // Verify the generated grid is a valid solution
      if (isValidSolution(candidateGrid)) {
        completedGrid = candidateGrid;
        console.log('Generated valid grid on attempt', attempts + 1);
      } else {
        console.warn('Generated grid failed validation on attempt', attempts + 1);
        // Debug: log the equations
        for (const eq of candidateGrid.equations) {
          const nums = eq.numberCells.map(c => c.value).join(', ');
          const ops = eq.operatorCells.map(c => c.value).join(', ');
          console.warn(`  Equation ${eq.id} (${eq.direction}): [${nums}] ops [${ops}] = ${eq.resultCell.value}`);
        }
      }
    } else {
      console.warn('generateCrosswordLayout returned null on attempt', attempts + 1);
    }
    attempts++;
  }
  
  if (!completedGrid) {
    console.error('Failed to generate valid grid after', MAX_GENERATION_ATTEMPTS, 'attempts');
    return null;
  }
  
  // Store the solution
  const solution = cloneGrid(completedGrid);
  
  // Remove clues to create the puzzle
  const puzzleGrid = removeClues(completedGrid, difficulty, rng);
  
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
export function validatePuzzle(puzzle: Puzzle): boolean {
  return hasUniqueSolution(puzzle.grid);
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

// Export for testing
export {
  generate2NumberEquation,
  generate3NumberEquation,
  generate2NumberEquationWithFirst,
  generateCrosswordLayout,
  removeClues,
};
