/**
 * EquationGenerators - Pure equation generation functions
 * 
 * Generates valid equations with various constraints:
 * - 2, 3, or 4 numbers
 * - Fixed first number (for intersections)
 * - Fixed value at any position (for shared result inputs)
 * - Target result (for shared result outputs)
 * 
 * All results are positive integers within the specified range.
 */

import type { Operator, RandomGenerator } from '@domain/types';
import { applyOperator } from '../EquationService';
import { type NumberRange, type DivisionConstraints } from '../DifficultySettings';
import { Generation } from '@domain/constants';
import type { TwoNumberEquation, MultiNumberEquation } from './GeneratorTypes';

// ============================================
// DIVISION PAIR CACHE
// ============================================

/**
 * Pre-computed valid division pairs for fast equation generation
 * Key format: "min-max-minResult-maxResult-minDivisor"
 * Value: Array of [dividend, divisor, quotient] tuples
 */
const divisionPairCache = new Map<string, [number, number, number][]>();

/**
 * Get or compute valid division pairs for given constraints
 * Caches results for reuse across generation attempts
 */
function getValidDivisionPairs(
  numRange: { min: number; max: number; maxResult: number },
  constraints: DivisionConstraints | undefined
): [number, number, number][] {
  const key = constraints 
    ? `${numRange.min}-${numRange.max}-${constraints.minResult}-${constraints.maxResult}-${constraints.minDivisor}`
    : `${numRange.min}-${numRange.max}-noconstrain`;
  
  const cached = divisionPairCache.get(key);
  if (cached) return cached;
  
  const pairs: [number, number, number][] = [];
  
  // Generate all valid division pairs within range
  for (let divisor = numRange.min; divisor <= numRange.max; divisor++) {
    if (constraints && divisor < constraints.minDivisor) continue;
    
    for (let quotient = 1; quotient <= numRange.maxResult; quotient++) {
      if (constraints) {
        if (quotient < constraints.minResult) continue;
        if (quotient > constraints.maxResult) continue;
      }
      
      const dividend = divisor * quotient;
      if (dividend < numRange.min || dividend > numRange.maxResult) continue;
      
      pairs.push([dividend, divisor, quotient]);
    }
  }
  
  divisionPairCache.set(key, pairs);
  return pairs;
}

/**
 * Pick a random valid division from pre-computed pairs
 * Returns null if no valid pairs exist
 */
function pickRandomDivision(
  rng: RandomGenerator,
  numRange: { min: number; max: number; maxResult: number },
  constraints: DivisionConstraints | undefined
): { dividend: number; divisor: number; quotient: number } | null {
  const pairs = getValidDivisionPairs(numRange, constraints);
  if (pairs.length === 0) return null;
  
  const [dividend, divisor, quotient] = rng.pick(pairs);
  return { dividend, divisor, quotient };
}

// ============================================
// OPERATOR HELPERS
// ============================================

/** The "complex" operators that require more mental math */
const COMPLEX_OPERATORS: Operator[] = ['×', '÷'];

/**
 * Checks if an equation contains at least one × or ÷ operator
 */
export function hasMultiplyOrDivide(operators: Operator[]): boolean {
  return operators.some(op => COMPLEX_OPERATORS.includes(op));
}

/**
 * Filters operators to only include × and ÷ (for forcing complex operations)
 */
export function getComplexOperatorsOnly(operators: Operator[]): Operator[] {
  return operators.filter(op => COMPLEX_OPERATORS.includes(op));
}

// ============================================
// EQUATION VALIDATION
// ============================================

/**
 * Checks if an equation has both multiplication and division (not allowed)
 */
function hasMixedMultDiv(operators: Operator[]): boolean {
  const hasMult = operators.includes('×');
  const hasDiv = operators.includes('÷');
  return hasMult && hasDiv;
}

/**
 * Checks if a multiplication involves two double-digit numbers (not allowed)
 * Returns true if violation found
 */
