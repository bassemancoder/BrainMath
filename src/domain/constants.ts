/**
 * Centralized Constants
 * 
 * All hardcoded values in one place for easy review and tuning.
 * Organized by domain namespace for clarity.
 */

// ============================================
// CELL VALUE LIMITS
// ============================================

export const Cell = {
  /** Minimum valid cell value */
  MIN_VALUE: 1,
  /** Maximum valid cell value */
  MAX_VALUE: 200,
} as const;

// ============================================
// HASH ENCODING
// ============================================

export const Hash = {
  /** Total hash string length */
  LENGTH: 6,
  /** Seed portion length within the hash */
  SEED_LENGTH: 4,
  /** Characters used for NEW hash generation (unambiguous - excludes 0, O, 1, I, L) */
  SEED_CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  /** Characters accepted during validation (for backwards compatibility) */
  SEED_CHARS_VALID: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
} as const;

// ============================================
// GENERATION ALGORITHM
// ============================================

export const Generation = {
  /** Grid size threshold for determining generation attempts (15 or smaller = more attempts) */
  GRID_SIZE_THRESHOLD_FOR_ATTEMPTS: 15,
  /** Max generation attempts for smaller grids (15x15 or less) */
  MAX_ATTEMPTS_SMALL_GRID: 60,
  /** Max generation attempts for larger grids (30x30) */
  MAX_ATTEMPTS_LARGE_GRID: 30,
  /** Minimum equations per complex operator (× and ÷) when that operator is allowed */
  MIN_COMPLEX_OPERATOR_EQUATIONS: 2,
  /** Threshold for double-digit numbers (10 or higher) */
  DOUBLE_DIGIT_THRESHOLD: 10,
  /** Max attempts for generating a 2-number equation */
  MAX_ATTEMPTS_2_NUMBER_EQUATION: 50,
  /** Max attempts for generating a 3-number equation */
  MAX_ATTEMPTS_3_NUMBER_EQUATION: 100,
  /** Max attempts for generating a 4-number equation */
  MAX_ATTEMPTS_4_NUMBER_EQUATION: 150,
  /** Max attempts for generating an equation with a fixed first number */
  MAX_ATTEMPTS_EQUATION_WITH_FIRST: 100,
  /** Max attempts for generating an equation with a value at a specific position */
  MAX_ATTEMPTS_EQUATION_WITH_VALUE_AT: 100,
  /** Max attempts for generating an equation targeting a specific result */
  MAX_ATTEMPTS_EQUATION_WITH_RESULT: 200,
  /** Max attempts for deprecated 2-number equation with first */
  MAX_ATTEMPTS_2_NUMBER_WITH_FIRST: 50,
  /** Safety limit for crossword layout iterations */
  MAX_CROSSWORD_LAYOUT_ITERATIONS: 100,
  /** Max result cells to try per iteration when placing shared result equations */
  MAX_RESULT_CELLS_TO_TRY: 6,
  /** Max intersection points to try per iteration */
  MAX_INTERSECTION_POINTS_TO_TRY: 10,
  /** Consecutive failures before early termination in layout generation */
  MAX_CONSECUTIVE_FAILURES: 15,
  /** Max number of cells before skipping unique solution check (performance) */
  MAX_NUMBER_CELLS_FOR_UNIQUE_CHECK: 20,
} as const;

// ============================================
// SOLVER DEFAULTS
// ============================================

export const Solver = {
  /** Default max value when solving puzzles */
  DEFAULT_MAX_VALUE: 200,
  /** Default max solution count for uniqueness check */
  DEFAULT_MAX_COUNT: 2,
} as const;

// ============================================
// UI TIMING
// ============================================

export const Timing = {
  /** Game timer tick interval in milliseconds */
  TIMER_INTERVAL_MS: 1000,
  /** Duration to show "Copied!" feedback in milliseconds */
  COPY_FEEDBACK_DURATION_MS: 2000,
  /** Double-tap detection threshold in milliseconds */
  DOUBLE_TAP_THRESHOLD_MS: 300,
  /** Time window for cheat code detection in milliseconds */
  CHEAT_CODE_WINDOW_MS: 1000,
  /** Number of clicks required for cheat code */
  CHEAT_CODE_CLICK_COUNT: 5,
} as const;

// ============================================
// TIME FORMATTING
// ============================================

export const TimeFormat = {
  /** Seconds per minute (for timer formatting) */
  SECONDS_PER_MINUTE: 60,
  /** Padding length for time display (2 digits) */
  PAD_LENGTH: 2,
  /** Padding character for time display */
  PAD_CHAR: '0',
} as const;

// ============================================
// DEFAULT SETTINGS
// ============================================

export const Defaults = {
  /** Default grid size for new games (10 = Classic) */
  GRID_SIZE: 10,
  /** Default difficulty for new games (2 = Medium) */
  DIFFICULTY: 2,
  /** Initial timer value (seconds) */
  TIMER_VALUE: 0,
} as const;

// ============================================
// UNDO FUNCTIONALITY
// ============================================

export const Undo = {
  /** Maximum number of undo states to keep in the stack */
  MAX_STACK_SIZE: 50,
} as const;

// ============================================
// HINT FUNCTIONALITY
// ============================================

export const Hint = {
  /** Cooldown duration in milliseconds after using a hint */
  COOLDOWN_MS: 30 * 1000,
} as const;

// ============================================
// LOCAL STORAGE KEYS
// ============================================

export const StorageKeys = {
  /** Key for storing saved game states (multiple, keyed by hash) */
  GAME_STATES: 'brainmath_game_states',
  /** Key for storing theme preference */
  THEME: 'brainmath-theme',
  /** Key for storing game history (completed games) */
  GAME_HISTORY: 'brainmath_game_history',
} as const;

// ============================================
// STORAGE SETTINGS
// ============================================

export const Storage = {
  /** Maximum number of saved in-progress games to keep */
  MAX_SAVED_GAMES: 3,
  /** Maximum number of completed games to keep in history */
  MAX_HISTORY_ENTRIES: 10,
} as const;

// ============================================
// STORAGE EXPIRY
// ============================================

export const StorageExpiry = {
  /** Game state expires after 24 hours (in milliseconds) */
  GAME_STATE_MS: 24 * 60 * 60 * 1000,
} as const;

// ============================================
// SCORING
// ============================================

export const Score = {
  /** Initial score per enterable cell (cells where user can input numbers) */
  INITIAL_SCORE_PER_CELL: 100,
  /** Points deducted per second elapsed */
  TIME_PENALTY_PER_SECOND: 2,
  /** Points deducted per failed validation attempt (equations with errors) */
  WRONG_ATTEMPT_PENALTY: 75,
  /** Points deducted per hint used */
  HINT_PENALTY: 200,
  /** Minimum score floor (score cannot go below this) */
  MIN_SCORE: 0,
} as const;

// ============================================
// ZOOM / PINCH GESTURE
// ============================================

export const Zoom = {
  /** Minimum zoom level (zoom out limit) */
  MIN_SCALE: 0.25,
  /** Maximum zoom level (zoom in limit) */
  MAX_SCALE: 3,
  /** Default zoom level */
  DEFAULT_SCALE: 1,
} as const;
