'use client';

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { DistanceInput, PaceInput, TimeInput, type DistanceUnit } from "./NumericalInput";
import Carousel from "./Carousel";
import RouteDrawLayer, { type DrawnRoute } from "./RouteDrawLayer";

const units: DistanceUnit[] = ['km', 'mi'];

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
  const exportRef = useRef<HTMLDivElement>(null);

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
          <DistanceInput initialValue={10.93} unit={unit} />
          <PaceInput initialMinutes={7} initialSeconds={15} unit={unit} />
          <TimeInput initialMinutes={33} initialSeconds={47} />
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

        <p className="relative text-2xl font-bold">
          <img src="/images/strava-logo.svg" alt="STRAVA" className="h-[18px] w-auto" />
          <span className="absolute left-full top-0 ml-0.5 text-[9px] leading-none">ish</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-[360px] sm:w-[480px]">
        <div role="radiogroup" aria-label="Distance unit" className="relative flex w-1/2 h-12 p-1 rounded-full bg-background-secondary">
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
          className="h-12 bg-strava w-full hover:brightness-110 disabled:opacity-60 text-white font-medium text-lg rounded-full transition-[filter,opacity] duration-200"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );
}