function hasDoubleDigitMultiplication(numbers: number[], operators: Operator[]): boolean {
  for (let i = 0; i < operators.length; i++) {
    if (operators[i] === '×') {
      const left = i === 0 ? numbers[0] : numbers[i];
      const right = numbers[i + 1];
      if (left >= 10 && right >= 10) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validates a division operation against constraints
 * Returns true if the division is valid (meets all constraints)
 */
function isValidDivision(
  divisor: number,
  quotient: number,
  constraints: DivisionConstraints | undefined
): boolean {
  if (!constraints) return true; // No constraints = always valid
  
  if (divisor < constraints.minDivisor) return false;
  if (quotient < constraints.minResult) return false;
  if (quotient > constraints.maxResult) return false;
  
  return true;
}

// ============================================
// BASIC EQUATION GENERATION
// ============================================

/**
 * Generates a valid equation with 2 numbers (A op B = R)
 * Ensures result is positive and within range
 * Uses pre-computed division pairs for faster division generation
 */
export function generate2NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: { min: number; max: number; maxResult: number } = { min: 1, max: 9, maxResult: 99 },
  divisionConstraints?: DivisionConstraints
): TwoNumberEquation | null {
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_2_NUMBER_EQUATION; attempt++) {
    const operator = rng.pick(operators);
    
    // For division, use pre-computed valid pairs
    if (operator === '÷') {
      const div = pickRandomDivision(rng, numRange, divisionConstraints);
      if (div) {
        return { numbers: [div.dividend, div.divisor], operator, result: div.quotient };
      }
      continue;
    }
    
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    
    // Check for double-digit multiplication
    if (operator === '×' && a >= Generation.DOUBLE_DIGIT_THRESHOLD && b >= Generation.DOUBLE_DIGIT_THRESHOLD) continue;
    
    const result = applyOperator(a, operator, b);
    
    // Result must be positive and within range
    if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
      return { numbers: [a, b], operator, result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with 3 numbers (A op B op C = R)
 * Ensures intermediate and final results are positive
 */
export function generate3NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 },
  divisionConstraints?: DivisionConstraints
): MultiNumberEquation | null {
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_3_NUMBER_EQUATION; attempt++) {
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    const c = rng.int(numRange.min, numRange.max);
    const op1 = rng.pick(operators);
    const op2 = rng.pick(operators);
    
    const ops = [op1, op2];
    const nums = [a, b, c];
    
    // No mixing × and ÷ in same equation
    if (hasMixedMultDiv(ops)) continue;
    
    // No double-digit multiplication
    if (hasDoubleDigitMultiplication(nums, ops)) continue;
    
    // Evaluate left to right
    const intermediate = applyOperator(a, op1, b);
    if (intermediate === null || intermediate < 0) continue;
    
    // Intermediate must stay within maxResult to avoid large numbers in puzzle
    if (intermediate > numRange.maxResult) continue;
    
    // Validate first division
    if (op1 === '÷' && !isValidDivision(b, intermediate, divisionConstraints)) continue;
    
    // Check intermediate × c for double-digit multiplication
    if (op2 === '×' && intermediate >= 10 && c >= 10) continue;
    
    const result = applyOperator(intermediate, op2, c);
    
    // Result must be positive and within range
    if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
      // Validate second division
      if (op2 === '÷' && !isValidDivision(c, result, divisionConstraints)) continue;
      
      return { numbers: [a, b, c], operators: [op1, op2], result };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with 4 numbers (A op B op C op D = R)
 * Ensures all intermediate and final results are positive
 */
export function generate4NumberEquation(
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 },
  divisionConstraints?: DivisionConstraints
): MultiNumberEquation | null {
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_4_NUMBER_EQUATION; attempt++) {
    const a = rng.int(numRange.min, numRange.max);
    const b = rng.int(numRange.min, numRange.max);
    const c = rng.int(numRange.min, numRange.max);
    const d = rng.int(numRange.min, numRange.max);
    const op1 = rng.pick(operators);
    const op2 = rng.pick(operators);
    const op3 = rng.pick(operators);
    
    const ops = [op1, op2, op3];
    const nums = [a, b, c, d];
    
    // No mixing × and ÷ in same equation
    if (hasMixedMultDiv(ops)) continue;
    
    // No double-digit multiplication
    if (hasDoubleDigitMultiplication(nums, ops)) continue;
    
    // Evaluate left to right
    const inter1 = applyOperator(a, op1, b);
    if (inter1 === null || inter1 < 0) continue;
    
    // Intermediate must stay within maxResult to avoid large numbers in puzzle
    if (inter1 > numRange.maxResult) continue;
    
    // Validate first division
    if (op1 === '÷' && !isValidDivision(b, inter1, divisionConstraints)) continue;
    
    // Check intermediate × c for double-digit multiplication
    if (op2 === '×' && inter1 >= 10 && c >= 10) continue;
    
    const inter2 = applyOperator(inter1, op2, c);
    if (inter2 === null || inter2 < 0) continue;
    
    // Intermediate must stay within maxResult to avoid large numbers in puzzle
    if (inter2 > numRange.maxResult) continue;
    
    // Validate second division
    if (op2 === '÷' && !isValidDivision(c, inter2, divisionConstraints)) continue;
    
    // Check intermediate × d for double-digit multiplication
    if (op3 === '×' && inter2 >= 10 && d >= 10) continue;
    
    const result = applyOperator(inter2, op3, d);
    
    // Result must be positive and within range (including min)
    if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
      // Validate third division
      if (op3 === '÷' && !isValidDivision(d, result, divisionConstraints)) continue;
      
      return { numbers: [a, b, c, d], operators: [op1, op2, op3], result };
    }
  }
  
  return null;
}

