/**
 * Domain Computation - Analytical domain calculation for equation cells
 * 
 * For each equation pattern, we can analytically compute valid values:
 * - A + ? = R → ? = R - A (if > 0)
 * - ? + B = R → ? = R - B (if > 0)
 * - A × ? = R → ? = R ÷ A (if integer and A ≠ 0)
 * - A - ? = R → ? = A - R (if > 0)
 * - ? - B = R → ? = R + B
 * - A ÷ ? = R → ? = A ÷ R (if integer and R ≠ 0)
 * - ? ÷ B = R → ? = R × B (if in range)
 */

import type { Equation, Operator } from '@domain/types';
import { Cell } from '@domain/constants';

// ============================================
// PUBLIC API
// ============================================

/**
 * Computes the possible values for an unknown cell in an equation
 * based on known values and the result.
 * 
 * @param equation - The equation containing the cell
 * @param cellRow - Row of the target cell
 * @param cellCol - Column of the target cell
 * @param maxValue - Maximum allowed value (default: 99)
 * @returns Set of valid values for this cell
 */
export function computeDomainForCellInEquation(
  equation: Equation,
  cellRow: number,
  cellCol: number,
  maxValue: number = Cell.MAX_VALUE
): Set<number> {
  const { numberCells, operatorCells, resultCell } = equation;
  const result = resultCell.value;
  
  // Find which position our target cell is in
  const targetIndex = numberCells.findIndex(
    c => c.row === cellRow && c.col === cellCol
  );
  
  if (targetIndex === -1) {
    // Cell not in this equation - return full domain
    return createFullDomain(maxValue);
  }
  
  // Get all known values and identify unknowns
  const values: (number | null)[] = numberCells.map(c => c.value);
  const operators: Operator[] = operatorCells.map(c => c.value);
  
  // Count unknowns
  const unknownIndices = values
    .map((v, i) => v === null ? i : -1)
    .filter(i => i !== -1);
  
  // If more than one unknown, we can't compute exact domain from this equation alone
  // Return a broad domain based on result constraints
  if (unknownIndices.length > 1) {
    return computeBroadDomain(equation, targetIndex, maxValue);
  }
  
  // Single unknown - compute exact domain
  if (unknownIndices.length === 1 && unknownIndices[0] === targetIndex) {
    return computeExactDomain(values, operators, result, targetIndex, maxValue);
  }
  
  // No unknowns or target is known - return its current value as domain
  const currentValue = values[targetIndex];
  if (currentValue !== null) {
    return new Set([currentValue]);
  }
  
  return createFullDomain(maxValue);
}

/**
 * Creates a full domain from 1 to max
 */
export function createFullDomain(max: number): Set<number> {
  const domain = new Set<number>();
  for (let i = 1; i <= max; i++) {
    domain.add(i);
  }
  return domain;
}

// ============================================
// EXACT DOMAIN COMPUTATION
// ============================================

/**
 * Computes exact domain when there's only one unknown
 */
function computeExactDomain(
  values: (number | null)[],
  operators: Operator[],
  result: number,
  targetIndex: number,
  maxValue: number
): Set<number> {
  const domain = new Set<number>();
  
  // For 2-number equations: A op B = R
  if (values.length === 2) {
    const op = operators[0];
    const knownIndex = targetIndex === 0 ? 1 : 0;
    const knownValue = values[knownIndex]!;
    
    if (targetIndex === 0) {
      // ? op B = R, solve for ?
      const solutions = solveForFirst(op, knownValue, result, maxValue);
      solutions.forEach(v => domain.add(v));
    } else {
      // A op ? = R, solve for ?
      const solutions = solveForSecond(knownValue, op, result, maxValue);
      solutions.forEach(v => domain.add(v));
    }
    return domain;
  }
  
  // For 3+ number equations, we need to evaluate partially
  // This is more complex - use iterative approach
  for (let candidate = 1; candidate <= maxValue; candidate++) {
    const testValues = [...values];
    testValues[targetIndex] = candidate;
    
    if (evaluateToResult(testValues as number[], operators, result)) {
      domain.add(candidate);
    }
  }
  
  return domain;
}

