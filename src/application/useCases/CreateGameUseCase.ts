/**
 * CreateGameUseCase - Creates a new game from a hash
 * Orchestrates puzzle generation
 */

import type { Puzzle, GridSize, Difficulty } from '@domain/types';
import { parseHash, isValidHash, generateHash as generateHashEntity } from '@domain/entities/GameHash';
import { generatePuzzle } from '@domain/services/GeneratorService';
import type { RandomPort } from '../ports/RandomPort';

export interface CreateGameInput {
  hash?: string;
  size?: GridSize;
  difficulty?: Difficulty;
}

export interface CreateGameOutput {
  success: boolean;
  puzzle?: Puzzle;
  error?: string;
}

/**
 * Creates a new game
 * - If hash is provided, validates and uses it
 * - If size and difficulty are provided, generates a new hash
 * - Returns the puzzle with its solution
 */
export function createGame(
  input: CreateGameInput,
  randomPort: RandomPort
): CreateGameOutput {
  try {
    let hash: string;
    
    if (input.hash) {
      // Validate provided hash
      if (!isValidHash(input.hash)) {
        return {
          success: false,
          error: `Invalid hash format: ${input.hash}`,
        };
      }
      hash = input.hash.toUpperCase();
    } else if (input.size && input.difficulty) {
      // Generate new hash
      const rng = randomPort.createRandomGenerator();
      hash = generateHashEntity(input.size, input.difficulty, rng.random);
    } else {
      return {
        success: false,
        error: 'Either hash or size+difficulty must be provided',
      };
    }
    
    // Parse hash to get seed
    const parsed = parseHash(hash);
    
    // Create seeded RNG from the hash seed
    const rng = randomPort.createSeededGenerator(parsed.seed);
    
    // Generate puzzle
    const puzzle = generatePuzzle(hash, rng);
    
    if (!puzzle) {
      return {
        success: false,
        error: 'Failed to generate puzzle. Try a different hash.',
      };
    }
    
    return {
      success: true,
      puzzle,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generates a new random hash for sharing
 */
export function generateNewHash(
  size: GridSize,
  difficulty: Difficulty,
  randomPort: RandomPort
): string {
  const rng = randomPort.createRandomGenerator();
  return generateHashEntity(size, difficulty, rng.random);
}
