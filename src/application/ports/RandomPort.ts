/**
 * RandomPort - Interface for random number generation
 * Allows dependency injection for testability
 */

import type { RandomGenerator } from '@domain/types';

/**
 * Port interface for random number generation
 */
export interface RandomPort {
  /**
   * Creates a seeded random generator
   * @param seed - The seed string for deterministic generation
   */
  createSeededGenerator(seed: string): RandomGenerator;
  
  /**
   * Creates a random generator with a random seed
   */
  createRandomGenerator(): RandomGenerator;
}
