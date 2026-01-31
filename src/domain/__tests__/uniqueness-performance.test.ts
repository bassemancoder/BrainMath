/**
 * Performance benchmark for constraint propagation vs backtracking
 * Run with: npm test -- --reporter=verbose uniqueness-performance
 */

import seedrandom from 'seedrandom';
import { describe, it, expect } from 'vitest';
import { propagateConstraints, hasUniqueSolutionFast } from '@domain/services/ConstraintService';
import { generatePuzzle } from '@domain/services/GeneratorService';
import type { RandomGenerator } from '@domain/types';

// Size codes for hash format
const SIZE_CODES: Record<number, string> = {
  5: 'A',
  10: 'B',
  15: 'C',
  20: 'E',
  30: 'D',
};

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

describe('Uniqueness Check Performance', () => {
  it('constraint propagation completes within 50ms for small puzzles', { timeout: 30000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Performance Benchmark: Small Puzzles (5-10 equations)');
    console.log('='.repeat(60));
    
    const testCases = [
      { size: 5, difficulty: 1 },
      { size: 5, difficulty: 2 },
      { size: 5, difficulty: 3 },
      { size: 10, difficulty: 1 },
      { size: 10, difficulty: 2 },
      { size: 10, difficulty: 3 },
    ];
    
    for (const { size, difficulty } of testCases) {
      const hash = createHash(size, difficulty, 'PERF');
      const rng = createTestRng('PERF');
      const puzzle = await generatePuzzle(hash, rng);
      
      if (!puzzle) {
        console.log(`  [SKIP] Size ${size}, Difficulty ${difficulty} - Generation failed`);
        continue;
      }
      
      // Benchmark constraint propagation
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        propagateConstraints(puzzle.grid);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`  Size ${size}, Difficulty ${difficulty}:`);
      console.log(`    Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      
      // Should complete within 50ms
      expect(avgTime).toBeLessThan(50);
    }
  });
  
  it('constraint propagation completes within 50ms for large puzzles', { timeout: 120000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Performance Benchmark: Large Puzzles (15-30 equations)');
    console.log('='.repeat(60));
    
    const testCases = [
      { size: 15, difficulty: 2 },
      { size: 20, difficulty: 2 },
      { size: 30, difficulty: 2 },
    ];
    
    for (const { size, difficulty } of testCases) {
      const hash = createHash(size, difficulty, 'PERF');
      const rng = createTestRng('PERF');
      const puzzle = await generatePuzzle(hash, rng);
      
      if (!puzzle) {
        console.log(`  [SKIP] Size ${size}, Difficulty ${difficulty} - Generation failed`);
        continue;
      }
      
      // Count empty cells for context
      let emptyCells = 0;
      for (const eq of puzzle.grid.equations) {
        for (const cell of eq.numberCells) {
          const gridCell = puzzle.grid.cells[cell.row]?.[cell.col];
          if (gridCell && gridCell.type === 'number' && !gridCell.isFixed) {
            emptyCells++;
          }
        }
      }
      
      // Benchmark constraint propagation
      const iterations = 5;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = propagateConstraints(puzzle.grid);
        const end = performance.now();
        times.push(end - start);
        
        if (i === 0) {
          console.log(`  Size ${size} (${puzzle.grid.equations.length} equations, ~${emptyCells} empty cells):`);
          console.log(`    Unique: ${result.isUnique}, Ambiguous: ${result.ambiguousCells.length}`);
        }
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`    Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      
      // Should complete within 50ms (constraint propagation is O(n²))
      expect(avgTime).toBeLessThan(50);
    }
  });
  
  it('fast uniqueness check is performant for all grid sizes', { timeout: 120000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Performance Benchmark: Fast Uniqueness Check');
    console.log('='.repeat(60));
    
    const sizes = [5, 10, 15, 20, 30];
    
    for (const size of sizes) {
      const hash = createHash(size, 2, 'UNIQ');
      const rng = createTestRng('UNIQ');
      const puzzle = await generatePuzzle(hash, rng);
      
      if (!puzzle) {
        console.log(`  [SKIP] Size ${size} - Generation failed`);
        continue;
      }
      
      // Benchmark full uniqueness check
      const iterations = 3;
      const times: number[] = [];
      let lastResult = false;
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        lastResult = hasUniqueSolutionFast(puzzle.grid);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      console.log(`  Size ${size}: ${avgTime.toFixed(2)}ms avg, result: ${lastResult}`);
      
      // Full check should complete within 100ms
      expect(avgTime).toBeLessThan(100);
    }
  });
  
  it('puzzle generation with uniqueness check completes in reasonable time', { timeout: 180000 }, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Performance Benchmark: Full Generation with Uniqueness');
    console.log('='.repeat(60));
    
    const testCases = [
      { size: 5, target: 2000 },
      { size: 10, target: 3000 },
      { size: 15, target: 5000 },
      { size: 20, target: 8000 },
      { size: 30, target: 15000 },
    ];
    
    for (const { size, target } of testCases) {
      const hash = createHash(size, 2, 'FULL');
      const rng = createTestRng('FULL');
      
      const start = performance.now();
      const puzzle = await generatePuzzle(hash, rng);
      const end = performance.now();
      
      const duration = end - start;
      
      if (!puzzle) {
        console.log(`  Size ${size}: FAILED (${duration.toFixed(0)}ms)`);
        continue;
      }
      
      console.log(`  Size ${size}: ${duration.toFixed(0)}ms (target: <${target}ms)`);
      
      // Should complete within target time
      expect(duration).toBeLessThan(target);
    }
  });
});
