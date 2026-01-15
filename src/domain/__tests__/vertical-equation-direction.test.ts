/**
 * Regression test: Vertical equations must evaluate toward the result
 * 
 * Bug: Vertical equations with result at TOP were storing numberCells in
 * visual order (top→bottom) instead of calculation order (bottom→top).
 * This caused equations like "21 + 27 + 6 - 2 = 52" to evaluate incorrectly.
 * 
 * Rule: numberCells[0] should be FURTHEST from result, numberCells[last] NEAREST.
 */

import { describe, it, expect } from 'vitest';
import { generateCrosswordLayout } from '@domain/services/generator/CrosswordLayout';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { evaluateEquation } from '@domain/services/EquationService';
import type { Equation } from '@domain/types';

/**
 * Checks that a vertical equation's numberCells are ordered correctly for evaluation
 */
function isCorrectlyOrdered(eq: Equation): boolean {
  if (eq.direction !== 'vertical') return true;
  if (eq.numberCells.length < 2) return true;
  
  const resultRow = eq.resultCell.row;
  const firstNumRow = eq.numberCells[0].row;
  const lastNumRow = eq.numberCells[eq.numberCells.length - 1].row;
  
  const isResultAtTop = resultRow < Math.min(firstNumRow, lastNumRow);
  const isResultAtBottom = resultRow > Math.max(firstNumRow, lastNumRow);
  
  if (isResultAtTop) {
    // Result at top: evaluate bottom→top, so numberCells[0] at highest row
    return firstNumRow > lastNumRow;
  } else if (isResultAtBottom) {
    // Result at bottom: evaluate top→bottom, so numberCells[0] at lowest row
    return firstNumRow < lastNumRow;
  }
  
  return true; // Result in middle (shared cell case)
}

describe('Vertical Equation Direction', () => {
  it('evaluates vertical equations toward the result (regression test)', async () => {
    // Test multiple seeds to catch edge cases
    const seeds = ['TEST1', 'TEST2', 'TEST3', 'ABCDE', 'ZZZZZ'];
    const size = 10 as const; // Valid GridSize
    
    for (const seed of seeds) {
      const rng = seededRandomAdapter.createSeededGenerator(seed);
      const grid = await generateCrosswordLayout(size, 3, rng);
      
      if (!grid) continue; // Some seeds may not produce valid grids
      
      const verticalEquations = grid.equations.filter(eq => eq.direction === 'vertical');
      
      for (const eq of verticalEquations) {
        // Check ordering is correct
        expect(isCorrectlyOrdered(eq)).toBe(true);
        
        // Check evaluation matches expected result
        const calculated = evaluateEquation(eq);
        expect(calculated).toBe(eq.resultCell.value);
      }
    }
  });

  it('numberCells order: furthest from result first, nearest last', async () => {
    const rng = seededRandomAdapter.createSeededGenerator('ORDERTEST');
    const size = 10 as const;
    const grid = await generateCrosswordLayout(size, 3, rng);
    
    if (!grid) return;
    
    for (const eq of grid.equations) {
      if (eq.direction !== 'vertical' || eq.numberCells.length < 2) continue;
      
      const resultRow = eq.resultCell.row;
      const firstNumRow = eq.numberCells[0].row;
      const lastNumRow = eq.numberCells[eq.numberCells.length - 1].row;
      
      // Distance from result
      const firstDistance = Math.abs(firstNumRow - resultRow);
      const lastDistance = Math.abs(lastNumRow - resultRow);
      
      // First numberCell should be furthest from result
      expect(firstDistance).toBeGreaterThanOrEqual(lastDistance);
    }
  });
});