// ============================================
// CONSTRAINED EQUATION GENERATION
// ============================================

/**
 * Generates a valid equation with a fixed first number (for intersections)
 * Supports 2, 3, or 4 number equations based on size parameter
 * @param forceMultiplyDivide If true, at least one operator must be × or ÷
 */
export function generateEquationWithFirst(
  firstNumber: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 },
  forceMultiplyDivide: boolean = false,
  divisionConstraints?: DivisionConstraints
): MultiNumberEquation | null {
  // If the first number is below the minimum for this difficulty, we can't use it
  if (firstNumber < numRange.min) return null;
  
  // If forcing multiply/divide, filter operators (but only if complex operators are available)
  const complexOps = getComplexOperatorsOnly(operators);
  const canForce = forceMultiplyDivide && complexOps.length > 0;
  
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_EQUATION_WITH_FIRST; attempt++) {
    if (equationSize === 2) {
      const b = rng.int(numRange.min, numRange.max);
      // If forcing, pick from complex operators; otherwise pick from all
      const op = canForce ? rng.pick(complexOps) : rng.pick(operators);
      
      // Check for double-digit multiplication
      if (op === '×' && firstNumber >= Generation.DOUBLE_DIGIT_THRESHOLD && b >= Generation.DOUBLE_DIGIT_THRESHOLD) continue;
      
      const result = applyOperator(firstNumber, op, b);
      
      if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
        // Validate division constraints
        if (op === '÷' && !isValidDivision(b, result, divisionConstraints)) continue;
        
        return { numbers: [firstNumber, b], operators: [op], result };
      }
    } else if (equationSize === 3) {
      const b = rng.int(numRange.min, numRange.max);
      const c = rng.int(numRange.min, numRange.max);
      
      let op1: Operator, op2: Operator;
      if (canForce) {
        // At least one must be complex - randomly decide which position
        if (rng.random() < 0.5) {
          op1 = rng.pick(complexOps);
          op2 = rng.pick(operators);
        } else {
          op1 = rng.pick(operators);
          op2 = rng.pick(complexOps);
        }
      } else {
        op1 = rng.pick(operators);
        op2 = rng.pick(operators);
      }
      
      const ops = [op1, op2];
      const nums = [firstNumber, b, c];
      
      // No mixing × and ÷ in same equation
      if (hasMixedMultDiv(ops)) continue;
      
      // No double-digit multiplication
      if (hasDoubleDigitMultiplication(nums, ops)) continue;
      
      const inter = applyOperator(firstNumber, op1, b);
      if (inter === null || inter < 0) continue;
      
      // Validate first division
      if (op1 === '÷' && !isValidDivision(b, inter, divisionConstraints)) continue;
      
      // Check intermediate × c for double-digit multiplication
      if (op2 === '×' && inter >= 10 && c >= 10) continue;
      
      const result = applyOperator(inter, op2, c);
      if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
        // Validate second division
        if (op2 === '÷' && !isValidDivision(c, result, divisionConstraints)) continue;
        
        return { numbers: [firstNumber, b, c], operators: [op1, op2], result };
      }
    } else {
      // 4 numbers
      const b = rng.int(numRange.min, numRange.max);
      const c = rng.int(numRange.min, numRange.max);
      const d = rng.int(numRange.min, numRange.max);
      
      let op1: Operator, op2: Operator, op3: Operator;
      if (canForce) {
        // At least one must be complex - randomly pick which position
        const forcePosition = rng.int(0, 2);
        op1 = forcePosition === 0 ? rng.pick(complexOps) : rng.pick(operators);
        op2 = forcePosition === 1 ? rng.pick(complexOps) : rng.pick(operators);
        op3 = forcePosition === 2 ? rng.pick(complexOps) : rng.pick(operators);
      } else {
        op1 = rng.pick(operators);
        op2 = rng.pick(operators);
        op3 = rng.pick(operators);
      }
      
      const ops = [op1, op2, op3];
      const nums = [firstNumber, b, c, d];
      
      // No mixing × and ÷ in same equation
      if (hasMixedMultDiv(ops)) continue;
      
      // No double-digit multiplication
      if (hasDoubleDigitMultiplication(nums, ops)) continue;
      
      const inter1 = applyOperator(firstNumber, op1, b);
      if (inter1 === null || inter1 < 0) continue;
      
      // Validate first division
      if (op1 === '÷' && !isValidDivision(b, inter1, divisionConstraints)) continue;
      
      // Check intermediate × c for double-digit multiplication
      if (op2 === '×' && inter1 >= 10 && c >= 10) continue;
      
      const inter2 = applyOperator(inter1, op2, c);
      if (inter2 === null || inter2 < 0) continue;
      
      // Validate second division
      if (op2 === '÷' && !isValidDivision(c, inter2, divisionConstraints)) continue;
      
      // Check intermediate × d for double-digit multiplication
      if (op3 === '×' && inter2 >= 10 && d >= 10) continue;
      
      const result = applyOperator(inter2, op3, d);
      if (result !== null && result >= numRange.min && result <= numRange.maxResult) {
        // Validate third division
        if (op3 === '÷' && !isValidDivision(d, result, divisionConstraints)) continue;
        
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
 * @param forceMultiplyDivide If true, at least one operator must be × or ÷
 */
export function generateEquationWithValueAt(
  fixedValue: number,
  position: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 },
  forceMultiplyDivide: boolean = false,
  divisionConstraints?: DivisionConstraints
): MultiNumberEquation | null {
  if (position >= equationSize) return null;
  
  // If the fixed value is below the minimum for this difficulty, we can't use it
  if (fixedValue < numRange.min) return null;
  
  // If forcing multiply/divide, filter operators (but only if complex operators are available)
  const complexOps = getComplexOperatorsOnly(operators);
  const canForce = forceMultiplyDivide && complexOps.length > 0;
  
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_EQUATION_WITH_VALUE_AT; attempt++) {
    // Generate random numbers for each position
    const numbers: number[] = [];
    for (let i = 0; i < equationSize; i++) {
      if (i === position) {
        numbers.push(fixedValue);
      } else {
        numbers.push(rng.int(numRange.min, numRange.max));
      }
    }
    
    // Generate operators
    const ops: Operator[] = [];
    const numOps = equationSize - 1;
    
    if (canForce) {
      // At least one operator must be complex
      const forcePosition = rng.int(0, numOps - 1);
      for (let i = 0; i < numOps; i++) {
        ops.push(i === forcePosition ? rng.pick(complexOps) : rng.pick(operators));
      }
    } else {
      for (let i = 0; i < numOps; i++) {
        ops.push(rng.pick(operators));
      }
    }
    
    // No mixing × and ÷ in same equation
    if (hasMixedMultDiv(ops)) continue;
    
    // No double-digit multiplication
    if (hasDoubleDigitMultiplication(numbers, ops)) continue;
    
    // Evaluate left to right with division validation
    let current = numbers[0];
    let valid = true;
    
    for (let i = 0; i < ops.length; i++) {
      // Check intermediate × next for double-digit multiplication
      if (ops[i] === '×' && current >= 10 && numbers[i + 1] >= 10) {
        valid = false;
        break;
      }
      
      const next = applyOperator(current, ops[i], numbers[i + 1]);
      if (next === null || next < 0) {
        valid = false;
        break;
      }
      
      // Intermediate results must stay within maxResult to avoid large numbers
      // (skip this check for the final result which is checked separately)
      if (i < ops.length - 1 && next > numRange.maxResult) {
        valid = false;
        break;
      }
      
      // Validate division constraints
      if (ops[i] === '÷' && !isValidDivision(numbers[i + 1], next, divisionConstraints)) {
        valid = false;
        break;
      }
      
      current = next;
    }
    
    if (valid && current > 0 && current >= numRange.min && current <= numRange.maxResult) {
      return { numbers, operators: ops, result: current };
    }
  }
  
  return null;
}

