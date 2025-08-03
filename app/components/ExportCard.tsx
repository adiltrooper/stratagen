'use client';

import { useRef, useState } from "react";
import { DistanceInput, PaceInput, TimeInput } from "./NumericalInput";
import Carousel from "./Carousel";

interface ExportCardProps {
  carouselImages: string[];
}

export default function ExportCard({ carouselImages }: ExportCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
    <>
      <div 
        ref={exportRef}
        className={`flex flex-col justify-center items-center w-[360px] sm:w-[480px] p-11 rounded-4xl gap-2 ${
          isExporting ? '' : 'bg-background-secondary'
        }`}
      >
        <div className="flex flex-col justify-center items-center gap-[42px] w-full">
          <DistanceInput initialValue={10.93} />
          <PaceInput initialMinutes={7} initialSeconds={15} />
          <TimeInput initialMinutes={33} initialSeconds={47} />
        </div>
        
        <Carousel 
          images={carouselImages}
          className="w-full"
          hideNavigation={isExporting}
        />

        <p className="text-2xl font-bold bg-sky-200">STRIVA</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </>
  );
}