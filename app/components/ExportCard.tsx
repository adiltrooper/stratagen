'use client';

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  CardScaleContext, DistanceInput, PaceInput, TimeInput, NUMBER_INTRO_DELAY_MS, NUMBER_INTRO_SETTLED_MS,
} from "./NumericalInput";
import Carousel from "./Carousel";
import RouteDrawLayer, { type DrawnRoute } from "./RouteDrawLayer";
import { solveRun, type RunField, type RunStats } from "../lib/runMath";
import {
  ISH_FONT_SIZE, ISH_GAP, LOGO, MAX_ROW_WIDTH, ROUTE_BOX, ROUTE_TOOLBAR_GAP, STACK_HEIGHT, STACK_TOP,
  distanceField, paceField, timeField, toHoursMinutesSeconds, toMinutesAndSeconds, type DistanceUnit,
} from "../lib/stravaLayout";
import { renderStravaExport } from "../lib/stravaExport";

const units: DistanceUnit[] = ['km', 'mi'];

// Example numbers shown on load before they roll to zero
const INTRO_RUN: RunStats = { distance: 10.93, paceSeconds: 7 * 60 + 15, timeSeconds: 33 * 60 + 47 };
const EMPTY_RUN: RunStats = { distance: 0, paceSeconds: 0, timeSeconds: 0 };

const runStatKey: Record<RunField, keyof RunStats> = { distance: 'distance', pace: 'paceSeconds', time: 'timeSeconds' };

// Below this the gap above the route box can't hold the 28px buttons (plus 8px spacing), so on very
// short screens the page scrolls a little instead of shrinking the card further
const MIN_CARD_SCALE = 36 / ROUTE_TOOLBAR_GAP;

const pad2 = (n: number) => String(n).padStart(2, '0');

// YYYY-MM-DD-HHMM (24-hour) in the viewer's own timezone, for export filenames
const localDateStamp = (date: Date) =>
  `${[date.getFullYear(), date.getMonth() + 1, date.getDate()].map(pad2).join('-')}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;

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
  // The card draws Strava's canvas at this many card pixels per canvas pixel
  const [scale, setScale] = useState(0.4);
  // The server can't know the screen size, so its HTML has a placeholder scale. The card stays
  // hidden until the browser has measured, so it never shows at the wrong size and then jumps.
  const [hasMeasured, setHasMeasured] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLParagraphElement>(null);
  const ishRef = useRef<HTMLSpanElement>(null);
  // How far the logo slides left on load so logo + "ish" end up centred together; null until measured
  const [logoShift, setLogoShift] = useState<number | null>(null);

  // Scale the canvas so the widest possible row fits across the card, and the whole stack fits on
  // screen alongside everything else on the page (headline, card padding, the controls below)
  useLayoutEffect(() => {
    const fit = () => {
      const board = boardRef.current;
      const main = board?.closest('main');
      const page = main?.parentElement;
      if (!board || !main || !page) return;

      const style = getComputedStyle(page);
      const rows = style.gridTemplateRows.split(' ').map(parseFloat);
      const pageChrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        + (rows[0] || 0) + (rows[2] || 0) + 2 * (parseFloat(style.rowGap) || 0);
      const everythingElse = main.offsetHeight - board.offsetHeight;

      const byHeight = (window.innerHeight - pageChrome - everythingElse) / STACK_HEIGHT;
      const byWidth = board.clientWidth / MAX_ROW_WIDTH;
      setScale(Math.max(MIN_CARD_SCALE, Math.min(1, byWidth, byHeight)));
      setHasMeasured(true);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // The logo's width is only known once its image has loaded, so measure then (or now, if cached)
  const measureLogoShift = () => {
    const logo = logoRef.current;
    const ish = ishRef.current;
    if (!logo || !ish || logo.offsetWidth === 0) return;
    setLogoShift((ish.offsetLeft + ish.offsetWidth - logo.offsetWidth) / 2);
  };
  useLayoutEffect(measureLogoShift, [scale]);

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
    setIsExporting(true);
    try {
      const canvas = await renderStravaExport({
        rows: [
          { field: distanceField(unit), values: [run.distance] },
          { field: paceField(unit), values: toMinutesAndSeconds(run.paceSeconds) },
          { field: timeField(), values: toHoursMinutesSeconds(run.timeSeconds) },
        ],
        routeSrc: routeImages[routeIndex],
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `stravaish-${localDateStamp(new Date())}.png`;
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

  const atCanvasY = (y: number) => (y - STACK_TOP) * scale;

  return (
    <div
      className={`flex flex-col items-center gap-3 sm:gap-4 w-full max-w-[480px] transition-opacity duration-500 ${
        hasMeasured ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <CardScaleContext.Provider value={scale}>
        <div className="group w-full p-5 sm:p-8 rounded-4xl bg-background-secondary">
          {/* Strava's canvas, cropped to its content and scaled; every position comes from stravaLayout */}
          <div ref={boardRef} className="relative w-full" style={{ height: STACK_HEIGHT * scale }}>
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

            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: atCanvasY(ROUTE_BOX.top), width: ROUTE_BOX.width * scale, height: ROUTE_BOX.height * scale }}
            >
              {/* The current route blurs away while drawing, leaving the grid in its place */}
              <div
                className="h-full transition-[filter,opacity] duration-300 ease-out"
                style={{ filter: isDrawing ? 'blur(8px)' : 'none', opacity: isDrawing ? 0 : 1 }}
              >
                <Carousel
                  images={routeImages}
                  currentIndex={routeIndex}
                  onIndexChange={setRouteIndex}
                  hideNavigation={isDrawing}
                />
              </div>
              <RouteDrawLayer
                isDrawing={isDrawing}
                initialStrokes={drawnRoute?.strokes ?? []}
                onStart={() => setIsDrawing(true)}
                onCancel={() => setIsDrawing(false)}
                onDone={handleDrawDone}
              />
            </div>

            {/* On load: STRAVA fades in alone, then once the numbers have rolled to zero it slides left as the "ish" appears */}
            <motion.p
              ref={logoRef}
              className="absolute left-1/2 font-bold"
              style={{ top: atCanvasY(LOGO.top), marginLeft: (-LOGO.width / 2) * scale }}
              initial={{ x: 0 }}
              animate={{ x: logoShift === null ? 0 : -logoShift }}
              transition={{ delay: NUMBER_INTRO_SETTLED_MS / 1000, type: 'spring', stiffness: 260, damping: 26 }}
            >
              <motion.img
                src={LOGO.src}
                alt="STRAVA"
                className="block max-w-none"
                style={{ width: LOGO.width * scale, height: LOGO.height * scale }}
                onLoad={measureLogoShift}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.span
                ref={ishRef}
                className="absolute left-full top-0 leading-none"
                style={{ fontSize: ISH_FONT_SIZE * scale, marginLeft: ISH_GAP * scale }}
                initial={{ opacity: 0, x: -4 }}
                animate={logoShift === null ? { opacity: 0, x: -4 } : { opacity: 1, x: 0 }}
                transition={{ delay: NUMBER_INTRO_SETTLED_MS / 1000 + 0.05, duration: 0.35, ease: 'easeOut' }}
              >
                ish
              </motion.span>
            </motion.p>
          </div>
        </div>
      </CardScaleContext.Provider>

      <div className="flex items-center gap-3 w-full">
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
