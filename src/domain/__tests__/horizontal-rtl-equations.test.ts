/**
 * Test: Horizontal RTL equations (result on left)
 * 
 * Rule: Equations always evaluate TOWARD the equal sign.
 * For RTL equations like "15 = 12 + 7 - 10":
 * - Visually reads left-to-right as "15 = 12 + 7 - 10"
 * - Evaluates right-to-left: 10 - 7 = 3, then 3 + 12 = 15
 * - numberCells[0] should be RIGHTMOST (furthest from result)
 * - numberCells[last] should be LEFTMOST (nearest to result)
 */

import { describe, it, expect } from 'vitest';
import { generateCrosswordLayout } from '@domain/services/generator/CrosswordLayout';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { evaluateEquation } from '@domain/services/EquationService';
import type { Equation } from '@domain/types';

/**
 * Detects if a horizontal equation is RTL (result on the left side)
 */
function isRTLEquation(eq: Equation): boolean {
  if (eq.direction !== 'horizontal') return false;
  
  const resultCol = eq.resultCell.col;
  const firstNumCol = eq.numberCells[0].col;
  
  // RTL if result is to the LEFT of the first number cell
  return resultCol < firstNumCol;
}

/**
 * Checks that an RTL equation's numberCells are ordered correctly for evaluation
 * (rightmost first, leftmost last = evaluation toward the result on the left)
 */
function isCorrectlyOrdered(eq: Equation): boolean {
  if (eq.direction !== 'horizontal') return true;
  if (eq.numberCells.length < 2) return true;
  
  const resultCol = eq.resultCell.col;
  const firstNumCol = eq.numberCells[0].col;
  const lastNumCol = eq.numberCells[eq.numberCells.length - 1].col;
  
  const isResultOnLeft = resultCol < Math.min(firstNumCol, lastNumCol);
  const isResultOnRight = resultCol > Math.max(firstNumCol, lastNumCol);
  
  if (isResultOnLeft) {
    // RTL: Result on left, evaluate right→left, so numberCells[0] at highest col (rightmost)
    return firstNumCol > lastNumCol;
  } else if (isResultOnRight) {
    // LTR: Result on right, evaluate left→right, so numberCells[0] at lowest col (leftmost)
    return firstNumCol < lastNumCol;
  }
  
  return true;
}

describe('Horizontal RTL Equations', () => {
  it('generates some RTL equations (result on left)', async () => {
    // Try multiple seeds - RTL should appear in at least some
    const seeds = ['RTL1', 'RTL2', 'RTL3', 'TESTRTL', 'ABCDEF', 'ZZZZZ1', 'RANDOM'];
    const size = 10 as const;
    let foundRTL = false;
    
    for (const seed of seeds) {
      const rng = seededRandomAdapter.createSeededGenerator(seed);
      const grid = await generateCrosswordLayout(size, 3, rng);
      
      if (!grid) continue;
      
      const rtlEquations = grid.equations.filter(isRTLEquation);
      if (rtlEquations.length > 0) {
        foundRTL = true;
        break;
      }
    }
    
    expect(foundRTL).toBe(true);
  });

  it('RTL equations evaluate correctly toward the result', async () => {
    const seeds = ['RTL1', 'RTL2', 'RTL3', 'TESTRTL', 'ABCDEF'];
    const size = 10 as const;
    
    for (const seed of seeds) {
      const rng = seededRandomAdapter.createSeededGenerator(seed);
      const grid = await generateCrosswordLayout(size, 3, rng);
      
      if (!grid) continue;
      
      const horizontalEquations = grid.equations.filter(eq => eq.direction === 'horizontal');
      
      for (const eq of horizontalEquations) {
        // Check ordering is correct
        const ordered = isCorrectlyOrdered(eq);
        expect(ordered).toBe(true);
        
        // Check evaluation matches expected result
        const calculated = evaluateEquation(eq);
        expect(calculated).toBe(eq.resultCell.value);
      }
    }
  });

  it('RTL: numberCells[0] is rightmost (furthest from result)', async () => {
    const rng = seededRandomAdapter.createSeededGenerator('RTLORDER');
    const size = 10 as const;
    const grid = await generateCrosswordLayout(size, 3, rng);
    
    if (!grid) return;
    
    for (const eq of grid.equations) {
      if (eq.direction !== 'horizontal' || eq.numberCells.length < 2) continue;
      
      const resultCol = eq.resultCell.col;
      const firstNumCol = eq.numberCells[0].col;
      const lastNumCol = eq.numberCells[eq.numberCells.length - 1].col;
      
      // Distance from result
      const firstDistance = Math.abs(firstNumCol - resultCol);
      const lastDistance = Math.abs(lastNumCol - resultCol);
      
      // First numberCell should be furthest from result
      expect(firstDistance).toBeGreaterThanOrEqual(lastDistance);
    }
  });

  it('all horizontal equations evaluate correctly regardless of direction', async () => {
    // Comprehensive test across many seeds
    const seeds = Array.from({ length: 20 }, (_, i) => `SEED${i}`);
    const size = 10 as const;
    
    let totalEquations = 0;
    let totalRTL = 0;
    let totalLTR = 0;
    
    for (const seed of seeds) {
      const rng = seededRandomAdapter.createSeededGenerator(seed);
      const grid = await generateCrosswordLayout(size, 3, rng);
      
      if (!grid) continue;
      
      for (const eq of grid.equations) {
        if (eq.direction !== 'horizontal') continue;
        
        totalEquations++;
        
        if (isRTLEquation(eq)) {
          totalRTL++;
        } else {
          totalLTR++;
        }
        
        // Every equation should evaluate correctly
        const calculated = evaluateEquation(eq);
        expect(calculated).toBe(eq.resultCell.value);
      }
    }
    
    // We should have generated both types
    console.log(`Total horizontal equations: ${totalEquations}, LTR: ${totalLTR}, RTL: ${totalRTL}`);
  });
});
