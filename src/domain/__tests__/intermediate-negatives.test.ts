/**
 * Test for intermediate negative results in equations
 * 
 * Issue: Puzzle D3TAM4 has equation `16 - 20 + 34 = 30` which was incorrectly
 * marked as invalid because `16 - 20 = -4` (intermediate negative) was rejected.
 * 
 * Fix: Allow intermediate negative results, only require final result to be non-negative.
 */

import { describe, it, expect } from 'vitest';
import { 
  applyOperator, 
  evaluateEquation, 
  validateEquation 
} from '@domain/services/EquationService';
import { createNumberCell, createOperatorCell, createResultCell } from '@domain/entities/Cell';
import type { Equation, Operator } from '@domain/types';

/**
 * Helper to create a test equation with given numbers and operators
 */
function createTestEquation(
  numbers: number[], 
  operators: Operator[], 
  result: number
): Equation {
  const numberCells = numbers.map((value, index) => 
    createNumberCell(0, index * 2, value, true)
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

describe('Intermediate Negative Results', () => {
  describe('applyOperator', () => {
    it('allows negative results for subtraction', () => {
      // 16 - 20 = -4 should be allowed as intermediate result
      const result = applyOperator(16, '-', 20);
      expect(result).toBe(-4);
    });

    it('allows negative results for division', () => {
      // -4 / 2 = -2 should be allowed as intermediate result
      const result = applyOperator(-4, '÷', 2);
      expect(result).toBe(-2);
    });

    it('still rejects division by zero', () => {
      const result = applyOperator(10, '÷', 0);
      expect(result).toBeNull();
    });

    it('still rejects non-integer division', () => {
      const result = applyOperator(10, '÷', 3);
      expect(result).toBeNull();
    });

    it('handles addition with negative numbers', () => {
      // -4 + 34 = 30
      const result = applyOperator(-4, '+', 34);
      expect(result).toBe(30);
    });

    it('handles multiplication with negative numbers', () => {
      // -3 × 4 = -12
      const result = applyOperator(-3, '×', 4);
      expect(result).toBe(-12);
    });
  });

  describe('evaluateEquation', () => {
    it('evaluates 16 - 20 + 34 = 30 correctly (the D3TAM4 puzzle case)', () => {
      // This is the exact equation from puzzle D3TAM4 that was failing
      const equation = createTestEquation([16, 20, 34], ['-', '+'], 30);
      
      const result = evaluateEquation(equation);
      
      // 16 - 20 = -4 (intermediate negative)
      // -4 + 34 = 30 (final positive)
      expect(result).toBe(30);
    });

    it('evaluates equations with intermediate negatives that end positive', () => {
      // 5 - 10 + 20 = 15
      const equation = createTestEquation([5, 10, 20], ['-', '+'], 15);
      
      const result = evaluateEquation(equation);
      expect(result).toBe(15);
    });

    it('rejects equations with negative final result', () => {
      // 5 - 10 = -5 (final negative should be rejected)
      // Note: We use a positive result cell value since result cells can't be negative,
      // but the calculated result will be negative
      const equation = createTestEquation([5, 10], ['-'], 0); // Use 0 as placeholder
      
      const result = evaluateEquation(equation);
      expect(result).toBeNull(); // -5 final result is rejected
    });

    it('evaluates simple positive equations correctly', () => {
      // 10 + 5 = 15
      const equation = createTestEquation([10, 5], ['+'], 15);
      
      const result = evaluateEquation(equation);
      expect(result).toBe(15);
    });

    it('evaluates subtraction without intermediate negatives', () => {
      // 20 - 5 = 15
      const equation = createTestEquation([20, 5], ['-'], 15);
      
      const result = evaluateEquation(equation);
      expect(result).toBe(15);
    });

    it('handles multiple intermediate negatives', () => {
      // 2 - 10 + 3 - 5 + 20 = 10
      // Step by step: 2-10=-8, -8+3=-5, -5-5=-10, -10+20=10
      const equation = createTestEquation([2, 10, 3, 5, 20], ['-', '+', '-', '+'], 10);
      
      const result = evaluateEquation(equation);
      expect(result).toBe(10);
    });
  });

  describe('validateEquation', () => {
    it('validates 16 - 20 + 34 = 30 as correct (D3TAM4 puzzle fix)', () => {
      const equation = createTestEquation([16, 20, 34], ['-', '+'], 30);
      
      const validation = validateEquation(equation, 30);
      
      expect(validation.isValid).toBe(true);
      expect(validation.calculatedResult).toBe(30);
      expect(validation.isComplete).toBe(true);
    });

    it('validates equation with wrong displayed result as incorrect', () => {
      // User entered values that calculate to 30, but displayed result is 25
      const equation = createTestEquation([16, 20, 34], ['-', '+'], 30);
      
      const validation = validateEquation(equation, 25);
      
      expect(validation.isValid).toBe(false);
      expect(validation.calculatedResult).toBe(30);
    });

    it('validates simple equation correctly', () => {
      const equation = createTestEquation([10, 5], ['+'], 15);
      
      const validation = validateEquation(equation, 15);
      
      expect(validation.isValid).toBe(true);
      expect(validation.calculatedResult).toBe(15);
    });

    it('marks incomplete equation as not complete', () => {
      // Create equation with null value
      const equation = createTestEquation([10, 5], ['+'], 15);
      equation.numberCells[1] = createNumberCell(0, 2, null, false);
      
      const validation = validateEquation(equation, 15);
      
      expect(validation.isComplete).toBe(false);
      expect(validation.calculatedResult).toBeNull();
    });
  });

  describe('Real puzzle scenario: D3TAM4', () => {
    it('validates the problematic equation from puzzle D3TAM4', () => {
      // Simulating the exact scenario:
      // Equation: 16 - 20 + 34 = 30
      // User fills in: 16, 20, 34
      // Result cell shows: 30
      // Expected: validation should pass
      
      const equation = createTestEquation([16, 20, 34], ['-', '+'], 30);
      const displayedResult = 30; // What's shown in the result cell
      
      const validation = validateEquation(equation, displayedResult);
      
      expect(validation.isValid).toBe(true);
      expect(validation.calculatedResult).toBe(30);
      expect(validation.expectedResult).toBe(30);
    });
  });
});
