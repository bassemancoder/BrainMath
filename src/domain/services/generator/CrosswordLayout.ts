/**
 * CrosswordLayout - Grid layout generation for crossword-style puzzles
 * 
 * Strategy:
 * 1. Start from the CENTER of the grid
 * 2. Expand in all 4 directions (up, down, left, right)
 * 3. Balance expansion across quadrants for symmetry
 * 4. All equations are guaranteed to be connected to each other
 */

import type { Grid, GridSize, Difficulty, RandomGenerator, Operator } from '@domain/types';
import { createNumberCell, createOperatorCell, createEqualsCell, createResultCell } from '@domain/entities/Cell';
import {
  createEmptyGrid,
  placeHorizontalEquation,
  placeHorizontalEquationLeft,
  getCellAt,
  setCellAt,
} from '../GridService';
import {
  getNumberRange,
  getOperatorsForDifficulty,
  getTargetEquationCount,
  getGridDimensions,
  pickEquationSize,
  getSharedResultProbability,
  getMinMultiplyDivideRatio,
  getDivisionConstraints,
} from '../DifficultySettings';
import { Generation } from '@domain/constants';
import type { Quadrant, IntersectionPoint, ResultCellPosition } from './GeneratorTypes';
import {
  generate2NumberEquation,
  generate3NumberEquation,
  generate4NumberEquation,
  generateEquationWithValueAt,
  generateEquationWithResult,
  hasMultiplyOrDivide,
} from './EquationGenerators';

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Yields to browser to prevent blocking */
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates a canonical signature for an equation to detect duplicates.
 * For 2-number equations, we use a "number set" approach that captures
 * all three numbers (two operands + result) sorted, which catches:
 * - Commutative duplicates: 2×7=14 and 7×2=14
 * - Related division/subtraction: 24÷2=12 and 24÷12=2 (both use {2,12,24})
 * - Related subtraction: 26-14=12 and 26-12=14 (both use {12,14,26})
 */
function getEquationSignature(numbers: number[], operators: Operator[], result: number): string {
  if (numbers.length === 2 && operators.length === 1) {
    // For 2-number equations, create a signature from all three numbers sorted
    // This catches both commutative duplicates AND related inverse operations
    const allNums = [...numbers, result].sort((a, b) => a - b);
    return `SET:${allNums.join(',')}`;
  }
  
  // For 3+ number equations, use the full expression (less likely to have duplicates)
  let sig = String(numbers[0]);
  for (let i = 0; i < operators.length; i++) {
    sig += operators[i] + numbers[i + 1];
  }
  return sig + '=' + result;
}

/**
 * Determines which quadrant a position falls into
 */
function getQuadrant(row: number, col: number, centerRow: number, centerCol: number): Quadrant {
  if (row < centerRow) {
    return col < centerCol ? 'top-left' : 'top-right';
  } else {
    return col < centerCol ? 'bottom-left' : 'bottom-right';
  }
}

// ============================================
// CROSSWORD LAYOUT GENERATION
// ============================================

/**
 * Generates a crossword-style grid layout with CENTER-BASED BALANCED EXPANSION
 * ALL equations are guaranteed to be connected to each other.
 */
