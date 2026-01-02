/**
 * Debug test for puzzle generation
 * Run with: npm test -- --reporter=verbose debug-generation
 */

import seedrandom from 'seedrandom';
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '@domain/services/GeneratorService';
import { isValidSolution } from '@domain/services/SolverService';
import type { Grid, Equation, NumberCell, OperatorCell, RandomGenerator } from '@domain/types';

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

// Visualize the grid
function printGrid(grid: Grid): void {
  console.log('\nGrid:');
  for (let row = 0; row < grid.size; row++) {
    let rowStr = '';
    for (let col = 0; col < grid.size; col++) {
      const cell = grid.cells[row]?.[col];
      if (!cell) {
        rowStr += '   ';
      } else if (cell.type === 'operator') {
        rowStr += ` ${cell.value} `;
      } else if (cell.type === 'number') {
        const val = cell.value ?? '?';
        rowStr += ` ${String(val).padStart(1)} `;
      } else if (cell.type === 'result') {
        rowStr += ` ${String(cell.value).padStart(1)} `;
      } else if (cell.type === 'equals') {
        rowStr += ' = ';
      } else {
        rowStr += '   ';
      }
    }
    console.log(rowStr);
  }
}

// Print equation details
function printEquation(eq: Equation, index: number): void {
  const nums = eq.numberCells.map((c: NumberCell) => `${c.value}@(${c.row},${c.col})`).join(' ');
  const ops = eq.operatorCells.map((c: OperatorCell) => c.value).join(' ');
  console.log(`  Eq ${index} (${eq.direction}): ${nums} [${ops}] = ${eq.resultCell.value}@(${eq.resultCell.row},${eq.resultCell.col})`);
}

describe('Debug Puzzle Generation', () => {
  const testSeeds = ['TEST', 'ABCD', '1234', 'WXYZ', '5678'];
  
  testSeeds.forEach(seed => {
    it(`generates valid puzzle with seed "${seed}"`, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`Testing seed: "${seed}", size: 3`);
      console.log('='.repeat(60));
      
      const random = createTestRng(seed);
      const hash = `31${seed.slice(0, 4).toUpperCase().padEnd(4, 'A')}`;
      
      console.log(`Generating puzzle with hash: ${hash}...`);
      const puzzle = generatePuzzle(hash, random);
      
      expect(puzzle).not.toBeNull();
      if (!puzzle) return;
      
      console.log('\n--- Solution Grid ---');
      printGrid(puzzle.solution);
      
      console.log('\nSolution equations:');
      puzzle.solution.equations.forEach((eq: Equation, i: number) => printEquation(eq, i));
      
      // Validate each equation manually
      console.log('\n--- Manual Equation Check ---');
      for (const eq of puzzle.solution.equations) {
        const values = eq.numberCells.map((c: NumberCell) => c.value);
        const operators = eq.operatorCells.map((c: OperatorCell) => c.value);
        const result = eq.resultCell.value;
        
        console.log(`\nEquation ${eq.id} (${eq.direction}):`);
        console.log(`  Number cells: ${eq.numberCells.map((c: NumberCell) => `value=${c.value} @(${c.row},${c.col})`).join(', ')}`);
        console.log(`  Operators: ${operators.join(', ')}`);
        console.log(`  Result cell: value=${result} @(${eq.resultCell.row},${eq.resultCell.col})`);
        
        // Evaluate manually
        if (!values.some((v: number | null) => v === null)) {
          let evaluated = values[0]!;
          for (let i = 0; i < operators.length; i++) {
            const op = operators[i];
            const nextVal = values[i + 1]!;
            if (op === '+') evaluated += nextVal;
            else if (op === '-') evaluated -= nextVal;
            else if (op === '×') evaluated *= nextVal;
            else if (op === '÷') evaluated /= nextVal;
          }
          
          console.log(`  Evaluated: ${evaluated}, Expected: ${result}`);
          console.log(`  ${evaluated === result ? 'VALID ✓' : 'INVALID ✗'}`);
          
          // This is the actual test assertion
          expect(evaluated).toBe(result);
        }
      }
      
      // Final validation
      const isValid = isValidSolution(puzzle.solution);
      console.log(`\nisValidSolution: ${isValid}`);
      expect(isValid).toBe(true);
    });
  });
});
