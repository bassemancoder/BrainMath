// src/domain/services/generator/PlacementUtils.ts

import type { Operator } from '@domain/types';
import { hasMultiplyOrDivide } from './EquationGenerators';
import { getCellAt } from '../GridService';
import type { LayoutContext } from './LayoutContext';
import type { Grid } from '@domain/types';

/**
 * Check if we need to force × or ÷ for the next equation to meet the minimum ratio
 * We look ahead to see if we're falling behind on the target ratio
 */
export function shouldForceMultiplyDivide(ctx: LayoutContext): boolean {
  const { config, state } = ctx;
  const { minMultiplyDivideRatio, targetEquations } = config;
  
  if (minMultiplyDivideRatio <= 0) return false;
  
  const currentCount = state.grid.equations.length;
  const remaining = targetEquations - currentCount;
  
  // How many × or ÷ equations do we need to meet the ratio?
  const neededTotal = Math.ceil(targetEquations * minMultiplyDivideRatio);
  const stillNeeded = neededTotal - state.equationsWithMultDiv;
  
  // If we need more × or ÷ equations than we have remaining, force it
  if (stillNeeded > 0 && stillNeeded >= remaining) {
    return true;
  }
  
  // AGGRESSIVE: Also force if we're at 30%+ completion but have no × ÷ yet
  const completionRatio = currentCount / targetEquations;
  if (completionRatio >= 0.3 && state.equationsWithMultDiv === 0 && stillNeeded > 0) {
    return true;
  }
  
  // AGGRESSIVE: If we're at 50%+ completion and behind on ratio, start forcing
  const currentRatio = currentCount > 0 ? state.equationsWithMultDiv / currentCount : 0;
  if (completionRatio >= 0.5 && currentRatio < minMultiplyDivideRatio * 0.7 && stillNeeded > 0) {
    return true;
  }
  
  return false;
}

/**
 * Track an equation and update the counter if it has × or ÷
 */
export function trackEquationOperators(ctx: LayoutContext, ops: Operator[]): void {
  if (hasMultiplyOrDivide(ops)) {
    ctx.state.equationsWithMultDiv++;
  }
}

// Helper: Calculate vertical equation height (how many rows it spans)
export const getVerticalEquationHeight = (numNumbers: number) => numNumbers * 2;

// Helper: Check if we can place a vertical equation ending at a specific result position
export function canPlaceVerticalEndingAt(grid: Grid, resultRow: number, col: number, numNumbers: number): boolean {
  const startRow = resultRow - getVerticalEquationHeight(numNumbers);
  if (startRow < 0) return false;
  
  // Check all positions except the result cell (which already exists)
  for (let i = 0; i < numNumbers; i++) {
    const numRow = startRow + i * 2;
    const existing = getCellAt(grid, numRow, col);
    if (existing !== null) return false;
    
    // Check operator position (except after last number)
    if (i < numNumbers - 1) {
      const opRow = startRow + i * 2 + 1;
      const opExisting = getCellAt(grid, opRow, col);
      if (opExisting !== null) return false;
    }
  }
  
  // Check equals position
  const equalsRow = resultRow - 1;
  const equalsExisting = getCellAt(grid, equalsRow, col);
  if (equalsExisting !== null) return false;
  
  return true;
}
