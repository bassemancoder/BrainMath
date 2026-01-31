/**
 * Tests for ScoreService - score calculation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInitialScore,
  calculateScore,
  getScoreBreakdown,
  countEnterableCells,
} from '@domain/services/ScoreService';
import type { Grid, NumberCell } from '@domain/types';

// Helper to create a mock grid with a given number of enterable cells
function createMockGrid(enterableCellCount: number, fixedCellCount: number = 0): Grid {
  const cells: (NumberCell | null)[][] = [[]];
  
  for (let i = 0; i < enterableCellCount; i++) {
    cells[0].push({
      type: 'number',
      value: null,
      isFixed: false,
      row: 0,
      col: i,
    });
  }
  
  for (let i = 0; i < fixedCellCount; i++) {
    cells[0].push({
      type: 'number',
      value: i + 1,
      isFixed: true,
      row: 0,
      col: enterableCellCount + i,
    });
  }
  
  return {
    size: 10,
    width: enterableCellCount + fixedCellCount,
    height: 1,
    cells,
    equations: [],
  };
}

describe('ScoreService', () => {
  describe('countEnterableCells', () => {
    it('counts only non-fixed number cells', () => {
      const grid = createMockGrid(5, 3);
      expect(countEnterableCells(grid)).toBe(5);
    });

    it('returns 0 for grid with only fixed cells', () => {
      const grid = createMockGrid(0, 5);
      expect(countEnterableCells(grid)).toBe(0);
    });

    it('returns 0 for empty grid', () => {
      const grid: Grid = {
        size: 5,
        width: 5,
        height: 5,
        cells: [[], [], [], [], []],
        equations: [],
      };
      expect(countEnterableCells(grid)).toBe(0);
    });
  });

  describe('calculateInitialScore', () => {
    it('calculates initial score based on enterable cells', () => {
      const score = calculateInitialScore(10);
      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 for 0 enterable cells', () => {
      expect(calculateInitialScore(0)).toBe(0);
    });

    it('scales linearly with cell count', () => {
      const score5 = calculateInitialScore(5);
      const score10 = calculateInitialScore(10);
      expect(score10).toBe(score5 * 2);
    });
  });

  describe('calculateScore', () => {
    const initialScore = calculateInitialScore(10);

    it('returns 100 for perfect game (no penalties)', () => {
      const score = calculateScore(initialScore, 0, 0, 0);
      expect(score).toBe(100);
    });

    it('returns value between 0 and 100', () => {
      const score = calculateScore(initialScore, 60, 5, 2);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('decreases with time elapsed', () => {
      const score0 = calculateScore(initialScore, 0, 0, 0);
      const score30 = calculateScore(initialScore, 30, 0, 0);
      const score60 = calculateScore(initialScore, 60, 0, 0);
      
      expect(score30).toBeLessThan(score0);
      expect(score60).toBeLessThan(score30);
    });

    it('decreases with wrong attempts', () => {
      const score0 = calculateScore(initialScore, 0, 0, 0);
      const score5 = calculateScore(initialScore, 0, 5, 0);
      const score10 = calculateScore(initialScore, 0, 10, 0);
      
      expect(score5).toBeLessThan(score0);
      expect(score10).toBeLessThan(score5);
    });

    it('decreases with hints used', () => {
      const score0 = calculateScore(initialScore, 0, 0, 0);
      const score1 = calculateScore(initialScore, 0, 0, 1);
      const score3 = calculateScore(initialScore, 0, 0, 3);
      
      expect(score1).toBeLessThan(score0);
      expect(score3).toBeLessThan(score1);
    });

    it('never goes below 0', () => {
      // Extreme penalties
      const score = calculateScore(initialScore, 10000, 100, 50);
      expect(score).toBe(0);
    });

    it('returns 0 when initialScore is 0', () => {
      const score = calculateScore(0, 0, 0, 0);
      expect(score).toBe(0);
    });

    it('returns integer value', () => {
      const score = calculateScore(initialScore, 33, 2, 1);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('getScoreBreakdown', () => {
    const initialScore = calculateInitialScore(10);

    it('returns all penalty components', () => {
      const breakdown = getScoreBreakdown(initialScore, 30, 5, 2);
      
      expect(breakdown).toHaveProperty('initialScore');
      expect(breakdown).toHaveProperty('timePenalty');
      expect(breakdown).toHaveProperty('wrongPenalty');
      expect(breakdown).toHaveProperty('hintPenalty');
      expect(breakdown).toHaveProperty('totalPenalty');
      expect(breakdown).toHaveProperty('finalScore');
    });

    it('totalPenalty equals sum of individual penalties', () => {
      const breakdown = getScoreBreakdown(initialScore, 30, 5, 2);
      
      const expectedTotal = breakdown.timePenalty + breakdown.wrongPenalty + breakdown.hintPenalty;
      expect(breakdown.totalPenalty).toBe(expectedTotal);
    });

    it('finalScore is close to calculateScore (rounding may differ)', () => {
      const breakdown = getScoreBreakdown(initialScore, 30, 5, 2);
      const directScore = calculateScore(initialScore, 30, 5, 2);
      
      // Rounding during normalization can cause slight differences
      expect(Math.abs(breakdown.finalScore - directScore)).toBeLessThanOrEqual(1);
    });

    it('returns 100 initialScore normalized', () => {
      const breakdown = getScoreBreakdown(initialScore, 0, 0, 0);
      expect(breakdown.initialScore).toBe(100);
    });

    it('handles zero penalties', () => {
      const breakdown = getScoreBreakdown(initialScore, 0, 0, 0);
      
      expect(breakdown.timePenalty).toBe(0);
      expect(breakdown.wrongPenalty).toBe(0);
      expect(breakdown.hintPenalty).toBe(0);
      expect(breakdown.totalPenalty).toBe(0);
      expect(breakdown.finalScore).toBe(100);
    });
  });
});
