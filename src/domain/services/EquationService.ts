/**
 * EquationService - Functions for evaluating and validating equations
 * Pure functions with no side effects
 */

import type { Operator, Cell, Equation, EquationValidation, NumberCell } from '@domain/types';
import { isNumberCell, isOperatorCell } from '@domain/entities/Cell';

// Re-export getOperatorsForDifficulty from centralized settings
export { getOperatorsForDifficulty } from './DifficultySettings';

/**
 * Applies an operator to two numbers
 * Returns null if the operation is invalid (e.g., division by zero, non-integer result, negative result)
 * No negative results are allowed in this game
 */
export function applyOperator(left: number, operator: Operator, right: number): number | null {
  let result: number;
  
  switch (operator) {
    case '+':
      result = left + right;
      break;
    case '-':
      result = left - right;
      // Reject negative results
      if (result < 0) return null;
      break;
    case '×':
      result = left * right;
      break;
    case '÷':
      // Only allow division if result is a positive integer
      if (right === 0) return null;
      result = left / right;
      if (!Number.isInteger(result) || result < 0) return null;
      break;
    default:
      return null;
  }
  
  return result;
}

/**
 * Evaluates an equation from its structured cells
 * Returns the calculated result or null if invalid
 * 
 * New structure: equation has numberCells, operatorCells, resultCell
 * Evaluates left-to-right (no operator precedence for simplicity)
 */
export function evaluateEquation(equation: Equation): number | null {
  const { numberCells, operatorCells } = equation;
  
  if (numberCells.length === 0) return null;
  if (numberCells.length - 1 !== operatorCells.length) return null;
  
  // Check first number cell has a value
  const firstCell = numberCells[0];
  if (firstCell.value === null) return null;
  
  let result = firstCell.value;
  
  // Process pairs of (operator, number)
  for (let i = 0; i < operatorCells.length; i++) {
    const opCell = operatorCells[i];
    const numCell = numberCells[i + 1];
    
    if (!numCell || numCell.value === null) return null;
    
    const newResult = applyOperator(result, opCell.value, numCell.value);
    if (newResult === null) return null;
    
    result = newResult;
  }
  
  return result;
}

/**
 * Evaluates an equation from a flat array of cells (legacy support)
 * Returns the calculated result or null if invalid
 */
export function evaluateEquationFromCells(cells: Cell[]): number | null {
  if (cells.length < 3) return null;

  // Filter to get only number, operator cells (exclude result cell)
  const evalCells = cells.filter(c => isNumberCell(c) || isOperatorCell(c));
  
  if (evalCells.length === 0) return null;
  
  // First cell must be a number
  const firstCell = evalCells[0];
  if (!isNumberCell(firstCell) || firstCell.value === null) return null;
  
  let result = firstCell.value;
  
  // Process pairs of (operator, number)
  for (let i = 1; i < evalCells.length; i += 2) {
    const opCell = evalCells[i];
    const numCell = evalCells[i + 1];
    
    if (!isOperatorCell(opCell)) return null;
    if (!numCell || !isNumberCell(numCell) || numCell.value === null) return null;
    
    const newResult = applyOperator(result, opCell.value, numCell.value);
    if (newResult === null) return null;
    
    result = newResult;
  }
  
  return result;
}

/**
 * Gets the expected result from an equation
 */
export function getExpectedResult(equation: Equation): number {
  return equation.resultCell.value;
}

/**
 * Validates a single equation
 */
export function validateEquation(equation: Equation): EquationValidation {
  const calculatedResult = evaluateEquation(equation);
  const expectedResult = getExpectedResult(equation);
  const isComplete = isEquationComplete(equation);
  
  return {
    equationId: equation.id,
    isValid: calculatedResult !== null && calculatedResult === expectedResult,
    isComplete,
    calculatedResult,
    expectedResult,
  };
}

/**
 * Checks if all numbers in the equation have values
 */
export function isEquationComplete(equation: Equation): boolean {
  return equation.numberCells.every((cell) => cell.value !== null);
}

/**
 * Gets the display string for an operator
 */
export function getOperatorDisplay(operator: Operator): string {
  return operator;
}

/**
 * Parses an operator from a display string
 */
export function parseOperator(display: string): Operator | null {
  const operators: Operator[] = ['+', '-', '×', '÷'];
  if (operators.includes(display as Operator)) {
    return display as Operator;
  }
  // Also accept alternate representations
  if (display === '*' || display === 'x') return '×';
  if (display === '/') return '÷';
  return null;
}
