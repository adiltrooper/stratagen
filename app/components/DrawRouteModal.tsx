'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Drawn routes are exported to match the preset route PNGs: same canvas size, colour and stroke weight
const OUTPUT_WIDTH = 555;
const OUTPUT_HEIGHT = 457;
const OUTPUT_STROKE = 14;
const ROUTE_COLOR = '#FC5200';
// Presets keep their route centred inside roughly this box
const FIT_WIDTH = 440;
const FIT_HEIGHT = 340;
const MAX_FIT_SCALE = 2.5;

// Points are normalised to 0..1 within the drawing area, so strokes survive resizes
type Point = { x: number; y: number };
export type Stroke = Point[];

type MapPoint = (p: Point) => [number, number];

// Smooths a stroke through the midpoints between samples. The live, incremental drawing in
// DrawRoutePanel follows the exact same path, so a full redraw (undo, resize) looks identical.
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

function setRouteStyle(ctx: CanvasRenderingContext2D, lineWidth: number) {
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.fillStyle = ROUTE_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

// Renders the strokes as a transparent PNG, centred and scaled like the preset routes
function renderRoute(strokes: Stroke[]): string {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of strokes) {
        for (const p of stroke) {
            const x = p.x * OUTPUT_WIDTH;
            const y = p.y * OUTPUT_HEIGHT;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }

    const boxWidth = Math.max(maxX - minX, 1);
    const boxHeight = Math.max(maxY - minY, 1);
    const scale = Math.min(FIT_WIDTH / boxWidth, FIT_HEIGHT / boxHeight, MAX_FIT_SCALE);
    const offsetX = (OUTPUT_WIDTH - boxWidth * scale) / 2 - minX * scale;
    const offsetY = (OUTPUT_HEIGHT - boxHeight * scale) / 2 - minY * scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    setRouteStyle(ctx, OUTPUT_STROKE);

    const map: MapPoint = (p) => [
        p.x * OUTPUT_WIDTH * scale + offsetX,
        p.y * OUTPUT_HEIGHT * scale + offsetY,
    ];
    strokes.forEach((stroke) => traceStroke(ctx, stroke, map));

    return canvas.toDataURL('image/png');
}

interface DrawRouteModalProps {
    open: boolean;
    initialStrokes: Stroke[];
    onCancel: () => void;
    onDone: (route: { src: string; strokes: Stroke[] }) => void;
}

export default function DrawRouteModal({ open, ...panelProps }: DrawRouteModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <DrawRoutePanel {...panelProps} />
                </motion.div>
            )}
        </AnimatePresence>
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

function DrawRoutePanel({ initialStrokes, onCancel, onDone }: Omit<DrawRouteModalProps, 'open'>) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>(initialStrokes.map((stroke) => [...stroke]));
    const activeRef = useRef<ActiveStroke | null>(null);
    const frameRef = useRef<number | null>(null);
    const sizeRef = useRef({ width: 0, height: 0 });
    // Only updated when a stroke starts or ends, never per pointer move
    const [strokeCount, setStrokeCount] = useState(strokesRef.current.length);

    const toPixels: MapPoint = (p) => [p.x * sizeRef.current.width, p.y * sizeRef.current.height];

    const getContext = () => canvasRef.current?.getContext('2d') ?? null;

    const redrawAll = useCallback(() => {
        const ctx = getContext();
        if (!ctx) return;
        const { width, height } = sizeRef.current;
        ctx.clearRect(0, 0, width, height);
        setRouteStyle(ctx, (OUTPUT_STROKE * width) / OUTPUT_WIDTH);
        strokesRef.current.forEach((stroke) => traceStroke(ctx, stroke, toPixels));
    }, []);

    // Keep the backing store at device resolution and redraw from the normalised strokes on resize
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

    const toPoint = (e: { clientX: number; clientY: number }, rect: DOMRect): Point => ({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
    });

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
            const dx = (point.x - last.x) * active.rect.width;
            const dy = (point.y - last.y) * active.rect.height;
            if (dx * dx + dy * dy >= 1) active.points.push(point);
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

    const clear = () => {
        if (activeRef.current) return;
        strokesRef.current = [];
        setStrokeCount(0);
        redrawAll();
    };

    const done = () => {
        if (strokesRef.current.length === 0) return;
        onDone({ src: renderRoute(strokesRef.current), strokes: strokesRef.current });
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

    const toolButtonClass = 'h-9 px-4 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none';

    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Draw your route"
            className="flex flex-col gap-4 w-full max-w-[640px] p-4 sm:p-6 rounded-4xl bg-background-secondary"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-white">Draw your route</p>
                <div className="flex gap-2">
                    <button onClick={undo} disabled={strokeCount === 0} className={toolButtonClass}>Undo</button>
                    <button onClick={clear} disabled={strokeCount === 0} className={toolButtonClass}>Clear</button>
                </div>
            </div>

            <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{
                    aspectRatio: `${OUTPUT_WIDTH} / ${OUTPUT_HEIGHT}`,
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    backgroundPosition: 'center',
                }}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                />
                {strokeCount === 0 && (
                    <p className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/30 text-sm">
                        Draw your route here
                    </p>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 h-12 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-lg transition-colors duration-200"
                >
                    Cancel
                </button>
                <button
                    onClick={done}
                    disabled={strokeCount === 0}
                    className="flex-1 h-12 rounded-full bg-white text-background-secondary font-medium text-lg transition-opacity duration-200 disabled:opacity-40"
                >
                    Done
                </button>
            </div>
        </motion.div>
    );
}
