/**
 * SeededRandom - Implementation of RandomPort using seedrandom
 */

import seedrandom from 'seedrandom';
import type { RandomGenerator } from '@domain/types';
import type { RandomPort } from '@application/ports/RandomPort';

/**
 * Creates a RandomGenerator from a seedrandom instance
 */
function createGenerator(rng: seedrandom.PRNG): RandomGenerator {
  return {
    random: () => rng(),
    
    int: (min: number, max: number) => {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    
    pick: <T>(array: T[]): T => {
      if (array.length === 0) {
        throw new Error('Cannot pick from empty array');
      }
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
 * Implementation of RandomPort using seedrandom library
 */
export const seededRandomAdapter: RandomPort = {
  createSeededGenerator(seed: string): RandomGenerator {
    const rng = seedrandom(seed);
    return createGenerator(rng);
  },
  
  createRandomGenerator(): RandomGenerator {
    // Use current time + random for truly random seed
    const randomSeed = `${Date.now()}-${Math.random()}`;
    const rng = seedrandom(randomSeed);
    return createGenerator(rng);
  },
};

/**
 * Default export for convenience
 */
export default seededRandomAdapter;
