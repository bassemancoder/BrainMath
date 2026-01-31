/**
 * Test to ensure no equation is fully revealed (all cells pre-filled) in generated puzzles
 * Run with: npm test -- --reporter=verbose no-fully-revealed-equations
 */

import seedrandom from 'seedrandom';
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '@domain/services/GeneratorService';
import { getCellAt } from '@domain/services/GridService';
import { isNumberCell } from '@domain/entities/Cell';
import type { Grid, RandomGenerator, Equation } from '@domain/types';

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

/**
 * Creates a hash from size, difficulty, and seed
 * Hash format: [SizeCode][Difficulty][4-char seed]
 */
function createHash(size: number, difficulty: number, seed: string): string {
  const sizeCode = SIZE_CODES[size] || 'B';
  const paddedSeed = seed.toUpperCase().padEnd(4, 'A').slice(0, 4);
  return `${sizeCode}${difficulty}${paddedSeed}`;
}

/**
 * Checks if an equation has all its number cells fixed (fully revealed)
 */
function isEquationFullyRevealed(grid: Grid, equation: Equation): boolean {
  for (const cellPos of equation.numberCells) {
    const cell = getCellAt(grid, cellPos.row, cellPos.col);
    if (cell && isNumberCell(cell) && !cell.isFixed) {
      return false; // Found an editable cell, not fully revealed
    }
  }
  return true; // All cells are fixed
}

/**
 * Gets all fully revealed equations in a grid
 */
function getFullyRevealedEquations(grid: Grid): Equation[] {
  return grid.equations.filter(eq => isEquationFullyRevealed(grid, eq));
}

describe('No Fully Revealed Equations', () => {
  it('ensures no equation is fully revealed in small puzzles', { timeout: 30000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Small Puzzles (5 equations) - All Difficulties');
    console.log('='.repeat(60));

    const seeds = ['TEST', 'ABCD', 'XYZ1', '1234', 'SEED'];
    const difficulties = [1, 2, 3] as const;
    
    for (const difficulty of difficulties) {
      for (const seed of seeds) {
        const hash = createHash(5, difficulty, seed);
        const rng = createTestRng(seed);
        const puzzle = await generatePuzzle(hash, rng);
        
        if (!puzzle) {
          console.log(`  [SKIP] Size 5, Difficulty ${difficulty}, Seed ${seed} - Generation failed`);
          continue;
        }
        
        // Test the puzzle grid (with clues removed), not the solution
        const fullyRevealed = getFullyRevealedEquations(puzzle.grid);
        
        console.log(`  Size 5, Difficulty ${difficulty}, Seed ${seed}: ${fullyRevealed.length} fully revealed equations`);
        
        expect(fullyRevealed.length).toBe(0);
      }
    }
  });

  it('ensures no equation is fully revealed in medium puzzles', { timeout: 60000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Medium Puzzles (10 equations) - All Difficulties');
    console.log('='.repeat(60));

    const seeds = ['TEST', 'ABCD', 'XYZ1'];
    const difficulties = [1, 2, 3] as const;
    
    for (const difficulty of difficulties) {
      for (const seed of seeds) {
        const hash = createHash(10, difficulty, seed);
        const rng = createTestRng(seed);
        const puzzle = await generatePuzzle(hash, rng);
        
        if (!puzzle) {
          console.log(`  [SKIP] Size 10, Difficulty ${difficulty}, Seed ${seed} - Generation failed`);
          continue;
        }
        
        // Test the puzzle grid (with clues removed), not the solution
        const fullyRevealed = getFullyRevealedEquations(puzzle.grid);
        
        console.log(`  Size 10, Difficulty ${difficulty}, Seed ${seed}: ${fullyRevealed.length} fully revealed equations`);
        
        expect(fullyRevealed.length).toBe(0);
      }
    }
  });

  it('ensures no equation is fully revealed in large puzzles', { timeout: 120000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Large Puzzles (15-30 equations) - Medium Difficulty');
    console.log('='.repeat(60));

    const testCases = [
      { size: 15, seed: 'TEST' },
      { size: 20, seed: 'TEST' },
      { size: 30, seed: 'TEST' },
    ];
    
    for (const { size, seed } of testCases) {
      const hash = createHash(size, 2, seed);
      const rng = createTestRng(seed);
      const puzzle = await generatePuzzle(hash, rng);
      
      if (!puzzle) {
        console.log(`  [SKIP] Size ${size}, Seed ${seed} - Generation failed`);
        continue;
      }
      
      // Test the puzzle grid (with clues removed), not the solution
      const fullyRevealed = getFullyRevealedEquations(puzzle.grid);
      
      console.log(`  Size ${size}, Seed ${seed}: ${fullyRevealed.length} fully revealed equations out of ${puzzle.grid.equations.length}`);
      
      if (fullyRevealed.length > 0) {
        console.log('    Fully revealed equations:');
        for (const eq of fullyRevealed) {
          const cells = eq.numberCells.map(c => `(${c.row},${c.col})`).join(', ');
          console.log(`      Equation ${eq.id}: cells at ${cells}`);
        }
      }
      
      expect(fullyRevealed.length).toBe(0);
    }
  });
});
