// src/domain/services/generator/CrosswordLayout.ts

import type { Grid, Difficulty, RandomGenerator } from '@domain/types';
import { createEmptyGrid } from '../GridService';
import {
  getNumberRange,
  getOperatorsForDifficulty,
  getTargetEquationCount,
  getGridDimensions,
  getSharedResultProbability,
  getMinMultiplyDivideRatio,
  getDivisionConstraints,
} from '../DifficultySettings';
import { Generation } from '@domain/constants';
import type { LayoutConfig } from './LayoutContext';
import { LayoutState } from './LayoutContext';
import { yieldToBrowser } from './LayoutUtils';
import { placeInitialEquation } from './InitialPlacement';
import { tryPlaceVerticalResultExtension, tryPlaceResultAsInput } from './ResultExtensions';
import { tryPlaceConnectedEquation } from './ConnectedPlacements';

/**
 * Generates a crossword-style grid layout with CENTER-BASED BALANCED EXPANSION
 * ALL equations are guaranteed to be connected to each other.
 */
export async function generateCrosswordLayout(
  size: import('../DifficultySettings').GridSize, // Using explicit import as GridSize might conflict or be needed
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
  
  // Create Config and State
  const grid = createEmptyGrid(size, width, height);
  const config: LayoutConfig = {
    size,
    width,
    height,
    difficulty,
    targetEquations,
    minMultiplyDivideRatio,
    sharedResultProb,
    divisionConstraints,
    operators,
    numRange
  };
  
  const state = new LayoutState(grid);
  const ctx = { config, state, rng };
  
  // Step 1: Place first horizontal equation at CENTER
  if (!placeInitialEquation(ctx)) {
    return null;
  }
  
  // Step 2: Iteratively add connected equations
  let attempts = 0;
  let consecutiveFailures = 0;
  
  while (state.grid.equations.length < targetEquations && attempts < Generation.MAX_CROSSWORD_LAYOUT_ITERATIONS) {
    attempts++;
    
    // Yield to browser EVERY iteration to prevent freezing
    await yieldToBrowser();
    
    let placedThisIteration = false;
    
    // Occasionally try to place a shared result equation
    if (tryPlaceVerticalResultExtension(ctx)) {
      placedThisIteration = true;
    }
    
    // Try to place an equation using a result cell as input at ANY position
    if (tryPlaceResultAsInput(ctx)) {
      placedThisIteration = true;
    }
    
    // Try to place connecting from intersection points
    if (await tryPlaceConnectedEquation(ctx)) {
      placedThisIteration = true;
    }
    
    // Track consecutive failures for early termination
    if (!placedThisIteration) {
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
  if (state.grid.equations.length < minAcceptable) {
    return null;
  }
  
  return state.grid;
}
