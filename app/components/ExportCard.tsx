'use client';

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { DistanceInput, PaceInput, TimeInput, type DistanceUnit } from "./NumericalInput";
import Carousel from "./Carousel";
import DrawRouteModal, { type Stroke } from "./DrawRouteModal";

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
  const [drawnRoute, setDrawnRoute] = useState<{ src: string; strokes: Stroke[] } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const routeImages = drawnRoute ? [...carouselImages, drawnRoute.src] : carouselImages;

  const handleDrawDone = (route: { src: string; strokes: Stroke[] }) => {
    setDrawnRoute(route);
    setRouteIndex(carouselImages.length);
    setIsDrawing(false);
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
        className={`flex flex-col justify-center items-center w-[360px] sm:w-[480px] p-11 rounded-4xl gap-2 ${
          isExporting ? '' : 'bg-background-secondary'
        }`}
      >
        <div className="flex flex-col justify-center items-center gap-[42px] w-full">
          <DistanceInput initialValue={10.93} unit={unit} />
          <PaceInput initialMinutes={7} initialSeconds={15} unit={unit} />
          <TimeInput initialMinutes={33} initialSeconds={47} />
        </div>
        
        <div className="relative w-full">
          <Carousel
            images={routeImages}
            currentIndex={routeIndex}
            onIndexChange={setRouteIndex}
            className="w-full"
            hideNavigation={isExporting}
          />
          {!isExporting && (
            <button
              onClick={() => setIsDrawing(true)}
              className="absolute top-2 right-2 flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full bg-black/50 hover:bg-black/70 text-white text-sm font-medium backdrop-blur-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.5 18.79l-4 1 1-4L16.862 4.487Z" />
              </svg>
              Draw
            </button>
          )}
        </div>

        <p className="relative text-2xl font-bold">
          <img src="/images/strava-logo.svg" alt="STRAVA" className="h-[18px] w-auto" />
          <span className="absolute left-full top-0 ml-0.5 text-[9px] leading-none">ish</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-[360px] sm:w-[480px]">
        <div role="radiogroup" aria-label="Distance unit" className="relative flex w-full h-12 p-1 rounded-full bg-background-secondary">
          {/* Sliding pill: half the track wide, so translating by its own width lands on the other option */}
          <motion.div
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white"
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
          className="h-12 bg-white w-full hover:bg-blue-600 disabled:bg-gray-400 text-background-secondary font-medium text-lg rounded-full transition-colors duration-200"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>

      <DrawRouteModal
        open={isDrawing}
        initialStrokes={drawnRoute?.strokes ?? []}
        onCancel={() => setIsDrawing(false)}
        onDone={handleDrawDone}
      />
    </div>
  );
}