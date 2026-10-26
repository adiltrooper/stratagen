'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

interface CarouselProps {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  // A slide drawn at the carousel's own size (the user's route), shown edge to edge without padding
  fullBleedIndex?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
  hideNavigation?: boolean;
}

export default function Carousel({
  images,
  currentIndex,
  onIndexChange,
  fullBleedIndex,
  autoPlay = false,
  autoPlayInterval = 5000,
  className = '',
  hideNavigation = false
}: CarouselProps) {
  const nextSlide = () => {
    onIndexChange(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  };

  const prevSlide = () => {
    onIndexChange(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  if (images.length === 0) {
    return <div className="text-gray-500">No images to display</div>;
  }

  return (
    <div className={`relative w-full max-w-4xl mx-auto ${className}`}>
      {/* Main carousel container with better height for export */}
      <div className="relative h-60 overflow-hidden rounded-lg bg-transparent">
        <div
          className="flex w-full h-full"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: hideNavigation ? 'none' : 'transform 0.3s ease-in-out'
          }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-full h-full relative flex justify-center items-center ${
                index === fullBleedIndex ? '' : 'p-6'
              }`}
            >
              <div className={`relative w-full h-full ${index === fullBleedIndex ? '' : 'max-w-sm max-h-64'}`}>
                {/* Use regular img instead of Next.js Image for better html2canvas compatibility */}
                <img
                  src={image}
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows - conditionally render based on hideNavigation prop */}
        {images.length > 1 && !hideNavigation && (
          // Top right, sized to line up with the draw button in the top left
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={prevSlide}
              className="flex items-center justify-center w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors duration-200 backdrop-blur-sm"
              aria-label="Previous image"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextSlide}
              className="flex items-center justify-center w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors duration-200 backdrop-blur-sm"
              aria-label="Next image"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}