export async function generateCrosswordLayout(
  size: GridSize,
  difficulty: Difficulty,
  rng: RandomGenerator
): Promise<Grid | null> {
  const operators = getOperatorsForDifficulty(difficulty);
  const numRange = getNumberRange(difficulty, size);
  const targetEquations = getTargetEquationCount(size, difficulty);
  const { width, height } = getGridDimensions(size);
  const sharedResultProb = getSharedResultProbability(difficulty);
  const minMultiplyDivideRatio = getMinMultiplyDivideRatio(difficulty);
  const divisionConstraints = getDivisionConstraints(difficulty);
  
  // Calculate center position
  const centerRow = Math.floor(height / 2);
  const centerCol = Math.floor(width / 2);
  
  let grid = createEmptyGrid(size, width, height);
  
  // Track equations with × or ÷ operators for enforcing minimum ratio
  let equationsWithMultDiv = 0;
  
  /**
   * Check if we need to force × or ÷ for the next equation to meet the minimum ratio
   * We look ahead to see if we're falling behind on the target ratio
   * 
   * AGGRESSIVE MODE: Start enforcing earlier (at 30% completion) to ensure
   * we don't end up with too few × ÷ equations near the end
   */
  const shouldForceMultiplyDivide = (): boolean => {
    if (minMultiplyDivideRatio <= 0) return false;
    
    const currentCount = grid.equations.length;
    const remaining = targetEquations - currentCount;
    
    // How many × or ÷ equations do we need to meet the ratio?
    const neededTotal = Math.ceil(targetEquations * minMultiplyDivideRatio);
    const stillNeeded = neededTotal - equationsWithMultDiv;
    
    // If we need more × or ÷ equations than we have remaining, force it
    if (stillNeeded > 0 && stillNeeded >= remaining) {
      return true;
    }
    
    // AGGRESSIVE: Also force if we're at 30%+ completion but have no × ÷ yet
    const completionRatio = currentCount / targetEquations;
    if (completionRatio >= 0.3 && equationsWithMultDiv === 0 && stillNeeded > 0) {
      return true;
    }
    
    // AGGRESSIVE: If we're at 50%+ completion and behind on ratio, start forcing
    const currentRatio = currentCount > 0 ? equationsWithMultDiv / currentCount : 0;
    if (completionRatio >= 0.5 && currentRatio < minMultiplyDivideRatio * 0.7 && stillNeeded > 0) {
      return true;
    }
    
    return false;
  };
  
  /**
   * Track an equation and update the counter if it has × or ÷
   */
  const trackEquationOperators = (ops: Operator[]): void => {
    if (hasMultiplyOrDivide(ops)) {
      equationsWithMultDiv++;
    }
  };
  
  // Track quadrant populations for balanced expansion
  const quadrantCounts: Record<Quadrant, number> = {
    'top-left': 0,
    'top-right': 0,
    'bottom-left': 0,
    'bottom-right': 0,
  };
  
  // Track equation signatures to avoid duplicates (e.g., 2×7=14 and 7×2=14)
  const usedEquationSignatures = new Set<string>();
  
  const resultCells: ResultCellPosition[] = [];
  const intersectionPoints: IntersectionPoint[] = [];
  let equationId = 0;
  
  // Helper: Calculate vertical equation height (how many rows it spans)
  const getVerticalEquationHeight = (numNumbers: number) => numNumbers * 2;
  
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
  
  // Step 1: Place first horizontal equation at CENTER of grid (randomly LTR or RTL)
  {
    const eqSize = pickEquationSize(difficulty, rng.random());
    let eq: { numbers: number[]; operators: Operator[]; result: number } | null = null;
    
    if (eqSize === 2) {
      const gen = generate2NumberEquation(operators, rng, numRange, divisionConstraints);
      if (gen) eq = { numbers: gen.numbers, operators: [gen.operator], result: gen.result };
    } else if (eqSize === 3) {
      eq = generate3NumberEquation(operators, rng, numRange, divisionConstraints);
    } else {
      eq = generate4NumberEquation(operators, rng, numRange, divisionConstraints);
    }
    
    if (!eq) return null;
    
    // Track operators for × ÷ ratio enforcement
    trackEquationOperators(eq.operators);
    
    // Track equation signature to avoid duplicates
    usedEquationSignatures.add(getEquationSignature(eq.numbers, eq.operators, eq.result));
    
    // Randomly choose direction: LTR (result on right) or RTL (result on left)
    const isRTL = rng.random() < 0.5;
    
    // Calculate equation width and center it
    const eqWidth = eq.numbers.length * 2 + 1;
    const startCol = Math.max(0, centerCol - Math.floor(eqWidth / 2));
    const startRow = centerRow;
    
    if (isRTL) {
      // RTL: result on left - use placeHorizontalEquationLeft
      // The intersection point for RTL is at the rightmost number position
      const rightmostCol = startCol + eqWidth - 1; // rightmost position of equation
      grid = placeHorizontalEquationLeft(
        grid,
        equationId++,
        startRow,
        rightmostCol,
        eq.numbers,
        eq.operators,
        eq.result
      );
      
      // Update quadrant counts
      const eqQuadrant = getQuadrant(startRow, startCol, centerRow, centerCol);
      quadrantCounts[eqQuadrant]++;
      
      // For RTL, numbers are placed in reverse visual order (right to left)
      // numberCells in equation are stored in calculation order (right to left toward result)
      // But for intersection points, we use the visual positions
      const resultCol = startCol; // result is at leftmost position for RTL
      const reversedNumbers = [...eq.numbers].reverse();
      for (let i = 0; i < reversedNumbers.length; i++) {
        const col = resultCol + 2 + i * 2; // starts after result and equals
        intersectionPoints.push({
          row: startRow, col, value: reversedNumbers[i],
          canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
        });
      }
      
      // Track result position - it can START a vertical equation
      resultCells.push({
        row: startRow, col: resultCol, value: eq.result, used: false
      });
      // Add result as intersection point
      intersectionPoints.push({
        row: startRow, col: resultCol, value: eq.result,
        canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
        isResultCell: true
      });
    } else {
      // LTR: result on right - use original placeHorizontalEquation
      grid = placeHorizontalEquation(
        grid,
        equationId++,
        startRow,
        startCol,
        eq.numbers,
        eq.operators,
        eq.result
      );
      
      // Update quadrant counts
      const eqQuadrant = getQuadrant(startRow, startCol + Math.floor(eqWidth / 2), centerRow, centerCol);
      quadrantCounts[eqQuadrant]++;
      
      // Add intersection points for equations in ALL directions (at each number position)
      for (let i = 0; i < eq.numbers.length; i++) {
        const col = startCol + i * 2;
        intersectionPoints.push({
          row: startRow, col, value: eq.numbers[i],
          canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
        });
      }
      
      // Track result position - it can START a vertical equation (result becomes input)
      const resultCol = startCol + eq.numbers.length * 2;
      resultCells.push({
        row: startRow, col: resultCol, value: eq.result, used: false
      });
      // Add result as intersection point - vertical can START here (going down or up)
      intersectionPoints.push({
        row: startRow, col: resultCol, value: eq.result,
        canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
        isResultCell: true
      });
    }
  }
  
  // Step 2: Iteratively add connected equations
  let attempts = 0;
  let consecutiveFailures = 0; // Track consecutive iterations without placing an equation
  
  while (grid.equations.length < targetEquations && attempts < Generation.MAX_CROSSWORD_LAYOUT_ITERATIONS) {
    attempts++;
    
    // Yield to browser EVERY iteration to prevent freezing
    await yieldToBrowser();
    
    const availablePoints = intersectionPoints.filter(p => !p.used);
    const availableResultCells = resultCells.filter(r => !r.used);
    
    // Track if ANY equation was placed this iteration (including shared result)
    let placedThisIteration = false;
    
    // Occasionally try to place a shared result equation
    if (sharedResultProb > 0 && resultCells.length > 0) {
      
      if (availableResultCells.length > 0 && rng.random() < sharedResultProb) {
        rng.shuffle(availableResultCells);
        
        // Only try a few result cells per iteration (limit inner loop)
        let resultCellsTried = 0;
        
        for (const resultCell of availableResultCells) {
          if (resultCellsTried >= Generation.MAX_RESULT_CELLS_TO_TRY) break;
          resultCellsTried++;
          
          const eqSize = pickEquationSize(difficulty, rng.random());
          const vertHeight = eqSize * 2;
          const startRow = resultCell.row - vertHeight;
          
          // Check if we can place a vertical equation ending at the result cell
          if (startRow >= 0 && canPlaceVerticalEndingAt(resultCell.row, resultCell.col, eqSize)) {
            const vertEq = generateEquationWithResult(resultCell.value, eqSize, operators, rng, numRange, divisionConstraints);
            if (vertEq) {
              // Check for duplicate equation
              const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
              if (usedEquationSignatures.has(sig)) {
                continue; // Skip duplicate equation
              }
              usedEquationSignatures.add(sig);
              
              trackEquationOperators(vertEq.operators);
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
              placedThisIteration = true;
              
              // Add intersection points for the number cells
              for (let i = 0; i < vertEq.numbers.length; i++) {
                const numRow = startRow + i * 2;
                intersectionPoints.push({
                  row: numRow, col: resultCell.col, value: vertEq.numbers[i],
                  canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: false, used: false
                });
              }
              
              break;
            }
          }
        }
      }
    }
    
    // Try to place an equation using a result cell as input at ANY position (not just first)
    if (sharedResultProb > 0 && resultCells.length > 0 && rng.random() < sharedResultProb) {
      const availResultCells = resultCells.filter(r => !r.used);
      rng.shuffle(availResultCells);
      
      for (const resultCell of availResultCells) {
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
          const vertStartRow = resultCell.row - position * 2;
          const vertEndRow = vertStartRow + eqSize * 2;
          
          if (vertStartRow >= 0 && vertEndRow < height) {
            // Check if we can place this vertical (except at the result cell position)
            let canPlace = true;
            for (let i = 0; i < eqSize; i++) {
              if (i === position) continue;
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
              const forceMultDiv = shouldForceMultiplyDivide();
              const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
              if (eq) {
                // Check for duplicate equation
                const sig = getEquationSignature(eq.numbers, eq.operators, eq.result);
                if (usedEquationSignatures.has(sig)) {
                  continue; // Skip duplicate equation
                }
                usedEquationSignatures.add(sig);
                
                trackEquationOperators(eq.operators);
                // Place the equation cells
                for (let i = 0; i < eq.numbers.length; i++) {
                  const numRow = vertStartRow + i * 2;
                  if (i === position) {
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
                placedThisIteration = true;
                
                // Add intersection points
                for (let i = 0; i < eq.numbers.length; i++) {
                  if (i !== position) {
                    const numRow = vertStartRow + i * 2;
                    intersectionPoints.push({
                      row: numRow, col: resultCell.col, value: eq.numbers[i],
                      canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: false, used: false
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
          const horizEndCol = horizStartCol + eqSize * 2;
          
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
              const forceMultDiv = shouldForceMultiplyDivide();
              const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
              if (eq) {
                // Check for duplicate equation
                const sig = getEquationSignature(eq.numbers, eq.operators, eq.result);
                if (usedEquationSignatures.has(sig)) {
                  continue; // Skip duplicate equation
                }
                usedEquationSignatures.add(sig);
                
                trackEquationOperators(eq.operators);
                // Place the equation cells
                for (let i = 0; i < eq.numbers.length; i++) {
                  const numCol = horizStartCol + i * 2;
                  if (i === position) {
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
                placedThisIteration = true;
                
                for (let i = 0; i < eq.numbers.length; i++) {
                  if (i !== position) {
                    const numCol = horizStartCol + i * 2;
                    intersectionPoints.push({
                      row: resultCell.row, col: numCol, value: eq.numbers[i],
                      canPlaceDown: true, canPlaceUp: false, canPlaceRight: false, canPlaceLeft: false, used: false
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
    
    // Early exit if no points available
    if (availablePoints.length === 0 && availableResultCells.length === 0) {
      break;
    }
    
    // Sort by quadrant population (least populated first) with deterministic tiebreaker
    const pointsWithQuadrant = availablePoints.map((p, index) => ({
      point: p,
      quadrant: getQuadrant(p.row, p.col, centerRow, centerCol),
      originalIndex: index,
    }));
    
    pointsWithQuadrant.sort((a, b) => {
      const countDiff = quadrantCounts[a.quadrant] - quadrantCounts[b.quadrant];
      if (countDiff !== 0) return countDiff;
      return a.originalIndex - b.originalIndex;
    });
    
    const shuffledPoints = rng.shuffle(pointsWithQuadrant);
    
    let placed = false;
    let pointsTried = 0;
    
    for (const { point } of shuffledPoints) {
      if (pointsTried >= Generation.MAX_INTERSECTION_POINTS_TO_TRY) break;
      pointsTried++;
      
      const directionOptions: Array<{ dir: 'down' | 'up' | 'right' | 'left'; targetQuadrant: Quadrant }> = [];
      
      if (point.canPlaceDown) {
        const targetQ = point.col < centerCol ? 'bottom-left' : 'bottom-right';
        directionOptions.push({ dir: 'down', targetQuadrant: targetQ });
      }
      if (point.canPlaceUp) {
        const targetQ = point.col < centerCol ? 'top-left' : 'top-right';
        directionOptions.push({ dir: 'up', targetQuadrant: targetQ });
      }
      if (point.canPlaceRight) {
        const targetQ = point.row < centerRow ? 'top-right' : 'bottom-right';
        directionOptions.push({ dir: 'right', targetQuadrant: targetQ });
      }
      if (point.canPlaceLeft) {
        const targetQ = point.row < centerRow ? 'top-left' : 'bottom-left';
        directionOptions.push({ dir: 'left', targetQuadrant: targetQ });
      }
      
      directionOptions.sort((a, b) => {
        return quadrantCounts[a.targetQuadrant] - quadrantCounts[b.targetQuadrant];
      });
      
      const shuffledDirections = rng.shuffle(directionOptions);
      const directions = shuffledDirections.map(d => d.dir);
      
      for (const dir of directions) {
        const eqSize = pickEquationSize(difficulty, rng.random());
        // Pick a random intersection position (0 to eqSize-1) for variety
        const intersectionPos = rng.int(0, eqSize - 1);
        
        if (dir === 'down' && !point.isResultCell) {
          // Calculate start row based on intersection position
          // If intersection is at position P, start row is point.row - P*2
          const startRow = point.row - intersectionPos * 2;
          const endRow = startRow + eqSize * 2; // result row
          
          // Check bounds and collision for all cells
          let canPlace = startRow >= 0 && endRow < height;
          if (canPlace) {
            // Check number positions (except the intersection point)
            for (let i = 0; i < eqSize && canPlace; i++) {
              if (i === intersectionPos) continue; // Skip intersection - already exists
              const numRow = startRow + i * 2;
              if (getCellAt(grid, numRow, point.col) !== null) canPlace = false;
            }
            // Check operator positions
            for (let i = 0; i < eqSize - 1 && canPlace; i++) {
              const opRow = startRow + i * 2 + 1;
              if (getCellAt(grid, opRow, point.col) !== null) canPlace = false;
            }
            // Check equals and result positions
            if (canPlace) {
              const equalsRow = endRow - 1;
              if (getCellAt(grid, equalsRow, point.col) !== null) canPlace = false;
              if (getCellAt(grid, endRow, point.col) !== null) canPlace = false;
            }
          }
          
          if (canPlace) {
            const forceMultDiv = shouldForceMultiplyDivide();
            const vertEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
            if (vertEq) {
              // Check for duplicate equation
              const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
              if (usedEquationSignatures.has(sig)) {
                continue; // Skip duplicate equation
              }
              usedEquationSignatures.add(sig);
              
              // Place number cells
              for (let i = 0; i < vertEq.numbers.length; i++) {
                const numRow = startRow + i * 2;
                if (i === intersectionPos) {
                  // Intersection point - may need to convert result cell to number
                  const existingCell = getCellAt(grid, numRow, point.col);
                  if (!existingCell || existingCell.type === 'result') {
                    grid = setCellAt(grid, numRow, point.col, createNumberCell(numRow, point.col, vertEq.numbers[i], true));
                  }
                } else {
                  grid = setCellAt(grid, numRow, point.col, createNumberCell(numRow, point.col, vertEq.numbers[i], true));
                }
                if (i < vertEq.operators.length) {
                  const opRow = startRow + i * 2 + 1;
                  grid = setCellAt(grid, opRow, point.col, createOperatorCell(opRow, point.col, vertEq.operators[i]));
                }
              }
              // Place equals and result
              const equalsRow = endRow - 1;
              grid = setCellAt(grid, equalsRow, point.col, createEqualsCell(equalsRow, point.col));
              const resultCellNew = createResultCell(endRow, point.col, vertEq.result);
              grid = setCellAt(grid, endRow, point.col, resultCellNew);
              
              // Create equation entry
              const numberCells = vertEq.numbers.map((val, i) => 
                createNumberCell(startRow + i * 2, point.col, val, true)
              );
              const operatorCells = vertEq.operators.map((op, i) => 
                createOperatorCell(startRow + i * 2 + 1, point.col, op)
              );
              const equation = {
                id: equationId++,
                direction: 'vertical' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow,
                startCol: point.col,
              };
              grid = { ...grid, equations: [...grid.equations, equation] };
              
              trackEquationOperators(vertEq.operators);
              point.used = true;
              
              quadrantCounts[getQuadrant(endRow, point.col, centerRow, centerCol)]++;
              
              // Add intersection points for non-intersection number cells
              for (let i = 0; i < vertEq.numbers.length; i++) {
                if (i !== intersectionPos) {
                  const numRow = startRow + i * 2;
                  intersectionPoints.push({
                    row: numRow, col: point.col, value: vertEq.numbers[i],
                    canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false
                  });
                }
              }
              resultCells.push({ row: endRow, col: point.col, value: vertEq.result, used: false });
              intersectionPoints.push({
                row: endRow, col: point.col, value: vertEq.result,
                canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false,
                isResultCell: true
              });
              
              placed = true;
              break;
            }
          }
        }
        
        if (dir === 'up' && !point.isResultCell) {
          // For "up" direction, the equation reads top-to-bottom but result is at top
          // intersection position is from the bottom (point.row), going up
          // If intersection is at position P (from bottom), equation spans from point.row - (eqSize-1-P)*2 to point.row + P*2
          // Actually for up: result is at top, numbers read downward. Intersection at pos P means:
          // - Numbers are at rows: resultRow+2, resultRow+4, ..., resultRow+2*eqSize
          // - Point is at position eqSize-1-intersectionPos from result
          const resultRow = point.row - (eqSize - 1 - intersectionPos) * 2 - 2; // 2 for equals+result
          
          // Check bounds
          let canPlace = resultRow >= 0 && point.row + intersectionPos * 2 < height;
          if (canPlace) {
            // Check all positions except intersection
            for (let i = 0; i < eqSize && canPlace; i++) {
              const numRow = resultRow + 2 + i * 2; // numbers start after result and equals
              if (i === eqSize - 1 - intersectionPos) continue; // Skip intersection
              if (getCellAt(grid, numRow, point.col) !== null) canPlace = false;
            }
            // Check operator positions
            for (let i = 0; i < eqSize - 1 && canPlace; i++) {
              const opRow = resultRow + 3 + i * 2;
              if (getCellAt(grid, opRow, point.col) !== null) canPlace = false;
            }
            // Check result and equals
            if (canPlace) {
              if (getCellAt(grid, resultRow, point.col) !== null) canPlace = false;
              if (getCellAt(grid, resultRow + 1, point.col) !== null) canPlace = false;
            }
          }
          
          if (canPlace) {
            const forceMultDiv = shouldForceMultiplyDivide();
            // Generate equation - but for "up", we reverse the numbers after generation
            const vertEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
            if (vertEq) {
              // Check for duplicate equation
              const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
              if (usedEquationSignatures.has(sig)) {
                continue; // Skip duplicate equation
              }
              usedEquationSignatures.add(sig);
              
              // For up direction, reverse numbers and operators so result is at top
              const reversedNumbers = [...vertEq.numbers].reverse();
              const reversedOperators = [...vertEq.operators].reverse();
              
              // Place result and equals at top
              const resultCellNew = createResultCell(resultRow, point.col, vertEq.result);
              grid = setCellAt(grid, resultRow, point.col, resultCellNew);
              grid = setCellAt(grid, resultRow + 1, point.col, createEqualsCell(resultRow + 1, point.col));
              
              // Place numbers and operators going down
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numRow = resultRow + 2 + i * 2;
                const existingCell = getCellAt(grid, numRow, point.col);
                if (!existingCell) {
                  grid = setCellAt(grid, numRow, point.col, createNumberCell(numRow, point.col, reversedNumbers[i], true));
                }
                if (i < reversedOperators.length) {
                  const opRow = resultRow + 3 + i * 2;
                  grid = setCellAt(grid, opRow, point.col, createOperatorCell(opRow, point.col, reversedOperators[i]));
                }
              }
              
              // Create equation entry
              // For "result at top" equations, we need to store numberCells and operatorCells
              // in REVERSE visual order so that evaluation goes bottom→top (toward result).
              // numberCells[0] should be the BOTTOM cell (furthest from result).
              const visualNumberCells = reversedNumbers.map((val, i) => 
                createNumberCell(resultRow + 2 + i * 2, point.col, val, true)
              );
              const visualOperatorCells = reversedOperators.map((op, i) => 
                createOperatorCell(resultRow + 3 + i * 2, point.col, op)
              );
              // Reverse to get calculation order (bottom to top = toward result)
              const numberCells = [...visualNumberCells].reverse();
              const operatorCells = [...visualOperatorCells].reverse();
              const equation = {
                id: equationId++,
                direction: 'vertical' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: resultRow,
                startCol: point.col,
              };
              grid = { ...grid, equations: [...grid.equations, equation] };
              
              trackEquationOperators(vertEq.operators);
              point.used = true;
              
              quadrantCounts[getQuadrant(resultRow, point.col, centerRow, centerCol)]++;
              
              // Add intersection points for non-intersection cells
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numRow = resultRow + 2 + i * 2;
                if (numRow !== point.row) {
                  intersectionPoints.push({
                    row: numRow, col: point.col, value: reversedNumbers[i],
                    canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false
                  });
                }
              }
              resultCells.push({ row: resultRow, col: point.col, value: vertEq.result, used: false });
              intersectionPoints.push({
                row: resultRow, col: point.col, value: vertEq.result,
                canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false,
                isResultCell: true
              });
              
              placed = true;
              break;
            }
          }
        }
        
        if (dir === 'right') {
          // Calculate start column based on intersection position
          const startCol = point.col - intersectionPos * 2;
          const endCol = startCol + eqSize * 2; // result column
          
          // Check bounds and collision
          let canPlace = startCol >= 0 && endCol < width;
          if (canPlace) {
            // Check number positions (except intersection)
            for (let i = 0; i < eqSize && canPlace; i++) {
              if (i === intersectionPos) continue;
              const numCol = startCol + i * 2;
              if (getCellAt(grid, point.row, numCol) !== null) canPlace = false;
            }
            // Check operator positions
            for (let i = 0; i < eqSize - 1 && canPlace; i++) {
              const opCol = startCol + i * 2 + 1;
              if (getCellAt(grid, point.row, opCol) !== null) canPlace = false;
            }
            // Check equals and result
            if (canPlace) {
              const equalsCol = endCol - 1;
              if (getCellAt(grid, point.row, equalsCol) !== null) canPlace = false;
              if (getCellAt(grid, point.row, endCol) !== null) canPlace = false;
            }
          }
          
          if (canPlace) {
            const forceMultDiv = shouldForceMultiplyDivide();
            const horizEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
            if (horizEq) {
              // Check for duplicate equation
              const sig = getEquationSignature(horizEq.numbers, horizEq.operators, horizEq.result);
              if (usedEquationSignatures.has(sig)) {
                continue; // Skip duplicate equation
              }
              usedEquationSignatures.add(sig);
              
              // Place number cells
              for (let i = 0; i < horizEq.numbers.length; i++) {
                const numCol = startCol + i * 2;
                if (i === intersectionPos) {
                  // Intersection point - may need to convert result cell to number
                  const existingCell = getCellAt(grid, point.row, numCol);
                  if (!existingCell || existingCell.type === 'result') {
                    grid = setCellAt(grid, point.row, numCol, createNumberCell(point.row, numCol, horizEq.numbers[i], true));
                  }
                } else {
                  grid = setCellAt(grid, point.row, numCol, createNumberCell(point.row, numCol, horizEq.numbers[i], true));
                }
                if (i < horizEq.operators.length) {
                  const opCol = startCol + i * 2 + 1;
                  grid = setCellAt(grid, point.row, opCol, createOperatorCell(point.row, opCol, horizEq.operators[i]));
                }
              }
              // Place equals and result
              const equalsCol = endCol - 1;
              grid = setCellAt(grid, point.row, equalsCol, createEqualsCell(point.row, equalsCol));
              const resultCellNew = createResultCell(point.row, endCol, horizEq.result);
              grid = setCellAt(grid, point.row, endCol, resultCellNew);
              
              // Create equation entry
              const numberCells = horizEq.numbers.map((val, i) => 
                createNumberCell(point.row, startCol + i * 2, val, true)
              );
              const operatorCells = horizEq.operators.map((op, i) => 
                createOperatorCell(point.row, startCol + i * 2 + 1, op)
              );
              const equation = {
                id: equationId++,
                direction: 'horizontal' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: point.row,
                startCol,
              };
              grid = { ...grid, equations: [...grid.equations, equation] };
              
              trackEquationOperators(horizEq.operators);
              point.used = true;
              
              quadrantCounts[getQuadrant(point.row, endCol, centerRow, centerCol)]++;
              
              // Add intersection points for non-intersection cells
              for (let i = 0; i < horizEq.numbers.length; i++) {
                if (i !== intersectionPos) {
                  const numCol = startCol + i * 2;
                  intersectionPoints.push({
                    row: point.row, col: numCol, value: horizEq.numbers[i],
                    canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
                  });
                }
              }
              resultCells.push({ row: point.row, col: endCol, value: horizEq.result, used: false });
              intersectionPoints.push({
                row: point.row, col: endCol, value: horizEq.result,
                canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
                isResultCell: true
              });
              
              placed = true;
              break;
            }
          }
        }
        
        if (dir === 'left') {
          // For "left" direction, the equation reads left-to-right but result is on the LEFT
          // Example: "15 = 12 + 7 - 10" where evaluation is right-to-left: 10 - 7 = 3, 3 + 12 = 15
          // intersection position is from the right (furthest from result), going left toward result
          const resultCol = point.col - (eqSize - 1 - intersectionPos) * 2 - 2; // -2 for equals+result
          
          // Check bounds
          let canPlace = resultCol >= 0 && point.col + intersectionPos * 2 < width;
          if (canPlace) {
            // Check all positions except intersection
            for (let i = 0; i < eqSize && canPlace; i++) {
              const numCol = resultCol + 2 + i * 2; // numbers start after result and equals
              if (i === eqSize - 1 - intersectionPos) continue; // Skip intersection
              if (getCellAt(grid, point.row, numCol) !== null) canPlace = false;
            }
            // Check operator positions
            for (let i = 0; i < eqSize - 1 && canPlace; i++) {
              const opCol = resultCol + 3 + i * 2;
              if (getCellAt(grid, point.row, opCol) !== null) canPlace = false;
            }
            // Check result and equals
            if (canPlace) {
              if (getCellAt(grid, point.row, resultCol) !== null) canPlace = false;
              if (getCellAt(grid, point.row, resultCol + 1) !== null) canPlace = false;
            }
          }
          
          if (canPlace) {
            const forceMultDiv = shouldForceMultiplyDivide();
            // Generate equation - but for "left", we reverse the numbers after generation
            const horizEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
            if (horizEq) {
              // Check for duplicate equation
              const sig = getEquationSignature(horizEq.numbers, horizEq.operators, horizEq.result);
              if (usedEquationSignatures.has(sig)) {
                continue; // Skip duplicate equation
              }
              usedEquationSignatures.add(sig);
              
              // For left direction, reverse numbers and operators so result is on the left
              const reversedNumbers = [...horizEq.numbers].reverse();
              const reversedOperators = [...horizEq.operators].reverse();
              
              // Place result and equals at left
              const resultCellNew = createResultCell(point.row, resultCol, horizEq.result);
              grid = setCellAt(grid, point.row, resultCol, resultCellNew);
              grid = setCellAt(grid, point.row, resultCol + 1, createEqualsCell(point.row, resultCol + 1));
              
              // Place numbers and operators going right
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numCol = resultCol + 2 + i * 2;
                const existingCell = getCellAt(grid, point.row, numCol);
                if (!existingCell) {
                  grid = setCellAt(grid, point.row, numCol, createNumberCell(point.row, numCol, reversedNumbers[i], true));
                }
                if (i < reversedOperators.length) {
                  const opCol = resultCol + 3 + i * 2;
                  grid = setCellAt(grid, point.row, opCol, createOperatorCell(point.row, opCol, reversedOperators[i]));
                }
              }
              
              // Create equation entry
              // For "result at left" equations, we need to store numberCells and operatorCells
              // in REVERSE visual order so that evaluation goes right→left (toward result).
              // numberCells[0] should be the RIGHTMOST cell (furthest from result).
              const visualNumberCells = reversedNumbers.map((val, i) => 
                createNumberCell(point.row, resultCol + 2 + i * 2, val, true)
              );
              const visualOperatorCells = reversedOperators.map((op, i) => 
                createOperatorCell(point.row, resultCol + 3 + i * 2, op)
              );
              // Reverse to get calculation order (right to left = toward result)
              const numberCells = [...visualNumberCells].reverse();
              const operatorCells = [...visualOperatorCells].reverse();
              const equation = {
                id: equationId++,
                direction: 'horizontal' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: point.row,
                startCol: resultCol,
              };
              grid = { ...grid, equations: [...grid.equations, equation] };
              
              trackEquationOperators(horizEq.operators);
              point.used = true;
              
              quadrantCounts[getQuadrant(point.row, resultCol, centerRow, centerCol)]++;
              
              // Add intersection points for non-intersection cells
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numCol = resultCol + 2 + i * 2;
                if (numCol !== point.col) {
                  intersectionPoints.push({
                    row: point.row, col: numCol, value: reversedNumbers[i],
                    canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
                  });
                }
              }
              resultCells.push({ row: point.row, col: resultCol, value: horizEq.result, used: false });
              intersectionPoints.push({
                row: point.row, col: resultCol, value: horizEq.result,
                canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
                isResultCell: true
              });
              
              placed = true;
              break;
            }
          }
        }
      }
      
      if (placed) break;
    }
    
    // Track consecutive failures for early termination
    if (!placed && !placedThisIteration) {
      consecutiveFailures++;
      // Early termination if we've failed too many times in a row
      if (consecutiveFailures >= Generation.MAX_CONSECUTIVE_FAILURES) {
        break;
      }
    } else {
      consecutiveFailures = 0; // Reset on success
    }
  }

  // Accept the grid if we have a reasonable number of equations
  const minAcceptable = Math.max(4, Math.floor(targetEquations * 0.6));
  if (grid.equations.length < minAcceptable) {
    return null;
  }
  
  return grid;
}
