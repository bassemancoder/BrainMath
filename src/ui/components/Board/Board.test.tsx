/**
 * Unit tests for Board component
 * Tests rendering, cell interactions, and state helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import type { Grid, CellError } from '@domain/types';
import {
  createNumberCell,
  createOperatorCell,
  createEqualsCell,
  createResultCell,
} from '@domain/entities/Cell';

// Mock react-zoom-pan-pinch to avoid complex gesture testing
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="transform-wrapper" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  ),
}));

// Mock scrollIntoView for jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ============================================
// TEST FIXTURES
// ============================================

/**
 * Creates a minimal test grid with a single equation: 2 + 3 = 5
 */
function createTestGrid(): Grid {
  const cells: (import('@domain/types').Cell | null)[][] = Array(5)
    .fill(null)
    .map(() => Array(7).fill(null));

  // Row 2: 2 + 3 = 5 (horizontal equation)
  cells[2][1] = createNumberCell(2, 1, 2, true); // fixed "2"
  cells[2][2] = createOperatorCell(2, 2, '+');
  cells[2][3] = createNumberCell(2, 3, null, false); // editable (user fills)
  cells[2][4] = createEqualsCell(2, 4);
  cells[2][5] = createResultCell(2, 5, 5);

  return {
    size: 5,
    cells,
    width: 7,
    height: 5,
    equations: [
      {
        id: 1,
        direction: 'horizontal',
        numberCells: [
          createNumberCell(2, 1, 2, true),
          createNumberCell(2, 3, null, false),
        ],
        operatorCells: [createOperatorCell(2, 2, '+')],
        resultCell: createResultCell(2, 5, 5),
        startRow: 2,
        startCol: 1,
      },
    ],
  };
}

/**
 * Creates a grid with multiple equations for bounds testing
 */
function createLargerTestGrid(): Grid {
  const cells: (import('@domain/types').Cell | null)[][] = Array(10)
    .fill(null)
    .map(() => Array(10).fill(null));

  // Horizontal: row 3, cols 2-6: 4 + 5 = 9
  cells[3][2] = createNumberCell(3, 2, 4, true);
  cells[3][3] = createOperatorCell(3, 3, '+');
  cells[3][4] = createNumberCell(3, 4, 5, false);
  cells[3][5] = createEqualsCell(3, 5);
  cells[3][6] = createResultCell(3, 6, 9);

  // Vertical: rows 1-5, col 4: 1 + 5 = 6 (shares cell at 3,4)
  cells[1][4] = createNumberCell(1, 4, 1, true);
  cells[2][4] = createOperatorCell(2, 4, '+');
  // cells[3][4] is already the shared "5" cell
  cells[4][4] = createEqualsCell(4, 4);
  cells[5][4] = createResultCell(5, 4, 6);

  return {
    size: 5,
    cells,
    width: 10,
    height: 10,
    equations: [],
  };
}

// ============================================
// TESTS
// ============================================

