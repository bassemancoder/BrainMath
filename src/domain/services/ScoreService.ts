/**
 * Score Service - Pure functions for calculating game score
 * 
 * Score is normalized between 0-100, where 100 is the perfect initial score.
 * Score decreases based on:
 * - Time elapsed (per second)
 * - Failed validation attempts (penalizes brute-forcing)
 * - Hints used
 */

import { Score } from '@domain/constants';
import type { Grid, NumberCell } from '@domain/types';

/** Maximum normalized score (perfect score) */
const MAX_NORMALIZED_SCORE = 100;
/** Minimum normalized score */
const MIN_NORMALIZED_SCORE = 0;

/**
 * Count the number of enterable cells (cells where user can input numbers)
 * These are NumberCells with isFixed === false
 */
export function countEnterableCells(grid: Grid): number {
  let count = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell && cell.type === 'number' && !(cell as NumberCell).isFixed) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calculate the initial score based on the number of enterable cells
 * This is used internally to compute penalties, not displayed directly
 */
export function calculateInitialScore(enterableCellCount: number): number {
  return enterableCellCount * Score.INITIAL_SCORE_PER_CELL;
}

/**
 * Calculate the current normalized score (0-100)
 * @param initialScore - Starting score (from calculateInitialScore)
 * @param elapsedSeconds - Time elapsed in seconds
 * @param wrongAttemptCount - Number of failed validation attempts
 * @param undoCount - Number of undo actions used
 * @param hintCount - Number of hints used
 * @returns Normalized score between 0 and 100
 */
export function calculateScore(
  initialScore: number,
  elapsedSeconds: number,
  wrongAttemptCount: number,
  hintCount: number = 0
): number {
  // Handle edge case where initialScore is 0
  if (initialScore <= 0) {
    return MIN_NORMALIZED_SCORE;
  }

  const timePenalty = elapsedSeconds * Score.TIME_PENALTY_PER_SECOND;
  const wrongPenalty = wrongAttemptCount * Score.WRONG_ATTEMPT_PENALTY;
  const hintPenalty = hintCount * Score.HINT_PENALTY;
  
  const totalPenalty = timePenalty + wrongPenalty + hintPenalty;
  const rawScore = initialScore - totalPenalty;
  
  // Normalize to 0-100 scale
  const normalizedScore = (rawScore / initialScore) * MAX_NORMALIZED_SCORE;
  
  // Clamp between 0 and 100
  return Math.max(MIN_NORMALIZED_SCORE, Math.min(MAX_NORMALIZED_SCORE, Math.round(normalizedScore)));
}

/**
 * Get a breakdown of score penalties for display/debugging (normalized 0-100)
 */
export function getScoreBreakdown(
  initialScore: number,
  elapsedSeconds: number,
  wrongAttemptCount: number,
  hintCount: number = 0
): {
  initialScore: number;
  timePenalty: number;
  wrongPenalty: number;
  hintPenalty: number;
  totalPenalty: number;
  finalScore: number;
} {
  if (initialScore <= 0) {
    return {
      initialScore: MAX_NORMALIZED_SCORE,
      timePenalty: 0,
      wrongPenalty: 0,
      hintPenalty: 0,
      totalPenalty: 0,
      finalScore: MIN_NORMALIZED_SCORE,
    };
  }

  const timePenalty = elapsedSeconds * Score.TIME_PENALTY_PER_SECOND;
  const wrongPenalty = wrongAttemptCount * Score.WRONG_ATTEMPT_PENALTY;
  const hintPenalty = hintCount * Score.HINT_PENALTY;
  
  // Normalize penalties to percentage of initial score
  const normalizedTimePenalty = Math.round((timePenalty / initialScore) * MAX_NORMALIZED_SCORE);
  const normalizedWrongPenalty = Math.round((wrongPenalty / initialScore) * MAX_NORMALIZED_SCORE);
  const normalizedHintPenalty = Math.round((hintPenalty / initialScore) * MAX_NORMALIZED_SCORE);
  
  // Calculate total penalty from rounded values so math adds up for display
  const normalizedTotalPenalty = normalizedTimePenalty + normalizedWrongPenalty + normalizedHintPenalty;
  
  // Calculate final score from rounded penalties so it matches displayed math
  const finalScore = Math.max(MIN_NORMALIZED_SCORE, Math.min(MAX_NORMALIZED_SCORE, MAX_NORMALIZED_SCORE - normalizedTotalPenalty));
  
  return {
    initialScore: MAX_NORMALIZED_SCORE,
    timePenalty: normalizedTimePenalty,
    wrongPenalty: normalizedWrongPenalty,
    hintPenalty: normalizedHintPenalty,
    totalPenalty: normalizedTotalPenalty,
    finalScore,
  };
}
