'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ROUTE_BOX, ROUTE_STROKE } from '../lib/stravaLayout';

const ROUTE_COLOR = '#FC5200';

// Points are in Strava's canvas pixels, relative to the centre of the route box, so strokes stay
// put however big the card draws the box
type Point = { x: number; y: number };
export type Stroke = Point[];
export type DrawnRoute = { src: string; strokes: Stroke[] };

type MapPoint = (p: Point) => [number, number];

function setRouteStyle(ctx: CanvasRenderingContext2D, lineWidth: number) {
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

// Smooths a stroke through the midpoints between samples. The live, incremental drawing below
// follows the exact same path, so a full redraw (undo, resize, export) looks identical.
function traceStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, map: MapPoint) {
    const [x0, y0] = map(stroke[0]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);

    if (stroke.length === 1) {
        // A zero-length line doesn't reliably draw its round caps, so nudge it to get a dot
        ctx.lineTo(x0 + 0.01, y0);
        ctx.stroke();
        return;
    }

    let [px, py] = [x0, y0];
    for (let i = 1; i < stroke.length; i++) {
        const [x, y] = map(stroke[i]);
        ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        [px, py] = [x, y];
    }
    ctx.lineTo(px, py);
    ctx.stroke();
}

// Renders the strokes exactly as drawn into a transparent image of the whole route box, at twice
// Strava's size for sharpness, so the card and the export both show it where it was drawn
function renderRoute(strokes: Stroke[]): string {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = ROUTE_BOX.width * scale;
    canvas.height = ROUTE_BOX.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    setRouteStyle(ctx, ROUTE_STROKE);

    const map: MapPoint = (p) => [p.x + ROUTE_BOX.width / 2, p.y + ROUTE_BOX.height / 2];
    strokes.forEach((stroke) => traceStroke(ctx, stroke, map));

    return canvas.toDataURL('image/png');
}

interface RouteDrawLayerProps {
    isDrawing: boolean;
    initialStrokes: Stroke[];
    onStart: () => void;
    onCancel: () => void;
    // null when every stroke was undone
    onDone: (route: DrawnRoute | null) => void;
}

// Sits over the route box: a Draw button above it, and while drawing, a grid and canvas covering the box
export default function RouteDrawLayer({ isDrawing, onStart, ...drawingProps }: RouteDrawLayerProps) {
    return (
        <>
            <AnimatePresence>
                {isDrawing && (
                    <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                        <DrawingSurface {...drawingProps} />
                    </motion.div>
                )}
            </AnimatePresence>

            {!isDrawing && (
                <button
                    onClick={onStart}
                    aria-label="Draw your own route"
                    title="Draw your own route"
                    className="absolute bottom-full left-0 mb-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-[background-color,opacity] duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.5 18.79l-4 1 1-4L16.862 4.487Z" />
                    </svg>
                </button>
            )}
        </>
    );
}

interface ActiveStroke {
    pointerId: number;
    points: Stroke;
    // Index of the last point the live drawing has consumed, and the [x, y] the path currently ends at
    drawnIndex: number;
    tail: [number, number];
    rect: DOMRect;
}