// ============================================
// EQUATION SOLVING
// ============================================

/**
 * Solves ? op B = R for ?
 * 
 * @param op - The operator
 * @param b - The known second operand
 * @param result - The equation result
 * @param maxValue - Maximum allowed value
 * @returns Array of valid solutions
 */
function solveForFirst(op: Operator, b: number, result: number, maxValue: number): number[] {
  const solutions: number[] = [];
  
  switch (op) {
    case '+':
      // ? + B = R → ? = R - B
      if (result - b >= 1 && result - b <= maxValue) {
        solutions.push(result - b);
      }
      break;
    case '-':
      // ? - B = R → ? = R + B
      if (result + b >= 1 && result + b <= maxValue) {
        solutions.push(result + b);
      }
      break;
    case '×':
      // ? × B = R → ? = R ÷ B
      if (b !== 0 && result % b === 0) {
        const q = result / b;
        if (q >= 1 && q <= maxValue) {
          solutions.push(q);
        }
      }
      break;
    case '÷': {
      // ? ÷ B = R → ? = R × B
      const product = result * b;
      if (product >= 1 && product <= maxValue) {
        solutions.push(product);
      }
      break;
    }
  }
  
  return solutions;
}

/**
 * Solves A op ? = R for ?
 * 
 * @param a - The known first operand
 * @param op - The operator
 * @param result - The equation result
 * @param maxValue - Maximum allowed value
 * @returns Array of valid solutions
 */
function solveForSecond(a: number, op: Operator, result: number, maxValue: number): number[] {
  const solutions: number[] = [];
  
  switch (op) {
    case '+':
      // A + ? = R → ? = R - A
      if (result - a >= 1 && result - a <= maxValue) {
        solutions.push(result - a);
      }
      break;
    case '-':
      // A - ? = R → ? = A - R
      if (a - result >= 1 && a - result <= maxValue) {
        solutions.push(a - result);
      }
      break;
    case '×':
      // A × ? = R → ? = R ÷ A
      if (a !== 0 && result % a === 0) {
        const q = result / a;
        if (q >= 1 && q <= maxValue) {
          solutions.push(q);
        }
      }
      break;
    case '÷':
      // A ÷ ? = R → ? = A ÷ R
      if (result !== 0 && a % result === 0) {
        const q = a / result;
        if (q >= 1 && q <= maxValue) {
          solutions.push(q);
        }
      }
      break;
  }
  
  return solutions;
}

// ============================================
// EQUATION EVALUATION
// ============================================

/**
 * Evaluates if values with operators produce the expected result
 */
function evaluateToResult(values: number[], operators: Operator[], expectedResult: number): boolean {
  let result = values[0];
  
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const next = values[i + 1];
    
    switch (op) {
      case '+': result = result + next; break;
      case '-': result = result - next; break;
      case '×': result = result * next; break;
      case '÷':
        if (next === 0 || result % next !== 0) return false;
        result = result / next;
        break;
    }
  }
  
  return result === expectedResult;
}

// ============================================
// BROAD DOMAIN ESTIMATION
// ============================================

/**
 * Computes a broad domain when multiple unknowns exist
 * Uses result-based constraints to limit possibilities
 */
function computeBroadDomain(
  equation: Equation,
  _targetIndex: number,
  maxValue: number
): Set<number> {
  const result = equation.resultCell.value;
  const operators = equation.operatorCells.map(c => c.value);
  
  // Heuristic: if result is small, numbers are likely small
  // If operators include only + and -, max individual value ≤ result + max other values
  const hasMultiplication = operators.includes('×');
  const hasDivision = operators.includes('÷');
  
  let effectiveMax = maxValue;
  
  if (!hasMultiplication && !hasDivision) {
    // For +/- only, individual numbers are bounded by result + reasonable margin
    effectiveMax = Math.min(maxValue, result + 50);
  } else if (hasDivision) {
    // Division constrains divisors to be factors or reasonable values
    effectiveMax = Math.min(maxValue, result * 10);
  }
  
  return createFullDomain(effectiveMax);
}
