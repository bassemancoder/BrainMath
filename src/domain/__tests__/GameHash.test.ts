/**
 * Tests for GameHash entity - hash encoding/decoding
 */

import { describe, it, expect } from 'vitest';
import {
  isValidHash,
  parseHash,
  encodeHash,
} from '@domain/entities/GameHash';

describe('GameHash Entity', () => {
  describe('isValidHash', () => {
    it('returns true for valid hash format', () => {
      expect(isValidHash('A1TEST')).toBe(true);
      expect(isValidHash('B2ABCD')).toBe(true);
      expect(isValidHash('C3XYZ2')).toBe(true);
      expect(isValidHash('D1SEED')).toBe(true);
      expect(isValidHash('E2A7X2')).toBe(true);
    });

    it('returns true for lowercase hash (case insensitive)', () => {
      expect(isValidHash('a1test')).toBe(true);
      expect(isValidHash('b2abcd')).toBe(true);
    });

    it('returns false for invalid size code', () => {
      expect(isValidHash('Z1TEST')).toBe(false);
      expect(isValidHash('X2ABCD')).toBe(false);
    });

    it('returns false for invalid difficulty', () => {
      expect(isValidHash('A0TEST')).toBe(false);
      expect(isValidHash('A4TEST')).toBe(false);
      expect(isValidHash('A9TEST')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect(isValidHash('A1TES')).toBe(false);
      expect(isValidHash('A1TESTER')).toBe(false);
      expect(isValidHash('')).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(isValidHash(123 as unknown as string)).toBe(false);
      expect(isValidHash(null as unknown as string)).toBe(false);
      expect(isValidHash(undefined as unknown as string)).toBe(false);
    });

    it('returns false for invalid seed characters', () => {
      expect(isValidHash('A1!@#$')).toBe(false);
    });
  });

  describe('parseHash', () => {
    it('parses valid hash into components', () => {
      const result = parseHash('B2TEST');
      expect(result.size).toBe(10); // B = 10
      expect(result.difficulty).toBe(2);
      expect(result.seed).toBe('TEST');
    });

    it('parses size code A (Quick/5)', () => {
      const result = parseHash('A1SEED');
      expect(result.size).toBe(5);
    });

    it('parses size code B (Classic/10)', () => {
      const result = parseHash('B2SEED');
      expect(result.size).toBe(10);
    });

    it('parses size code C (Extended/15)', () => {
      const result = parseHash('C3SEED');
      expect(result.size).toBe(15);
    });

    it('parses size code D (Marathon/30)', () => {
      const result = parseHash('D1SEED');
      expect(result.size).toBe(30);
    });

    it('parses size code E (Challenge/20)', () => {
      const result = parseHash('E2SEED');
      expect(result.size).toBe(20);
    });

    it('parses all difficulty levels', () => {
      expect(parseHash('A1SEED').difficulty).toBe(1);
      expect(parseHash('A2SEED').difficulty).toBe(2);
      expect(parseHash('A3SEED').difficulty).toBe(3);
    });

    it('converts seed to uppercase', () => {
      const result = parseHash('A1test');
      expect(result.seed).toBe('TEST');
    });

    it('throws error for invalid hash', () => {
      expect(() => parseHash('INVALID')).toThrow();
      expect(() => parseHash('Z1TEST')).toThrow();
      expect(() => parseHash('')).toThrow();
    });
  });

  describe('encodeHash', () => {
    it('encodes components into hash string', () => {
      const hash = encodeHash(10, 2, 'TEST');
      expect(hash).toBe('B2TEST');
    });

    it('encodes all grid sizes correctly', () => {
      expect(encodeHash(5, 1, 'ABCD')).toBe('A1ABCD');
      expect(encodeHash(10, 1, 'ABCD')).toBe('B1ABCD');
      expect(encodeHash(15, 1, 'ABCD')).toBe('C1ABCD');
      expect(encodeHash(20, 1, 'ABCD')).toBe('E1ABCD');
      expect(encodeHash(30, 1, 'ABCD')).toBe('D1ABCD');
    });

    it('encodes all difficulty levels correctly', () => {
      expect(encodeHash(10, 1, 'TEST')).toBe('B1TEST');
      expect(encodeHash(10, 2, 'TEST')).toBe('B2TEST');
      expect(encodeHash(10, 3, 'TEST')).toBe('B3TEST');
    });

    it('throws error for invalid grid size', () => {
      expect(() => encodeHash(7 as 5, 1, 'TEST')).toThrow();
      expect(() => encodeHash(100 as 5, 1, 'TEST')).toThrow();
    });

    it('throws error for invalid difficulty', () => {
      expect(() => encodeHash(10, 0 as 1, 'TEST')).toThrow();
      expect(() => encodeHash(10, 4 as 1, 'TEST')).toThrow();
    });

    it('throws error for wrong seed length', () => {
      expect(() => encodeHash(10, 2, 'AB')).toThrow();
      expect(() => encodeHash(10, 2, 'ABCDEFGH')).toThrow();
    });

    it('throws error for invalid seed characters', () => {
      // Characters like 0, O, 1, I, L are not allowed for new hashes
      expect(() => encodeHash(10, 2, 'T0ST')).toThrow();
      expect(() => encodeHash(10, 2, 'T1ST')).toThrow();
    });

    it('converts seed to uppercase', () => {
      const hash = encodeHash(10, 2, 'test');
      expect(hash).toBe('B2TEST');
    });
  });

  describe('Round-trip encoding/decoding', () => {
    it('parseHash(encodeHash()) returns original values', () => {
      const sizes = [5, 10, 15, 20, 30] as const;
      const difficulties = [1, 2, 3] as const;
      
      for (const size of sizes) {
        for (const difficulty of difficulties) {
          const seed = 'TEST'; // Use valid seed characters
          const hash = encodeHash(size, difficulty, seed);
          const parsed = parseHash(hash);
          
          expect(parsed.size).toBe(size);
          expect(parsed.difficulty).toBe(difficulty);
          expect(parsed.seed).toBe(seed);
        }
      }
    });
  });
});
