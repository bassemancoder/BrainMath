/**
 * Domain Types for Brain Math Game
 * Crossword-style puzzle with max 3 numbers per equation
 * Pure type definitions with no dependencies
 */

// GridSize is defined in DifficultySettings.ts (centralized grid configuration)
import type { GridSize as GridSizeImport } from '@domain/services/DifficultySettings';
export type { GridSize } from '@domain/services/DifficultySettings';

// Local alias for use in this file
type GridSize = GridSizeImport;

// ============================================
// PRIMITIVE TYPES
// ============================================

/** Difficulty levels: 1=Easy, 2=Medium, 3=Hard */
export type Difficulty = 1 | 2 | 3;

/** Mathematical operators */
export type Operator = '+' | '-' | '×' | '÷';

/** Cell types in the grid */
export type CellType = 'number' | 'operator' | 'equals' | 'result' | 'empty';

// ============================================
// CELL TYPES
// ============================================

/** A cell containing a number (can be editable or fixed) */
export interface NumberCell {
  type: 'number';
  value: number | null; // null = empty (user must fill), positive integers
  isFixed: boolean; // true = pre-filled, user cannot change
  isUncertain?: boolean; // true = user marked as uncertain/maybe
  row: number;
  col: number;
}

/** A cell containing an operator (+, -, ×, ÷) */
export interface OperatorCell {
  type: 'operator';
  value: Operator;
  row: number;
  col: number;
}

/** A cell containing '=' sign */
export interface EqualsCell {
  type: 'equals';
  row: number;
  col: number;
}

/** A cell containing the result of an equation (always positive) */
export interface ResultCell {
  type: 'result';
  value: number; // The expected result, always >= 0
  row: number;
  col: number;
}

/** An empty cell (crossword-style gap) */
export interface EmptyCell {
  type: 'empty';
  row: number;
  col: number;
}

/** Union of all cell types */
export type Cell = NumberCell | OperatorCell | EqualsCell | ResultCell | EmptyCell;

// ============================================
// EQUATION TYPES
// ============================================

/** Direction of an equation */
export type EquationDirection = 'horizontal' | 'vertical';

/** 
 * A single equation in the crossword
 * Format: A op B = Result (2 operands) or A op B op C = Result (3 operands)
 * Max 3 numbers per equation, results are always positive
 */
export interface Equation {
  id: number;
  direction: EquationDirection;
  /** Number cells in this equation (2 or 3) */
  numberCells: NumberCell[];
  /** Operator cells (1 or 2) */
  operatorCells: OperatorCell[];
  /** The result cell */
  resultCell: ResultCell;
  /** Starting position */
  startRow: number;
  startCol: number;
}

/** Result of validating an equation */
export interface EquationValidation {
  equationId: number;
  isValid: boolean;
  isComplete: boolean;
  calculatedResult: number | null;
  expectedResult: number;
}

// ============================================
// CROSSWORD GRID TYPES
// ============================================

/**
 * The crossword-style game grid
 * Sparse grid where cells can be null (empty space)
 */
export interface Grid {
  /** Puzzle complexity (number of equations) */
  size: GridSize;
  /** 2D array of cells, null = empty space in crossword */
  cells: (Cell | null)[][];
  /** Grid dimensions */
  width: number;
  height: number;
  /** All equations in the puzzle */
  equations: Equation[];
}

// ============================================
// PUZZLE TYPES
// ============================================

/** A complete puzzle with its solution */
export interface Puzzle {
  grid: Grid;
  solution: Grid;
  hash: string;
  difficulty: Difficulty;
}

// ============================================
// HASH TYPES
// ============================================

/** Parsed hash information */
export interface ParsedHash {
  size: GridSize;
  difficulty: Difficulty;
  seed: string;
}

// ============================================
// VALIDATION TYPES
// ============================================

/** Error for a specific cell */
export interface CellError {
  row: number;
  col: number;
  message: string;
}

/** Full validation result */
export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: CellError[];
  equationResults: EquationValidation[];
}

// ============================================
// GAME STATE TYPES
// ============================================

/** Overall game status */
export type GameStatus = 'idle' | 'playing' | 'won';

/** Full game state */
export interface GameState {
  status: GameStatus;
  puzzle: Puzzle | null;
  userInputs: Map<string, number>; // key = "row,col", value = user's number
  selectedCell: { row: number; col: number } | null;
  errors: CellError[];
  timer: number; // seconds elapsed
  hash: string | null;
}

// ============================================
// RANDOM NUMBER GENERATOR TYPE
// ============================================

/** Interface for random number generator (for dependency injection) */
export interface RandomGenerator {
  /** Returns a random number between 0 (inclusive) and 1 (exclusive) */
  random(): number;
  /** Returns a random integer between min and max (inclusive) */
  int(min: number, max: number): number;
  /** Returns a random element from an array */
  pick<T>(array: T[]): T;
  /** Shuffles an array in place and returns it */
  shuffle<T>(array: T[]): T[];
}