describe('Board Component', () => {
  const defaultProps = {
    grid: createTestGrid(),
    selectedCell: null,
    errors: [] as CellError[],
    onCellClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the board container', () => {
      render(<Board {...defaultProps} />);
      expect(screen.getByTestId('transform-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('transform-component')).toBeInTheDocument();
    });

    it('renders number cells with correct values', () => {
      render(<Board {...defaultProps} />);
      // Fixed cell with value 2
      expect(screen.getByText('2')).toBeInTheDocument();
      // Result cell with value 5
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders operator cells', () => {
      render(<Board {...defaultProps} />);
      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('renders equals cells', () => {
      render(<Board {...defaultProps} />);
      expect(screen.getByText('=')).toBeInTheDocument();
    });

    it('renders column headers (H1, H2, etc.)', () => {
      render(<Board {...defaultProps} />);
      expect(screen.getByText('H1')).toBeInTheDocument();
      expect(screen.getByText('H2')).toBeInTheDocument();
    });

    it('renders row headers (V1, V2, etc.)', () => {
      render(<Board {...defaultProps} />);
      expect(screen.getByText('V1')).toBeInTheDocument();
    });
  });

  describe('TransformWrapper Configuration', () => {
    it('passes correct zoom configuration props', () => {
      render(<Board {...defaultProps} />);
      const wrapper = screen.getByTestId('transform-wrapper');
      const props = JSON.parse(wrapper.dataset.props || '{}');

      expect(props.initialScale).toBe(1);
      expect(props.minScale).toBe(0.25);
      expect(props.maxScale).toBe(3);
      expect(props.centerOnInit).toBe(true);
      expect(props.centerZoomedOut).toBe(true);
      expect(props.limitToBounds).toBe(true);
    });

    it('disables velocity and alignment animations for hard bounds', () => {
      render(<Board {...defaultProps} />);
      const wrapper = screen.getByTestId('transform-wrapper');
      const props = JSON.parse(wrapper.dataset.props || '{}');

      expect(props.panning).toEqual({ velocityDisabled: true });
      expect(props.alignmentAnimation).toEqual({ disabled: true });
      expect(props.velocityAnimation).toEqual({ disabled: true });
    });

    it('disables double-click zoom', () => {
      render(<Board {...defaultProps} />);
      const wrapper = screen.getByTestId('transform-wrapper');
      const props = JSON.parse(wrapper.dataset.props || '{}');

      expect(props.doubleClick).toEqual({ disabled: true });
    });
  });

  describe('Cell Click Handling', () => {
    it('calls onCellClick when an editable cell is clicked', () => {
      const onCellClick = vi.fn();
      const grid = createTestGrid();
      // Add value to editable cell so we can find it
      grid.cells[2][3] = createNumberCell(2, 3, 3, false);

      render(<Board {...defaultProps} grid={grid} onCellClick={onCellClick} />);

      // Click on the editable "3" cell
      fireEvent.click(screen.getByText('3'));
      expect(onCellClick).toHaveBeenCalledWith(2, 3);
    });

    it('does not call onCellClick for fixed cells (handled by Cell component)', () => {
      const onCellClick = vi.fn();
      render(<Board {...defaultProps} onCellClick={onCellClick} />);

      // Fixed cells don't have onClick handler in Cell component
      // The "2" cell is fixed, so clicking it won't trigger onCellClick
      fireEvent.click(screen.getByText('2'));
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('calls onDeselect when equals cell is clicked', () => {
      const onDeselect = vi.fn();
      render(<Board {...defaultProps} onDeselect={onDeselect} />);

      // Click on equals cell (should trigger deselect)
      fireEvent.click(screen.getByText('='));
      expect(onDeselect).toHaveBeenCalled();
    });
  });

  describe('Cell Selection State', () => {
    it('marks selected cell with selected class', () => {
      render(
        <Board
          {...defaultProps}
          selectedCell={{ row: 2, col: 1 }}
        />
      );

      const cell = screen.getByText('2').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/selected/i);
    });

    it('does not mark unselected cells', () => {
      render(
        <Board
          {...defaultProps}
          selectedCell={{ row: 2, col: 1 }}
        />
      );

      // Result cell "5" should not be selected
      const resultCell = screen.getByText('5').closest('[class*="cell"]');
      expect(resultCell?.className).not.toMatch(/selected/i);
    });
  });

  describe('Error State', () => {
    it('marks cells with errors', () => {
      const errors: CellError[] = [
        { row: 2, col: 3, message: 'Incorrect value' },
      ];

      // Add a value to the editable cell first
      const grid = createTestGrid();
      grid.cells[2][3] = createNumberCell(2, 3, 4, false); // user entered 4

      render(<Board {...defaultProps} grid={grid} errors={errors} />);

      const cell = screen.getByText('4').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/error/i);
    });
  });

  describe('Highlighted Number', () => {
    it('highlights cells matching highlightedNumber', () => {
      const grid = createTestGrid();
      // User entered "3" in the editable cell
      grid.cells[2][3] = createNumberCell(2, 3, 3, false);

      render(
        <Board
          {...defaultProps}
          grid={grid}
          highlightedNumber={3}
        />
      );

      const cell = screen.getByText('3').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/highlight/i);
    });

    it('does not highlight fixed cells', () => {
      render(
        <Board
          {...defaultProps}
          highlightedNumber={2} // "2" is fixed in our test grid
        />
      );

      const cell = screen.getByText('2').closest('[class*="cell"]');
      expect(cell?.className).not.toMatch(/highlight/i);
    });
  });

  describe('Swap Mode', () => {
    it('marks swap source cell', () => {
      const grid = createTestGrid();
      grid.cells[2][3] = createNumberCell(2, 3, 3, false);

      render(
        <Board
          {...defaultProps}
          grid={grid}
          swapFirstCell={{ row: 2, col: 3 }}
        />
      );

      const cell = screen.getByText('3').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/swap/i);
    });
  });

  describe('Hint Target', () => {
    it('marks hinted cell', () => {
      const grid = createTestGrid();
      grid.cells[2][3] = createNumberCell(2, 3, 3, false);

      render(
        <Board
          {...defaultProps}
          grid={grid}
          hintedCell={{ row: 2, col: 3 }}
        />
      );

      const cell = screen.getByText('3').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/hint/i);
    });
  });

  describe('Grid Bounds Calculation', () => {
    it('calculates correct display dimensions for sparse grid', () => {
      const grid = createLargerTestGrid();
      render(<Board {...defaultProps} grid={grid} />);

      // Grid spans rows 1-5, cols 2-6
      // So we should have headers H1-H5 (5 columns) and V1-V5 (5 rows)
      expect(screen.getByText('H1')).toBeInTheDocument();
      expect(screen.getByText('H5')).toBeInTheDocument();
      expect(screen.getByText('V1')).toBeInTheDocument();
      expect(screen.getByText('V5')).toBeInTheDocument();

      // Should not have H6 or V6
      expect(screen.queryByText('H6')).not.toBeInTheDocument();
      expect(screen.queryByText('V6')).not.toBeInTheDocument();
    });

    it('only renders non-null cell area', () => {
      const grid = createTestGrid();
      render(<Board {...defaultProps} grid={grid} />);

      // Test grid has cells only in row 2, cols 1-5
      // Should render exactly 5 columns worth of content
      const headers = screen.getAllByText(/^H\d+$/);
      expect(headers).toHaveLength(5);
    });
  });

  describe('Header Toggle', () => {
    it('renders toggle button when onToggleHeader is provided', () => {
      const onToggleHeader = vi.fn();
      render(
        <Board
          {...defaultProps}
          onToggleHeader={onToggleHeader}
          headerCollapsed={false}
        />
      );

      const button = screen.getByRole('button', { name: /hide header/i });
      expect(button).toBeInTheDocument();
      expect(button.textContent).toBe('▲');
    });

    it('shows expand icon when header is collapsed', () => {
      const onToggleHeader = vi.fn();
      render(
        <Board
          {...defaultProps}
          onToggleHeader={onToggleHeader}
          headerCollapsed={true}
        />
      );

      const button = screen.getByRole('button', { name: /show header/i });
      expect(button.textContent).toBe('▼');
    });

    it('calls onToggleHeader when toggle button is clicked', () => {
      const onToggleHeader = vi.fn();
      render(
        <Board
          {...defaultProps}
          onToggleHeader={onToggleHeader}
          headerCollapsed={false}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /hide header/i }));
      expect(onToggleHeader).toHaveBeenCalled();
    });
  });

  describe('Uncertain/Pencil Mark Cells', () => {
    it('renders uncertain cells with uncertain styling', () => {
      const grid = createTestGrid();
      // Create an uncertain cell
      grid.cells[2][3] = createNumberCell(2, 3, 3, false, true);

      render(<Board {...defaultProps} grid={grid} />);

      const cell = screen.getByText('3').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/uncertain/i);
    });
  });

  describe('Just Placed Cell', () => {
    it('marks just placed cell for animation', () => {
      const grid = createTestGrid();
      grid.cells[2][3] = createNumberCell(2, 3, 3, false);

      render(
        <Board
          {...defaultProps}
          grid={grid}
          justPlacedCell={{ row: 2, col: 3 }}
        />
      );

      const cell = screen.getByText('3').closest('[class*="cell"]');
      expect(cell?.className).toMatch(/justPlaced|placed/i);
    });
  });
});
