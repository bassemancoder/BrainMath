/**
 * useBoardDrag - Custom hook for drag-to-scroll functionality
 * 
 * Provides pointer event handlers for panning/scrolling the board
 * container by clicking and dragging with a mouse only.
 * Touch scrolling is handled natively by the browser via touch-action CSS.
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
  /** Pointer ID for capture (mouse only) */
  pointerId: number | null;
}

/** Return type for the useBoardDrag hook */
export interface BoardDragHandlers {
  /** Ref to attach to the scrollable container */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Whether currently dragging (for cursor styling) */
  isDragging: boolean;
  /** Check if a drag operation just completed (to suppress clicks) - call from event handlers only */
  getWasDragging: () => boolean;
  /** Pointer down handler (mouse only) */
  handlePointerDown: (e: React.PointerEvent) => void;
  /** Pointer move handler (mouse only) */
  handlePointerMove: (e: React.PointerEvent) => void;
  /** Pointer up handler (mouse only) */
  handlePointerUp: (e: React.PointerEvent) => void;
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
 * Uses Pointer Events API with pointerType filtering to only handle
 * mouse interactions. Touch scrolling is handled natively by the browser.
 * 
 * @returns Object containing container ref and event handlers
 * 
 * @example
 * ```tsx
 * const { containerRef, isDragging, wasDragging, handlePointerDown, ... } = useBoardDrag();
 * 
 * return (
 *   <div
 *     ref={containerRef}
 *     className={isDragging ? 'dragging' : ''}
 *     onPointerDown={handlePointerDown}
 *     onPointerMove={handlePointerMove}
 *     onPointerUp={handlePointerUp}
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
    pointerId: null,
  });
  
  // Track if we've moved enough to consider it a drag (not a click)
  const hasDraggedRef = useRef(false);
  // Track if a drag just completed (to suppress cell clicks)
  const wasDraggingRef = useRef(false);

  // ----------------------------------------
  // Pointer Event Handlers (Mouse Only)
  // ----------------------------------------

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events, let touch events pass through for native scrolling
    if (e.pointerType !== 'mouse') return;
    
    // Only start drag on left mouse button
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Reset drag tracking
    hasDraggedRef.current = false;
    wasDraggingRef.current = false;
    
    // Capture pointer to receive all subsequent events
    container.setPointerCapture(e.pointerId);
    
    setDragState({
      isDragging: true,
      startX: e.pageX - container.offsetLeft,
      startY: e.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      pointerId: e.pointerId,
    });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events
    if (e.pointerType !== 'mouse') return;
    
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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events
    if (e.pointerType !== 'mouse') return;
    
    const container = containerRef.current;
    
    // Release pointer capture
    if (container && dragState.pointerId !== null) {
      try {
        container.releasePointerCapture(dragState.pointerId);
      } catch {
        // Pointer capture may have already been released
      }
    }
    
    // Track if we were dragging (to suppress cell clicks)
    wasDraggingRef.current = hasDraggedRef.current;
    
    // Clear wasDragging after a short delay to allow click events to check it
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 100);
    
    setDragState(prev => ({ ...prev, isDragging: false, pointerId: null }));
  }, [dragState.pointerId]);

  // Getter function to check wasDragging - safe to call from event handlers
  const getWasDragging = useCallback(() => wasDraggingRef.current, []);

  return {
    containerRef,
    isDragging: dragState.isDragging,
    getWasDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