/**
 * Generates a valid equation with a specific target result
 * Supports 2, 3, or 4 number equations based on size parameter
 */
export function generateEquationWithResult(
  targetResult: number,
  equationSize: 2 | 3 | 4,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: NumberRange = { min: 1, max: 9, maxResult: 99 },
  divisionConstraints?: DivisionConstraints
): MultiNumberEquation | null {
  // If the target result is below the minimum for this difficulty, we can't use it
  if (targetResult < numRange.min) return null;
  
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_EQUATION_WITH_RESULT; attempt++) {
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
        // Check for double-digit multiplication
        if (op === '×' && a >= 10 && b >= 10) continue;
        
        // Validate division constraints
        if (op === '÷' && !isValidDivision(b, targetResult, divisionConstraints)) continue;
        
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
      
      const ops = [op1, op2];
      
      // No mixing × and ÷ in same equation
      if (hasMixedMultDiv(ops)) continue;
      
      // Check first multiplication for double-digit
      if (op1 === '×' && a >= 10 && b >= 10) continue;
      
      const inter = applyOperator(a, op1, b);
      if (inter === null || inter < 0) continue;
      
      // Intermediate must stay within maxResult to avoid large numbers in puzzle
      if (inter > numRange.maxResult) continue;
      
      // Validate first division
      if (op1 === '÷' && !isValidDivision(b, inter, divisionConstraints)) continue;
      
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
        // Check intermediate × c for double-digit multiplication
        if (op2 === '×' && inter >= 10 && c >= 10) continue;
        
        // Validate second division
        if (op2 === '÷' && !isValidDivision(c, targetResult, divisionConstraints)) continue;
        
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
      
      const ops = [op1, op2, op3];
      
      // No mixing × and ÷ in same equation
      if (hasMixedMultDiv(ops)) continue;
      
      // Check first multiplication for double-digit
      if (op1 === '×' && a >= 10 && b >= 10) continue;
      
      const inter1 = applyOperator(a, op1, b);
      if (inter1 === null || inter1 < 0) continue;
      
      // Intermediate must stay within maxResult to avoid large numbers in puzzle
      if (inter1 > numRange.maxResult) continue;
      
      // Validate first division
      if (op1 === '÷' && !isValidDivision(b, inter1, divisionConstraints)) continue;
      
      // Check intermediate × c for double-digit multiplication
      if (op2 === '×' && inter1 >= 10 && c >= 10) continue;
      
      const inter2 = applyOperator(inter1, op2, c);
      if (inter2 === null || inter2 < 0) continue;
      
      // Intermediate must stay within maxResult to avoid large numbers in puzzle
      if (inter2 > numRange.maxResult) continue;
      
      // Validate second division
      if (op2 === '÷' && !isValidDivision(c, inter2, divisionConstraints)) continue;
      
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
        // Check intermediate × d for double-digit multiplication
        if (op3 === '×' && inter2 >= 10 && d >= 10) continue;
        
        // Validate third division
        if (op3 === '÷' && !isValidDivision(d, targetResult, divisionConstraints)) continue;
        
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
export function generate2NumberEquationWithFirst(
  firstNumber: number,
  operators: Operator[],
  rng: RandomGenerator,
  numRange: { min: number; max: number; maxResult: number } = { min: 1, max: 9, maxResult: 99 }
): TwoNumberEquation | null {
  for (let attempt = 0; attempt < Generation.MAX_ATTEMPTS_2_NUMBER_WITH_FIRST; attempt++) {
    const b = rng.int(numRange.min, numRange.max);
    const operator = rng.pick(operators);
    
    // Check for double-digit multiplication
    if (operator === '×' && firstNumber >= Generation.DOUBLE_DIGIT_THRESHOLD && b >= Generation.DOUBLE_DIGIT_THRESHOLD) continue;
    
    const result = applyOperator(firstNumber, operator, b);
    
    if (result !== null && result > 0 && result <= numRange.maxResult) {
      return { numbers: [firstNumber, b], operator, result };
    }
  }
  
  return null;
}
