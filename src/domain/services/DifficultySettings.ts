/**
 * DifficultySettings - Centralized difficulty configuration
 * 
 * All difficulty-related settings in one place for easy review and tuning.
 */

import type { Difficulty, Operator } from '@domain/types';

// ============================================
// GRID SIZE
// ============================================

/** Valid puzzle sizes: Quick=5, Classic=10, Extended=15, Challenge=20, Marathon=30 */
export type GridSize = 5 | 10 | 15 | 20 | 30;

// ============================================
// NUMBER RANGES
// ============================================

export interface NumberRange {
  min: number;      // Minimum number that can appear in equations
  max: number;      // Maximum number that can appear in equations
  maxResult: number; // Maximum result value for equations
}

/**
 * Number ranges by difficulty level
 * Higher difficulty = larger numbers = harder mental math
 */
const NUMBER_RANGES: Record<Difficulty, Record<string, NumberRange>> = {
  // Easy: Simple single-digit math
  1: {
    default: { min: 1, max: 9, maxResult: 20 },
  },
  // Medium: Slightly larger numbers
  2: {
    default: { min: 1, max: 15, maxResult: 50 },
  },
  // Hard: Scale with grid size for progressive challenge
  3: {
    '5': { min: 1, max: 20, maxResult: 50 },
    '10': { min: 2, max: 30, maxResult: 100 },
    '15': { min: 5, max: 50, maxResult: 125 },
    '20': { min: 5, max: 75, maxResult: 150 },
    default: { min: 5, max: 50, maxResult: 150 },
  },
};

export function getNumberRange(difficulty: Difficulty, size: GridSize): NumberRange {
  const difficultyRanges = NUMBER_RANGES[difficulty];
  return difficultyRanges[String(size)] || difficultyRanges.default;
}

// ============================================
// DIVISION CONSTRAINTS
// ============================================

/**
 * Constraints for division operations to ensure mental-math friendly equations
 * Without these, division tends to produce result=1 (X÷X=1) due to probability
 */
export interface DivisionConstraints {
  minResult: number;   // Minimum quotient (avoid trivial result=1)
  maxResult: number;   // Maximum quotient (keep mental math manageable)
  minDivisor: number;  // Minimum divisor (avoid trivial ÷1)
}

/**
 * Division constraints by difficulty level
 * Easy/Medium: Friendly divisions with small quotients
 * Hard: Allow more flexibility including trivial divisions
 */
const DIVISION_CONSTRAINTS: Record<Difficulty, DivisionConstraints> = {
  1: { minResult: 1, maxResult: 10, minDivisor: 2 },  // Easy: no ÷1, no result=1
  2: { minResult: 2, maxResult: 12, minDivisor: 2 },  // Medium: slightly larger quotients
  3: { minResult: 2, maxResult: 15, minDivisor: 2 },  // Hard: allow trivial divisions
};

export function getDivisionConstraints(difficulty: Difficulty): DivisionConstraints {
  return DIVISION_CONSTRAINTS[difficulty] || DIVISION_CONSTRAINTS[1];
}

// ============================================
// OPERATORS
// ============================================

/**
 * Available operators by difficulty level
 * Easy: Addition only
 * Medium: Addition and subtraction
 * Hard: All four operations
 */
const OPERATORS_BY_DIFFICULTY: Record<Difficulty, Operator[]> = {
  1: ['+', '-'],                 // Easy: addition only
  2: ['+', '-', '×', '÷'],       // Medium: add and subtract
  3: ['+', '-', '×', '÷'],       // Hard: all operations
};

export function getOperatorsForDifficulty(difficulty: Difficulty): Operator[] {
  return OPERATORS_BY_DIFFICULTY[difficulty] || OPERATORS_BY_DIFFICULTY[1];
}

// ============================================
// CLUE REMOVAL (Puzzle Difficulty)
// ============================================

/**
 * Percentage of number cells to remove (make blank)
 * Higher percentage = harder puzzle
 */
const REMOVAL_PERCENTAGE: Record<Difficulty, number> = {
  1: 0.40, // Easy: remove 40% of numbers
  2: 0.55, // Medium: remove 55% of numbers
  3: 0.70, // Hard: remove 75% of numbers
};

export function getRemovalPercentage(difficulty: Difficulty): number {
  return REMOVAL_PERCENTAGE[difficulty] || REMOVAL_PERCENTAGE[1];
}

/**
 * Minimum cells to remove per equation
 * Ensures every equation has at least some blanks
 */
const MIN_REMOVALS_PER_EQUATION: Record<Difficulty, number> = {
  1: 1, // Easy: at least 1 blank per equation
  2: 1, // Medium: at least 1 blank per equation
  3: 2, // Hard: at least 2 blanks per equation (more deduction required)
};

export function getMinRemovalsPerEquation(difficulty: Difficulty): number {
  return MIN_REMOVALS_PER_EQUATION[difficulty] || MIN_REMOVALS_PER_EQUATION[1];
}

// ============================================
// EQUATION COMPLEXITY
// ============================================

/**
 * Equation complexity distribution by difficulty
 * Defines the percentage of equations with 2, 3, or 4 numbers
 * Higher difficulty = more complex equations with more numbers
 */
export interface EquationComplexity {
  twoNumbers: number;    // Percentage of 2-number equations (e.g., 3 + 5 = 8)
  threeNumbers: number;  // Percentage of 3-number equations (e.g., 3 + 5 - 2 = 6)
  fourNumbers: number;   // Percentage of 4-number equations (e.g., 3 + 5 - 2 + 1 = 7)
  sharedResultProbability: number; // Probability that an equation shares its result cell with another
  maxZeroRevealedEquations: number; // Max percentage of equations allowed to have 0 revealed cells
  minMultiplyDivideRatio: number; // Min percentage of equations that must contain × or ÷
}

