/**
 * ValidateGameUseCase - Validates the current game state
 * Used for checking progress and showing hints
 */

import type { Grid, ValidationResult } from '@domain/types';
import { validateGrid, getIncorrectCells, checkWinCondition, getValidationSummary } from '@domain/services/ValidationService';
import { getHint } from '@domain/services/SolverService';

export interface ValidateGameInput {
  grid: Grid;
  solution: Grid;
}

export interface ValidateGameOutput {
  validation: ValidationResult;
  isWon: boolean;
  incorrectCells: Array<{ row: number; col: number; userValue: number; correctValue: number }>;
  summary: {
    correctCount: number;
    incorrectCount: number;
    incompleteCount: number;
  };
}

/**
 * Validates the current game state
 */
export function validateGame(input: ValidateGameInput): ValidateGameOutput {
  const { grid, solution } = input;
  
  const validation = validateGrid(grid);
  const isWon = validation.isComplete && checkWinCondition(grid, solution);
  const incorrectCells = getIncorrectCells(grid, solution);
  const summary = getValidationSummary(validation);
  
  return {
    validation,
    isWon,
    incorrectCells,
    summary,
  };
}

export interface GetHintInput {
  grid: Grid;
  solution: Grid;
}

export interface GetHintOutput {
  hasHint: boolean;
  hint?: {
    row: number;
    col: number;
    value: number;
  };
}

/**
 * Gets a hint for the next cell to fill
 */
export function getGameHint(input: GetHintInput): GetHintOutput {
  const { grid, solution } = input;
  
  const hint = getHint(grid, solution);
  
  if (hint) {
    return {
      hasHint: true,
      hint,
    };
  }
  
  return {
    hasHint: false,
  };
}
