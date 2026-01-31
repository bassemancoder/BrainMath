/**
 * Tests for EquationService - equation evaluation and validation
 */

import { describe, it, expect } from 'vitest';
import {
  applyOperator,
  evaluateEquation,
  validateEquation,
  isEquationComplete,
} from '@domain/services/EquationService';
import { createNumberCell, createOperatorCell, createResultCell } from '@domain/entities/Cell';
import type { Equation, Operator } from '@domain/types';

// Helper to create test equations
function createTestEquation(
  numbers: (number | null)[],
  operators: Operator[],
  result: number
): Equation {
  const numberCells = numbers.map((value, index) =>
    createNumberCell(0, index * 2, value, value !== null)
  );

  const operatorCells = operators.map((op, index) =>
    createOperatorCell(0, index * 2 + 1, op)
  );

  const resultCell = createResultCell(0, numbers.length * 2, result);

  return {
    id: 1,
    direction: 'horizontal',
    numberCells,
    operatorCells,
    resultCell,
    startRow: 0,
    startCol: 0,
  };
}

describe('EquationService', () => {
  describe('applyOperator', () => {
    describe('addition', () => {
      it('adds two positive numbers', () => {
        expect(applyOperator(5, '+', 3)).toBe(8);
      });

      it('adds negative and positive', () => {
        expect(applyOperator(-5, '+', 10)).toBe(5);
      });

      it('adds two negative numbers', () => {
        expect(applyOperator(-5, '+', -3)).toBe(-8);
      });
    });

    describe('subtraction', () => {
      it('subtracts positive numbers', () => {
        expect(applyOperator(10, '-', 3)).toBe(7);
      });

      it('returns negative for larger subtrahend', () => {
        expect(applyOperator(5, '-', 10)).toBe(-5);
      });

      it('subtracts from negative', () => {
        expect(applyOperator(-5, '-', 3)).toBe(-8);
      });
    });

    describe('multiplication', () => {
      it('multiplies positive numbers', () => {
        expect(applyOperator(4, '×', 5)).toBe(20);
      });

      it('multiplies by zero', () => {
        expect(applyOperator(100, '×', 0)).toBe(0);
      });

      it('multiplies negative numbers', () => {
        expect(applyOperator(-3, '×', 4)).toBe(-12);
        expect(applyOperator(-3, '×', -4)).toBe(12);
      });
    });

    describe('division', () => {
      it('divides evenly', () => {
        expect(applyOperator(20, '÷', 4)).toBe(5);
      });

      it('returns null for non-integer division', () => {
        expect(applyOperator(10, '÷', 3)).toBeNull();
        expect(applyOperator(7, '÷', 2)).toBeNull();
      });

      it('returns null for division by zero', () => {
        expect(applyOperator(10, '÷', 0)).toBeNull();
      });

      it('divides negative numbers', () => {
        expect(applyOperator(-20, '÷', 4)).toBe(-5);
        expect(applyOperator(-20, '÷', -4)).toBe(5);
      });
    });
  });

  describe('evaluateEquation', () => {
    it('evaluates simple addition', () => {
      const eq = createTestEquation([2, 3], ['+'], 5);
      expect(evaluateEquation(eq)).toBe(5);
    });

    it('evaluates simple subtraction', () => {
      const eq = createTestEquation([10, 3], ['-'], 7);
      expect(evaluateEquation(eq)).toBe(7);
    });

    it('evaluates simple multiplication', () => {
      const eq = createTestEquation([4, 5], ['×'], 20);
      expect(evaluateEquation(eq)).toBe(20);
    });

    it('evaluates simple division', () => {
      const eq = createTestEquation([20, 4], ['÷'], 5);
      expect(evaluateEquation(eq)).toBe(5);
    });

    it('evaluates left-to-right (no PEMDAS)', () => {
      // 2 + 3 × 4 should be (2+3)*4 = 20, NOT 2+(3*4) = 14
      const eq = createTestEquation([2, 3, 4], ['+', '×'], 20);
      expect(evaluateEquation(eq)).toBe(20);
    });

    it('evaluates complex expression left-to-right', () => {
      // 10 - 2 × 3 + 1 = ((10-2)*3)+1 = 25
      const eq = createTestEquation([10, 2, 3, 1], ['-', '×', '+'], 25);
      expect(evaluateEquation(eq)).toBe(25);
    });

    it('allows intermediate negative values', () => {
      // 5 - 10 + 20 = 15 (intermediate: 5-10=-5)
      const eq = createTestEquation([5, 10, 20], ['-', '+'], 15);
      expect(evaluateEquation(eq)).toBe(15);
    });

    it('returns null when any number is null', () => {
      const eq = createTestEquation([5, null, 10], ['+', '-'], 5);
      expect(evaluateEquation(eq)).toBeNull();
    });

    it('returns null for invalid division', () => {
      const eq = createTestEquation([10, 3], ['÷'], 3);
      expect(evaluateEquation(eq)).toBeNull();
    });

    it('returns null for negative final result', () => {
      // 5 - 10 = -5 (negative final result should return null)
      // Note: result cell uses a dummy value since the actual result would be negative
      const eq = createTestEquation([5, 10], ['-'], 0);
      expect(evaluateEquation(eq)).toBeNull();
    });
  });

  describe('validateEquation', () => {
    it('returns valid for correct equation', () => {
      const eq = createTestEquation([3, 7], ['+'], 10);
      const result = validateEquation(eq, 10);
      
      expect(result.isValid).toBe(true);
      expect(result.calculatedResult).toBe(10);
      expect(result.expectedResult).toBe(10);
    });

    it('returns invalid for incorrect equation', () => {
      const eq = createTestEquation([3, 7], ['+'], 15);
      const result = validateEquation(eq, 15);
      
      expect(result.isValid).toBe(false);
      expect(result.calculatedResult).toBe(10);
      expect(result.expectedResult).toBe(15);
    });

    it('validates against displayedResult parameter', () => {
      // Equation stored result is 10, but we pass displayedResult as 10
      const eq = createTestEquation([3, 7], ['+'], 10);
      
      // Valid: calculation matches displayedResult
      expect(validateEquation(eq, 10).isValid).toBe(true);
      
      // Invalid: calculation doesn't match displayedResult
      expect(validateEquation(eq, 12).isValid).toBe(false);
    });

    it('returns invalid when calculation fails', () => {
      const eq = createTestEquation([10, 3], ['÷'], 3);
      const result = validateEquation(eq, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.calculatedResult).toBeNull();
    });
  });

  describe('isEquationComplete', () => {
    it('returns true when all cells have values', () => {
      const eq = createTestEquation([2, 3, 4], ['+', '-'], 5);
      expect(isEquationComplete(eq)).toBe(true);
    });

    it('returns false when any cell is null', () => {
      const eq = createTestEquation([2, null, 4], ['+', '-'], 5);
      expect(isEquationComplete(eq)).toBe(false);
    });

    it('returns false for all null values', () => {
      const eq = createTestEquation([null, null], ['+'], 5);
      expect(isEquationComplete(eq)).toBe(false);
    });
  });
});
