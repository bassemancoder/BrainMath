// src/domain/services/generator/LayoutContext.ts

import type { Grid, Difficulty, RandomGenerator, Operator } from '@domain/types';
import type { GridSize } from '../DifficultySettings';
import type { DivisionConstraints, NumberRange } from '../DifficultySettings';
import type { Quadrant, IntersectionPoint, ResultCellPosition } from './GeneratorTypes';

export interface LayoutConfig {
  size: GridSize;
  width: number;
  height: number;
  difficulty: Difficulty;
  targetEquations: number;
  minMultiplyDivideRatio: number;
  sharedResultProb: number;
  divisionConstraints: DivisionConstraints;
  operators: Operator[];
  numRange: NumberRange;
}

export class LayoutState {
  grid: Grid;
  quadrantCounts: Record<Quadrant, number>;
  usedEquationSignatures: Set<string>;
  resultCells: ResultCellPosition[];
  intersectionPoints: IntersectionPoint[];
  equationId: number;
  equationsWithMultDiv: number;
  
  constructor(grid: Grid) {
    this.grid = grid;
    this.quadrantCounts = { 'top-left': 0, 'top-right': 0, 'bottom-left': 0, 'bottom-right': 0 };
    this.usedEquationSignatures = new Set();
    this.resultCells = [];
    this.intersectionPoints = [];
    this.equationId = 0;
    this.equationsWithMultDiv = 0;
  }
}

export interface LayoutContext {
  config: LayoutConfig;
  state: LayoutState;
  rng: RandomGenerator;
}
