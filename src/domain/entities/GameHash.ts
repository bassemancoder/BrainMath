/**
 * GameHash Entity - Hash encoding/decoding for shareable puzzles
 * Format: [GridSizeCode][Difficulty][4-char seed]
 * Example: A2A7X2 = 5x5 grid, difficulty 2 (medium), seed "A7X2"
 * 
 * Pure functions with no side effects
 */

import type { GridSize, Difficulty, ParsedHash } from '@domain/types';
import { 
  GRID_SIZES, 
  DIFFICULTIES,
  SIZE_TO_CODE, 
  CODE_TO_SIZE,
} from '@domain/services/DifficultySettings';

/** Valid characters for the seed portion of the hash */
const SEED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Valid size codes */
const VALID_SIZE_CODES = Object.keys(CODE_TO_SIZE);

/** Total hash length */
const HASH_LENGTH = 6;

/** Seed length within the hash */
const SEED_LENGTH = 4;

/**
 * Validates if a string is a valid hash format
 */
export function isValidHash(hash: string): boolean {
  if (typeof hash !== 'string' || hash.length !== HASH_LENGTH) {
    return false;
  }

  const upperHash = hash.toUpperCase();

  // Check grid size code (first character)
  const sizeCode = upperHash[0];
  if (!VALID_SIZE_CODES.includes(sizeCode)) {
    return false;
  }

  // Check difficulty (second character)
  const difficulty = parseInt(upperHash[1], 10);
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    return false;
  }

  // Check seed characters (last 4 characters)
  const seed = upperHash.slice(2);
  for (const char of seed) {
    if (!SEED_CHARS.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Parses a hash string into its components
 * @throws Error if hash is invalid
 */
export function parseHash(hash: string): ParsedHash {
  if (!isValidHash(hash)) {
    throw new Error(`Invalid hash format: ${hash}`);
  }

  const upperHash = hash.toUpperCase();
  const sizeCode = upperHash[0];

  return {
    size: CODE_TO_SIZE[sizeCode],
    difficulty: parseInt(upperHash[1], 10) as Difficulty,
    seed: upperHash.slice(2),
  };
}

/**
 * Encodes components into a hash string
 */
export function encodeHash(size: GridSize, difficulty: Difficulty, seed: string): string {
  if (!GRID_SIZES.includes(size)) {
    throw new Error(`Invalid grid size: ${size}`);
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error(`Invalid difficulty: ${difficulty}`);
  }
  if (seed.length !== SEED_LENGTH) {
    throw new Error(`Seed must be ${SEED_LENGTH} characters`);
  }

  const upperSeed = seed.toUpperCase();
  for (const char of upperSeed) {
    if (!SEED_CHARS.includes(char)) {
      throw new Error(`Invalid seed character: ${char}`);
    }
  }

  const sizeCode = SIZE_TO_CODE[size];
  return `${sizeCode}${difficulty}${upperSeed}`;
}

/**
 * Generates a random seed string using the provided RNG
 */
export function generateSeed(randomFn: () => number): string {
  let seed = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    const index = Math.floor(randomFn() * SEED_CHARS.length);
    seed += SEED_CHARS[index];
  }
  return seed;
}

/**
 * Generates a complete hash with random seed
 */
export function generateHash(
  size: GridSize,
  difficulty: Difficulty,
  randomFn: () => number
): string {
  const seed = generateSeed(randomFn);
  return encodeHash(size, difficulty, seed);
}

// Re-export label functions from DifficultySettings for backward compatibility
export { getGridSizeLabel, getDifficultyLabel } from '@domain/services/DifficultySettings';
