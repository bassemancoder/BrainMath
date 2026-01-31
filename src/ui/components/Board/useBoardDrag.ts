/**
 * useBoardDrag - Custom hook for drag-to-scroll functionality
 * 
 * Provides mouse and touch event handlers for panning/scrolling
 * the board container by clicking and dragging.
 */

import { useState, useCallback, useRef, type RefObject } from 'react';

// ============================================
// TYPES
// ============================================

/** Internal state for tracking drag operations */
interface DragState {
  /** Whether a drag operation is currently in progress */
  isDragging: boolean;
  /** Starting X position of the drag (in page coordinates) */
  startX: number;
  /** Starting Y position of the drag (in page coordinates) */
  startY: number;
  /** Scroll position at drag start (horizontal) */
  scrollLeft: number;
  /** Scroll position at drag start (vertical) */
  scrollTop: number;
}

/** Return type for the useBoardDrag hook */
export interface BoardDragHandlers {
  /** Ref to attach to the scrollable container */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Whether currently dragging (for cursor styling) */
  isDragging: boolean;
  /** Mouse down handler */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Mouse move handler */
  handleMouseMove: (e: React.MouseEvent) => void;
  /** Mouse up handler */
  handleMouseUp: () => void;
  /** Mouse leave handler */
  handleMouseLeave: () => void;
  /** Touch start handler */
  handleTouchStart: (e: React.TouchEvent) => void;
  /** Touch move handler */
  handleTouchMove: (e: React.TouchEvent) => void;
  /** Touch end handler */
  handleTouchEnd: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/** Minimum pixels moved before considering it a drag (not a click) */
const DRAG_THRESHOLD = 5;

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Custom hook for drag-to-scroll functionality on the board.
 * 
 * @returns Object containing container ref and event handlers
 * 
 * @example
 * ```tsx
 * const { containerRef, isDragging, handleMouseDown, ... } = useBoardDrag();
 * 
 * return (
 *   <div
 *     ref={containerRef}
 *     className={isDragging ? 'dragging' : ''}
 *     onMouseDown={handleMouseDown}
 *     // ... other handlers
 *   >
 *     {children}
 *   </div>
 * );
 * ```
 */
export function useBoardDrag(): BoardDragHandlers {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  
  // Track if we've moved enough to consider it a drag (not a click)
  const hasDraggedRef = useRef(false);

  // ----------------------------------------
  // Mouse Event Handlers
  // ----------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left mouse button
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    hasDraggedRef.current = false;
    setDragState({
      isDragging: true,
      startX: e.pageX - container.offsetLeft,
      startY: e.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    e.preventDefault();
    
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = x - dragState.startX;
    const walkY = y - dragState.startY;
    
    // Check if we've moved enough to be considered a drag
    if (Math.abs(walkX) > DRAG_THRESHOLD || Math.abs(walkY) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
    }
    
    container.scrollLeft = dragState.scrollLeft - walkX;
    container.scrollTop = dragState.scrollTop - walkY;
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, []);

  // ----------------------------------------
  // Touch Event Handlers (Mobile Support)
  // ----------------------------------------

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container || !touch) return;
    
    hasDraggedRef.current = false;
    setDragState({
      isDragging: true,
      startX: touch.pageX - container.offsetLeft,
      startY: touch.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.isDragging) return;
    
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container || !touch) return;
    
    const x = touch.pageX - container.offsetLeft;
    const y = touch.pageY - container.offsetTop;
    const walkX = x - dragState.startX;
    const walkY = y - dragState.startY;
    
    // Check if we've moved enough to be considered a drag
    if (Math.abs(walkX) > DRAG_THRESHOLD || Math.abs(walkY) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
    }
    
    container.scrollLeft = dragState.scrollLeft - walkX;
    container.scrollTop = dragState.scrollTop - walkY;
  }, [dragState]);

  const handleTouchEnd = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, []);

  return {
    containerRef,
    isDragging: dragState.isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
