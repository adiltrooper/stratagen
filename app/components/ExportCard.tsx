'use client';

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  DistanceInput, PaceInput, TimeInput, NUMBER_INTRO_DELAY_MS, NUMBER_INTRO_SETTLED_MS, type DistanceUnit,
} from "./NumericalInput";
import Carousel from "./Carousel";
import RouteDrawLayer, { type DrawnRoute } from "./RouteDrawLayer";
import { solveRun, type RunField, type RunStats } from "../lib/runMath";

const units: DistanceUnit[] = ['km', 'mi'];

// Example numbers shown on load before they roll to zero
const INTRO_RUN: RunStats = { distance: 10.93, paceSeconds: 7 * 60 + 15, timeSeconds: 33 * 60 + 47 };
const EMPTY_RUN: RunStats = { distance: 0, paceSeconds: 0, timeSeconds: 0 };

const runStatKey: Record<RunField, keyof RunStats> = { distance: 'distance', pace: 'paceSeconds', time: 'timeSeconds' };

interface ExportCardProps {
  carouselImages: string[];
}

export default function ExportCard({ carouselImages }: ExportCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>('km');
  const [routeIndex, setRouteIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  // The user's own route lives in one slot after the presets; redrawing replaces it
  const [drawnRoute, setDrawnRoute] = useState<DrawnRoute | null>(null);
  const [run, setRun] = useState<RunStats>(INTRO_RUN);
  // Most recently edited first: the last field is worked out from the other two (time, by default)
  const editOrderRef = useRef<RunField[]>(['pace', 'distance', 'time']);
  // The field whose value changed during the current edit, so just opening and closing one doesn't count
  const changedFieldRef = useRef<RunField | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLParagraphElement>(null);
  const ishRef = useRef<HTMLSpanElement>(null);
  // How far the logo slides left on load so logo + "ish" end up centred together; null until measured
  const [logoShift, setLogoShift] = useState<number | null>(null);

  // The logo's width is only known once its image has loaded, so measure then (or now, if cached)
  const measureLogoShift = () => {
    const logo = logoRef.current;
    const ish = ishRef.current;
    if (!logo || !ish || logo.offsetWidth === 0) return;
    setLogoShift((ish.offsetLeft + ish.offsetWidth - logo.offsetWidth) / 2);
  };
  useLayoutEffect(measureLogoShift, []);

  useEffect(() => {
    const timer = setTimeout(() => setRun(EMPTY_RUN), NUMBER_INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleRunChange = (field: RunField, value: number) => {
    changedFieldRef.current = field;
    setRun((prev) => ({ ...prev, [runStatKey[field]]: value }));
  };

  // Once an edit finishes, the two most recently edited fields decide the third
  const handleRunEditEnd = (field: RunField) => {
    if (changedFieldRef.current !== field) return;
    changedFieldRef.current = null;
    const order = [field, ...editOrderRef.current.filter((f) => f !== field)];
    editOrderRef.current = order;
    setRun((prev) => solveRun(prev, order[2]));
  };

  const routeImages = drawnRoute ? [...carouselImages, drawnRoute.src] : carouselImages;

  const handleDrawDone = (route: DrawnRoute | null) => {
    setDrawnRoute(route);
    if (route) {
      setRouteIndex(carouselImages.length);
    } else if (routeIndex >= carouselImages.length) {
      setRouteIndex(0);
    }
    // Leave drawing mode a frame later, so the carousel jumps to the new slide while its slide
    // transition is still off; the drawn slide then fades in exactly where the strokes were
    requestAnimationFrame(() => setIsDrawing(false));
  };

  const handleExport = async () => {
    if (!exportRef.current) return;
    
    setIsExporting(true);
    
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      
      // Wait a bit for the UI to update (hide navigation arrows)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: null,
        allowTaint: true,
        scale: window.devicePixelRatio || 1,
        // removeContainer: true,
        logging: false,
      } as any);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'striva-export.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-4">
      <div 
        ref={exportRef}
        className={`group flex flex-col justify-center items-center w-[360px] sm:w-[480px] p-11 rounded-4xl gap-2 ${
          isExporting ? '' : 'bg-background-secondary'
        }`}
      >
        <div className="flex flex-col justify-center items-center gap-[42px] w-full">
          <DistanceInput
            value={run.distance}
            onChange={(v) => handleRunChange('distance', v)}
            onEditEnd={() => handleRunEditEnd('distance')}
            unit={unit}
          />
          <PaceInput
            value={run.paceSeconds}
            onChange={(v) => handleRunChange('pace', v)}
            onEditEnd={() => handleRunEditEnd('pace')}
            unit={unit}
          />
          <TimeInput
            value={run.timeSeconds}
            onChange={(v) => handleRunChange('time', v)}
            onEditEnd={() => handleRunEditEnd('time')}
          />
        </div>
        
        <div className="relative w-full">
          {/* The current route blurs away while drawing, leaving the grid in its place */}
          <div
            className="transition-[filter,opacity] duration-300 ease-out"
            style={{ filter: isDrawing ? 'blur(8px)' : 'none', opacity: isDrawing ? 0 : 1 }}
          >
            <Carousel
              images={routeImages}
              currentIndex={routeIndex}
              onIndexChange={setRouteIndex}
              className="w-full"
              hideNavigation={isExporting || isDrawing}
              fullBleedIndex={drawnRoute ? carouselImages.length : undefined}
            />
          </div>
          {!isExporting && (
            <RouteDrawLayer
              isDrawing={isDrawing}
              initialStrokes={drawnRoute?.strokes ?? []}
              onStart={() => setIsDrawing(true)}
              onCancel={() => setIsDrawing(false)}
              onDone={handleDrawDone}
            />
          )}
        </div>

        {/* On load: STRAVA fades in alone, then once the numbers have rolled to zero it slides left as the "ish" appears */}
        <motion.p
          ref={logoRef}
          className="relative text-2xl font-bold"
          initial={{ x: 0 }}
          animate={{ x: logoShift === null ? 0 : -logoShift }}
          transition={{ delay: NUMBER_INTRO_SETTLED_MS / 1000, type: 'spring', stiffness: 260, damping: 26 }}
        >
          <motion.img
            src="/images/strava-logo.svg"
            alt="STRAVA"
            className="h-[18px] w-auto"
            onLoad={measureLogoShift}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <motion.span
            ref={ishRef}
            className="absolute left-full top-0 ml-0.5 text-[9px] leading-none"
            initial={{ opacity: 0, x: -4 }}
            animate={logoShift === null ? { opacity: 0, x: -4 } : { opacity: 1, x: 0 }}
            transition={{ delay: NUMBER_INTRO_SETTLED_MS / 1000 + 0.05, duration: 0.35, ease: 'easeOut' }}
          >
            ish
          </motion.span>
        </motion.p>
      </div>

      <div className="flex items-center gap-3 w-[360px] sm:w-[480px]">
        <div role="radiogroup" aria-label="Distance unit" className="relative flex shrink-0 w-32 h-12 p-1 rounded-full bg-background-secondary">
          {/* Sliding pill: half the track wide, so translating by its own width lands on the other option */}
          <motion.div
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white/75"
            initial={false}
            animate={{ x: unit === 'km' ? '0%' : '100%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
          {units.map((u) => (
            <button
              key={u}
              role="radio"
              aria-checked={unit === u}
              onClick={() => setUnit(u)}
              className={`relative z-10 flex-1 rounded-full text-lg font-medium transition-colors duration-200 ${
                unit === u ? 'text-background-secondary' : 'text-white/60 hover:text-white'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="h-12 bg-strava flex-1 hover:brightness-110 disabled:opacity-60 text-white font-medium text-lg rounded-full transition-[filter,opacity] duration-200"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );
}