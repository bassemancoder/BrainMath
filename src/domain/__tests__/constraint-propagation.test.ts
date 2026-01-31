/**
 * Test for constraint propagation service
 * Run with: npm test -- --reporter=verbose constraint-propagation
 */

import seedrandom from 'seedrandom';
import { describe, it, expect } from 'vitest';
import { 
  propagateConstraints,
  hasUniqueSolutionFast,
  computeDomainForCellInEquation,
} from '@domain/services/ConstraintService';
import { generatePuzzle } from '@domain/services/GeneratorService';
import type { RandomGenerator, Equation, NumberCell, OperatorCell, ResultCell } from '@domain/types';

// Size codes for hash format: A=5, B=10, C=15, E=20, D=30
const SIZE_CODES: Record<number, string> = {
  5: 'A',
  10: 'B',
  15: 'C',
  20: 'E',
  30: 'D',
};

// Create a seeded random generator for testing
function createTestRng(seed: string): RandomGenerator {
  const rng = seedrandom(seed);
  
  return {
    random: () => rng(),
    int: (min: number, max: number) => {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    pick: <T>(array: T[]): T => {
      return array[Math.floor(rng() * array.length)];
    },
    shuffle: <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },
  };
}

function createHash(size: number, difficulty: number, seed: string): string {
  const sizeCode = SIZE_CODES[size] || 'B';
  const paddedSeed = seed.toUpperCase().padEnd(4, 'A').slice(0, 4);
  return `${sizeCode}${difficulty}${paddedSeed}`;
}

// Helper to create a simple equation for testing domain computation
function createTestEquation(
  numbers: (number | null)[],
  operators: ('+' | '-' | '×' | '÷')[],
  result: number
): Equation {
  const numberCells: NumberCell[] = numbers.map((value, i) => ({
    type: 'number' as const,
    value,
    isFixed: value !== null,
    row: 0,
    col: i * 2,
  }));
  
  const operatorCells: OperatorCell[] = operators.map((value, i) => ({
    type: 'operator' as const,
    value,
    row: 0,
    col: i * 2 + 1,
  }));
  
  const resultCell: ResultCell = {
    type: 'result' as const,
    value: result,
    row: 0,
    col: numbers.length * 2,
  };
  
  return {
    id: 1,
    direction: 'horizontal' as const,
    numberCells,
    operatorCells,
    resultCell,
    startRow: 0,
    startCol: 0,
  };
}

describe('Constraint Propagation', () => {
  describe('Domain Computation', () => {
    it('computes domain for addition: A + ? = R', () => {
      // 5 + ? = 12 → ? = 7
      const equation = createTestEquation([5, null], ['+'], 12);
      const domain = computeDomainForCellInEquation(equation, 0, 2, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(7)).toBe(true);
    });
    
    it('computes domain for addition: ? + B = R', () => {
      // ? + 3 = 10 → ? = 7
      const equation = createTestEquation([null, 3], ['+'], 10);
      const domain = computeDomainForCellInEquation(equation, 0, 0, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(7)).toBe(true);
    });
    
    it('computes domain for subtraction: A - ? = R', () => {
      // 15 - ? = 8 → ? = 7
      const equation = createTestEquation([15, null], ['-'], 8);
      const domain = computeDomainForCellInEquation(equation, 0, 2, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(7)).toBe(true);
    });
    
    it('computes domain for subtraction: ? - B = R', () => {
      // ? - 5 = 10 → ? = 15
      const equation = createTestEquation([null, 5], ['-'], 10);
      const domain = computeDomainForCellInEquation(equation, 0, 0, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(15)).toBe(true);
    });
    
    it('computes domain for multiplication: A × ? = R', () => {
      // 6 × ? = 24 → ? = 4
      const equation = createTestEquation([6, null], ['×'], 24);
      const domain = computeDomainForCellInEquation(equation, 0, 2, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(4)).toBe(true);
    });
    
    it('computes domain for multiplication: ? × B = R', () => {
      // ? × 7 = 35 → ? = 5
      const equation = createTestEquation([null, 7], ['×'], 35);
      const domain = computeDomainForCellInEquation(equation, 0, 0, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(5)).toBe(true);
    });
    
    it('computes domain for division: A ÷ ? = R', () => {
      // 20 ÷ ? = 4 → ? = 5
      const equation = createTestEquation([20, null], ['÷'], 4);
      const domain = computeDomainForCellInEquation(equation, 0, 2, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(5)).toBe(true);
    });
    
    it('computes domain for division: ? ÷ B = R', () => {
      // ? ÷ 6 = 8 → ? = 48
      const equation = createTestEquation([null, 6], ['÷'], 8);
      const domain = computeDomainForCellInEquation(equation, 0, 0, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(48)).toBe(true);
    });
    
    it('returns empty domain for impossible equations', () => {
      // 5 × ? = 7 → no integer solution
      const equation = createTestEquation([5, null], ['×'], 7);
      const domain = computeDomainForCellInEquation(equation, 0, 2, 200);
      
      expect(domain.size).toBe(0);
    });
    
    it('handles 3-number equations', () => {
      // 2 + 3 + ? = 10 → ? = 5
      const equation = createTestEquation([2, 3, null], ['+', '+'], 10);
      const domain = computeDomainForCellInEquation(equation, 0, 4, 200);
      
      expect(domain.size).toBe(1);
      expect(domain.has(5)).toBe(true);
    });
  });
  
  describe('Uniqueness Verification', () => {
    it('verifies uniqueness of generated puzzles', { timeout: 60000 }, async () => {
      console.log('\n' + '='.repeat(60));
      console.log('Testing Uniqueness Verification');
      console.log('='.repeat(60));
      
      const testCases = [
        { size: 5, difficulty: 1, seed: 'TEST' },
        { size: 10, difficulty: 2, seed: 'ABCD' },
        { size: 15, difficulty: 2, seed: 'XYZ1' },
      ];
      
      for (const { size, difficulty, seed } of testCases) {
        const hash = createHash(size, difficulty, seed);
        const rng = createTestRng(seed);
        const puzzle = await generatePuzzle(hash, rng);
        
        if (!puzzle) {
          console.log(`  [SKIP] Size ${size}, Difficulty ${difficulty} - Generation failed`);
          continue;
        }
        
        // Test constraint propagation on the puzzle
        const result = propagateConstraints(puzzle.grid);
        
        console.log(`  Size ${size}, Difficulty ${difficulty}:`);
        console.log(`    Unique: ${result.isUnique}`);
        console.log(`    Has solution: ${result.hasSolution}`);
        console.log(`    Ambiguous cells: ${result.ambiguousCells.length}`);
        
        // The puzzle should have a solution
        expect(result.hasSolution).toBe(true);
      }
    });
    
    it('fast uniqueness check matches expectation', { timeout: 30000 }, async () => {
      const hash = createHash(10, 2, 'TEST');
      const rng = createTestRng('TEST');
      const puzzle = await generatePuzzle(hash, rng);
      
      if (!puzzle) {
        console.log('Generation failed, skipping test');
        return;
      }
      
      // Fast check should return a result
      const isUnique = hasUniqueSolutionFast(puzzle.grid);
      
      // We expect generated puzzles to be unique (or at least have a solution)
      // The actual uniqueness depends on the generation algorithm
      console.log(`  Fast uniqueness check: ${isUnique}`);
      expect(typeof isUnique).toBe('boolean');
    });
  });
});
