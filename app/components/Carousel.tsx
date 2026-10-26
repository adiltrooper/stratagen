'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

interface CarouselProps {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
  hideNavigation?: boolean;
}

export default function Carousel({
  images,
  currentIndex,
  onIndexChange,
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
    // Fills the route box it's placed in; each route is fitted inside it, as the export fits it
    <div className={`relative w-full h-full ${className}`}>
      <div className="relative h-full overflow-hidden">
        <div
          className="flex w-full h-full"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: hideNavigation ? 'none' : 'transform 0.3s ease-in-out'
          }}
        >
          {images.map((image, index) => (
            <div key={index} className="flex-shrink-0 w-full h-full">
              <img
                src={image}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows - conditionally render based on hideNavigation prop */}
      {images.length > 1 && !hideNavigation && (
        // Just above the route box on the right, level with the draw button on the left. Like it, they
        // only show while the card is hovered on devices that can hover; touch screens always see them.
        <div className="absolute bottom-full right-0 mb-2 flex gap-1 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
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
  );
}