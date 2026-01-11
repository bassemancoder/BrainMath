/**
 * ValidationService - Validates user input and grid state
 * Pure functions with no side effects
 * 
 * Updated for crossword-style grid with new Equation structure
 */

import type { Grid, ValidationResult, CellError, EquationValidation, Equation } from '@domain/types';
import { isNumberCell, isResultCell } from '@domain/entities/Cell';
import { getAllEquations, getCellAt } from './GridService';
import { validateEquation, isEquationComplete } from './EquationService';

/**
 * Gets an equation with updated cell values from the grid
 */
function getUpdatedEquation(grid: Grid, equation: Equation): Equation {
  const numberCells = equation.numberCells.map(cell => {
    const gridCell = getCellAt(grid, cell.row, cell.col);
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
 * Checks if an equation is visually complete for validation purposes.
 * An equation should only be validated when:
 * 1. All its numberCells have values, AND
 * 2. If there's a NumberCell at the resultCell position (shared cell), it also has a value
 * 
 * This prevents showing errors before the user has filled in all visible cells in the equation.
 */
function isEquationVisuallyComplete(grid: Grid, equation: Equation): boolean {
  // First check if all number cells are filled
  if (!isEquationComplete(equation)) {
    return false;
  }
  
  // Check if there's a NumberCell at the result position that is empty
  // This happens when the result is shared with another equation's number cell
  const cellAtResult = getCellAt(grid, equation.resultCell.row, equation.resultCell.col);
  if (cellAtResult && isNumberCell(cellAtResult) && cellAtResult.value === null) {
    return false;
  }
  
  return true;
}

/**
 * Validates the entire grid and returns detailed results
 */
export function validateGrid(grid: Grid): ValidationResult {
  const equations = getAllEquations(grid);
  const equationResults: EquationValidation[] = [];
  const errors: CellError[] = [];
  let allComplete = true;
  let allValid = true;
  
  for (const equation of equations) {
    // Get equation with current grid values
    const updatedEquation = getUpdatedEquation(grid, equation);
    
    // Get the displayed result value from the grid
    // This could be a NumberCell if the result is shared with another equation,
    // or a ResultCell if it's a fixed result
    const resultCellInGrid = getCellAt(grid, equation.resultCell.row, equation.resultCell.col);
    let displayedResult = equation.resultCell.value; // default
    if (resultCellInGrid) {
      if (isNumberCell(resultCellInGrid) && resultCellInGrid.value !== null) {
        displayedResult = resultCellInGrid.value;
      } else if (isResultCell(resultCellInGrid)) {
        displayedResult = resultCellInGrid.value;
      }
    }
    
    const validation = validateEquation(updatedEquation, displayedResult);
    equationResults.push(validation);
    
    // Check if equation is visually complete (including shared result cells)
    if (!isEquationVisuallyComplete(grid, updatedEquation)) {
      allComplete = false;
    } else if (!validation.isValid) {
      // Only flag as invalid if equation is complete but wrong
      allValid = false;
      
      // Add errors for editable cells in this equation
      for (const cell of updatedEquation.numberCells) {
        if (!cell.isFixed) {
          // Check if we already have an error for this cell
          const existingError = errors.find(
            e => e.row === cell.row && e.col === cell.col
          );
          
          if (!existingError) {
            errors.push({
              row: cell.row,
              col: cell.col,
              message: `Equation ${equation.direction} at ${equation.startRow},${equation.startCol} is incorrect`,
            });
          }
        }
      }
    }
  }
  
  return {
    isValid: allValid,
    isComplete: allComplete,
    errors,
    equationResults,
  };
}

/**
 * Checks if a specific cell value is correct according to the solution
 */
export function validateCellAgainstSolution(
  grid: Grid,
  solution: Grid,
  row: number,
  col: number
): { isCorrect: boolean; correctValue: number | null } {
  const cell = getCellAt(grid, row, col);
  const solutionCell = getCellAt(solution, row, col);
  
  if (!cell || !solutionCell) {
    return { isCorrect: false, correctValue: null };
  }
  
  if (!isNumberCell(cell) || !isNumberCell(solutionCell)) {
    return { isCorrect: true, correctValue: null };
  }
  
  const isCorrect = cell.value === solutionCell.value;
  return {
    isCorrect,
    correctValue: solutionCell.value,
  };
}

/**
 * Checks if the grid matches the solution (user has won)
 * Note: This function checks for exact match. For puzzles with multiple valid solutions
 * (due to commutativity), use validation.isComplete && validation.isValid instead.
 */
export function checkWinCondition(grid: Grid, solution: Grid): boolean {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = getCellAt(grid, row, col);
      const solutionCell = getCellAt(solution, row, col);
      
      if (cell === null && solutionCell === null) continue;
      if (cell === null || solutionCell === null) return false;
      
      if (isNumberCell(cell) && isNumberCell(solutionCell)) {
        if (cell.value !== solutionCell.value) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Gets cells that have incorrect values compared to solution
 */
export function getIncorrectCells(
  grid: Grid,
  solution: Grid
): Array<{ row: number; col: number; userValue: number; correctValue: number }> {
  const incorrect: Array<{ row: number; col: number; userValue: number; correctValue: number }> = [];
  
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = getCellAt(grid, row, col);
      const solutionCell = getCellAt(solution, row, col);
      
      if (
        cell && solutionCell &&
        isNumberCell(cell) &&
        !cell.isFixed &&
        cell.value !== null &&
        isNumberCell(solutionCell) &&
        cell.value !== solutionCell.value
      ) {
        incorrect.push({
          row,
          col,
          userValue: cell.value,
          correctValue: solutionCell.value!,
        });
      }
    }
  }
  
  return incorrect;
}

/**
 * Checks if a specific equation is valid
 */
export function isEquationValid(grid: Grid, equationId: number): boolean {
  const equations = getAllEquations(grid);
  const equation = equations.find(eq => eq.id === equationId);
  
  if (!equation) return true;
  
  const updatedEquation = getUpdatedEquation(grid, equation);
  if (!isEquationComplete(updatedEquation)) return true;
  
  // Get the displayed result value from the grid
  const resultCellInGrid = getCellAt(grid, equation.resultCell.row, equation.resultCell.col);
  let displayedResult = equation.resultCell.value; // default
  if (resultCellInGrid) {
    if (isNumberCell(resultCellInGrid) && resultCellInGrid.value !== null) {
      displayedResult = resultCellInGrid.value;
    } else if (isResultCell(resultCellInGrid)) {
      displayedResult = resultCellInGrid.value;
    }
  }
  
  return validateEquation(updatedEquation, displayedResult).isValid;
}

/**
 * Gets a summary of the validation state for UI display
 */
export function getValidationSummary(result: ValidationResult): {
  correctCount: number;
  incorrectCount: number;
  incompleteCount: number;
} {
  let correctCount = 0;
  let incorrectCount = 0;
  let incompleteCount = 0;
  
  for (const eq of result.equationResults) {
    if (!eq.isComplete) {
      incompleteCount++;
    } else if (eq.isValid) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }
  
  return { correctCount, incorrectCount, incompleteCount };
}

/**
 * Validates a single equation by its ID
 */
export function validateEquationById(grid: Grid, equationId: number): EquationValidation | null {
  const equations = getAllEquations(grid);
  const equation = equations.find(eq => eq.id === equationId);
  
  if (!equation) return null;
  
  const updatedEquation = getUpdatedEquation(grid, equation);
  
  // Get the displayed result value from the grid
  const resultCellInGrid = getCellAt(grid, equation.resultCell.row, equation.resultCell.col);
  let displayedResult = equation.resultCell.value; // default
  if (resultCellInGrid) {
    if (isNumberCell(resultCellInGrid) && resultCellInGrid.value !== null) {
      displayedResult = resultCellInGrid.value;
    } else if (isResultCell(resultCellInGrid)) {
      displayedResult = resultCellInGrid.value;
    }
  }
  
  return validateEquation(updatedEquation, displayedResult);
}
