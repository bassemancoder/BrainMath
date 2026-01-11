/**
 * GeneratorTypes - Shared types for puzzle generation
 */

import type { Operator } from '@domain/types';

// ============================================
// PROGRESS REPORTING
// ============================================

export interface GenerationProgress {
  phase: 'layout' | 'validation' | 'clues' | 'complete' | 'failed';
  attempt: number;
  maxAttempts: number;
  message: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

// ============================================
// EQUATION TYPES
// ============================================

/** Result of generating a 2-number equation */
export interface TwoNumberEquation {
  numbers: number[];
  operator: Operator;
  result: number;
}

/** Result of generating a multi-number equation (2, 3, or 4 numbers) */
export interface MultiNumberEquation {
  numbers: number[];
  operators: Operator[];
  result: number;
}

// ============================================
// LAYOUT TYPES  
// ============================================

/** Quadrant in the grid for balanced expansion */
export type Quadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Intersection point for placing connected equations */
export interface IntersectionPoint {
  row: number;
  col: number;
  value: number;
  canPlaceDown: boolean;
  canPlaceUp: boolean;
  canPlaceRight: boolean;
  canPlaceLeft: boolean;
  used: boolean;
  isResultCell?: boolean;
}

/** Result cell position for shared result placement */
export interface ResultCellPosition {
  row: number;
  col: number;
  value: number;
  used: boolean;
}