const EQUATION_COMPLEXITY: Record<Difficulty, EquationComplexity> = {
  1: {
    twoNumbers: 1.0,    // Easy: 100% simple 2-number equations
    threeNumbers: 0.0,
    fourNumbers: 0.0,
    sharedResultProbability: 0.0, // Easy: no shared results
    maxZeroRevealedEquations: 0.0, // Easy: no equations with all blanks
    minMultiplyDivideRatio: 0.0, // Easy: no × ÷ required (only + -)
  },
  2: {
    twoNumbers: 0.6,    // Medium: 60% two-number, 40% three-number
    threeNumbers: 0.4,
    fourNumbers: 0.0,
    sharedResultProbability: 0.2, // Medium: 20% chance of shared results
    maxZeroRevealedEquations: 0.1, // Medium: max 10% of equations can have all blanks
    minMultiplyDivideRatio: 0.3, // Medium: at least 30% of equations must have × or ÷
  },
  3: {
    twoNumbers: 0.4,    // Hard: 40% two-number, 55% three-number, 5% four-number
    threeNumbers: 0.5,
    fourNumbers: 0.1,
    sharedResultProbability: 0.5, // Hard: 40% chance of shared results
    maxZeroRevealedEquations: 0.2, // Hard: max 20% of equations can have all blanks
    minMultiplyDivideRatio: 0.5, // Hard: at least 50% of equations must have × or ÷
  },
};

export function getEquationComplexity(difficulty: Difficulty): EquationComplexity {
  return EQUATION_COMPLEXITY[difficulty] || EQUATION_COMPLEXITY[1];
}

/**
 * Gets the probability of using shared result cells at this difficulty
 */
export function getSharedResultProbability(difficulty: Difficulty): number {
  return getEquationComplexity(difficulty).sharedResultProbability;
}

/**
 * Gets the max percentage of equations allowed to have 0 revealed cells
 */
export function getMaxZeroRevealedEquations(difficulty: Difficulty): number {
  return getEquationComplexity(difficulty).maxZeroRevealedEquations;
}

/**
 * Gets the minimum ratio of equations that must contain × or ÷
 */
export function getMinMultiplyDivideRatio(difficulty: Difficulty): number {
  return getEquationComplexity(difficulty).minMultiplyDivideRatio;
}

/**
 * Determines the number of operands for an equation based on difficulty
 * Uses random selection weighted by the complexity percentages
 */
export function pickEquationSize(difficulty: Difficulty, random: number): 2 | 3 | 4 {
  const complexity = getEquationComplexity(difficulty);
  
  if (random < complexity.twoNumbers) {
    return 2;
  } else if (random < complexity.twoNumbers + complexity.threeNumbers) {
    return 3;
  } else {
    return 4;
  }
}

// ============================================
// EQUATION COUNTS
// ============================================

/**
 * Target number of equations based on grid size and difficulty
 * More equations = more complex interconnected puzzle
 * 
 * Aim to fill the grid densely with equations
 */
export function getTargetEquationCount(size: GridSize, difficulty: Difficulty): number {
  // More aggressive equation counts for denser grids
  // Base: roughly 1 equation per row of the grid
  const baseEquations = size;
  
  // Difficulty multiplier: Easy 80%, Medium 100%, Hard 120%
  const difficultyMultiplier = 0.6 + (difficulty * 0.4);
  
  const targetEquations = Math.floor(baseEquations * difficultyMultiplier);
  
  return Math.max(4, targetEquations);
}

// ============================================
// GRID DIMENSIONS
// ============================================

/**
 * Grid dimensions based on size
 */
export function getGridDimensions(size: GridSize): { width: number; height: number } {
  const verticalHeight = 5; // 2 numbers + 1 op + 1 equals + 1 result
  return {
    width: Math.max(size, 12),
    height: Math.max(size, verticalHeight * 4),
  };
}

// ============================================
// DIFFICULTY LABELS
// ============================================

export const DIFFICULTIES: Difficulty[] = [1, 2, 3];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};

export function getDifficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

// ============================================
// SIZE LABELS AND ARRAYS
// ============================================

/** All valid grid sizes in order */
export const GRID_SIZES: GridSize[] = [5, 10, 15, 20, 30];

export const SIZE_LABELS: Record<GridSize, string> = {
  5: 'Quick (5×5)',
  10: 'Classic (10×10)',
  15: 'Extended (15×15)',
  20: 'Challenge (20×20)',
  30: 'Marathon (30×30)',
};

export function getGridSizeLabel(size: GridSize): string {
  return SIZE_LABELS[size];
}

/** Grid size to hash code mapping */
export const SIZE_TO_CODE: Record<GridSize, string> = {
  5: 'A',
  10: 'B',
  15: 'C',
  20: 'E',
  30: 'D',
};

/** Hash code to grid size mapping */
export const CODE_TO_SIZE: Record<string, GridSize> = {
  'A': 5,
  'B': 10,
  'C': 15,
  'E': 20,
  'D': 30,
};

// ============================================
// SUMMARY FOR DEBUGGING
// ============================================

export function getDifficultyInfo(difficulty: Difficulty, size: GridSize) {
  return {
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty],
    size,
    sizeLabel: SIZE_LABELS[size],
    numberRange: getNumberRange(difficulty, size),
    operators: getOperatorsForDifficulty(difficulty),
    divisionConstraints: getDivisionConstraints(difficulty),
    equationComplexity: getEquationComplexity(difficulty),
    removalPercentage: getRemovalPercentage(difficulty),
    minRemovalsPerEquation: getMinRemovalsPerEquation(difficulty),
    targetEquations: getTargetEquationCount(size, difficulty),
    gridDimensions: getGridDimensions(size),
  };
}