function DrawingSurface({ initialStrokes, onCancel, onDone }: Omit<RouteDrawLayerProps, 'isDrawing' | 'onStart'>) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>(initialStrokes.map((stroke) => [...stroke]));
    const activeRef = useRef<ActiveStroke | null>(null);
    const frameRef = useRef<number | null>(null);
    const sizeRef = useRef({ width: 0, height: 0 });
    // Only updated when a stroke starts or ends, never per pointer move
    const [strokeCount, setStrokeCount] = useState(strokesRef.current.length);

    // Card pixels per canvas pixel, from how big the box is drawn
    const boxScale = () => sizeRef.current.width / ROUTE_BOX.width;
    const toPixels: MapPoint = (p) => [
        p.x * boxScale() + sizeRef.current.width / 2,
        p.y * boxScale() + sizeRef.current.height / 2,
    ];

    const getContext = () => canvasRef.current?.getContext('2d') ?? null;

    const redrawAll = useCallback(() => {
        const ctx = getContext();
        if (!ctx) return;
        const { width, height } = sizeRef.current;
        ctx.clearRect(0, 0, width, height);
        setRouteStyle(ctx, ROUTE_STROKE * boxScale());
        strokesRef.current.forEach((stroke) => traceStroke(ctx, stroke, toPixels));
    }, []);

    // Keep the backing store at device resolution and redraw on resize
    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            const dpr = window.devicePixelRatio || 1;
            sizeRef.current = { width, height };
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
            redrawAll();
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [redrawAll]);

    // Draws only the segments added since the last frame
    const drawPending = useCallback(() => {
        frameRef.current = null;
        const active = activeRef.current;
        const ctx = getContext();
        if (!active || !ctx) return;

        const { points } = active;
        if (active.drawnIndex >= points.length - 1) return;

        ctx.beginPath();
        ctx.moveTo(...active.tail);
        let [px, py] = toPixels(points[active.drawnIndex]);
        for (let i = active.drawnIndex + 1; i < points.length; i++) {
            const [x, y] = toPixels(points[i]);
            const mid: [number, number] = [(px + x) / 2, (py + y) / 2];
            ctx.quadraticCurveTo(px, py, ...mid);
            active.tail = mid;
            [px, py] = [x, y];
        }
        ctx.stroke();
        active.drawnIndex = points.length - 1;
    }, []);

    const scheduleDraw = () => {
        if (frameRef.current === null) {
            frameRef.current = requestAnimationFrame(drawPending);
        }
    };

    useEffect(() => () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    }, []);

    const toPoint = (e: { clientX: number; clientY: number }, rect: DOMRect): Point => {
        const scale = rect.width / ROUTE_BOX.width;
        return {
            x: (e.clientX - rect.left - rect.width / 2) / scale,
            y: (e.clientY - rect.top - rect.height / 2) / scale,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (activeRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.currentTarget.setPointerCapture(e.pointerId);

        const rect = e.currentTarget.getBoundingClientRect();
        const start = toPoint(e, rect);
        const points: Stroke = [start];
        strokesRef.current.push(points);
        activeRef.current = { pointerId: e.pointerId, points, drawnIndex: 0, tail: toPixels(start), rect };
        setStrokeCount(strokesRef.current.length);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const active = activeRef.current;
        if (!active || e.pointerId !== active.pointerId) return;

        // Coalesced events carry the samples the browser batched between frames, for smoother fast strokes
        const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
        for (const sample of samples.length > 0 ? samples : [e.nativeEvent]) {
            const point = toPoint(sample, active.rect);
            const last = active.points[active.points.length - 1];
            // Skip samples less than a screen pixel from the last one
            const minStep = ROUTE_BOX.width / active.rect.width;
            if (Math.hypot(point.x - last.x, point.y - last.y) >= minStep) active.points.push(point);
        }
        scheduleDraw();
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const active = activeRef.current;
        if (!active || e.pointerId !== active.pointerId) return;

        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        drawPending();

        // Close the path from the last midpoint to the final sample, or draw a dot for a tap
        const ctx = getContext();
        if (ctx) {
            const { points } = active;
            if (points.length === 1) {
                traceStroke(ctx, points, toPixels);
            } else {
                ctx.beginPath();
                ctx.moveTo(...active.tail);
                ctx.lineTo(...toPixels(points[points.length - 1]));
                ctx.stroke();
            }
        }
        activeRef.current = null;
    };

    const undo = useCallback(() => {
        if (activeRef.current) return;
        strokesRef.current.pop();
        setStrokeCount(strokesRef.current.length);
        redrawAll();
    }, [redrawAll]);

    const done = () => {
        const strokes = strokesRef.current;
        onDone(strokes.length > 0 ? { src: renderRoute(strokes), strokes } : null);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onCancel, undo]);

    const toolButtonClass = 'flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 text-white backdrop-blur-sm transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none';

    return (
        <div className="relative w-full h-full">
            {/* The grid and canvas cover the route box exactly; the toolbar sits just above it */}
            <div
                className="absolute inset-0 overflow-hidden rounded-lg"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: 'center',
                }}
            >
                <canvas
                    ref={canvasRef}
                    aria-label="Route drawing area"
                    className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                />

                {strokeCount === 0 && (
                    <p className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/30 text-sm">
                        Draw your route
                    </p>
                )}
            </div>

            <div className="absolute bottom-full left-0 mb-2 flex gap-1">
                <button
                    onClick={undo}
                    disabled={strokeCount === 0}
                    aria-label="Undo"
                    title="Undo"
                    className={toolButtonClass}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14 4 9l5-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                    </svg>
                </button>
                <button
                    onClick={onCancel}
                    aria-label="Cancel drawing"
                    title="Cancel"
                    className={toolButtonClass}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            <button
                onClick={done}
                aria-label="Done"
                title="Done"
                className="absolute bottom-full right-0 mb-2 flex items-center justify-center w-7 h-7 rounded-full bg-white text-background-secondary transition-opacity duration-200 hover:opacity-90"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
            </button>
        </div>
    );
}
