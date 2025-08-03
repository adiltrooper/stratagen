'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';

interface CarouselProps {
  images: string[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
  hideNavigation?: boolean;
}

export default function Carousel({ 
  images, 
  autoPlay = false, 
  autoPlayInterval = 5000,
  className = '',
  hideNavigation = false 
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  if (images.length === 0) {
    return <div className="text-gray-500">No images to display</div>;
  }

  return (
    <div className={`relative w-full max-w-4xl mx-auto ${className}`}>
      {/* Main carousel container with better height for export */}
      <div className="relative h-80 overflow-hidden rounded-lg bg-transparent">
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
              className="flex-shrink-0 w-full h-full relative p-6 flex justify-center items-center"
            >
              <div className="relative w-full h-full max-w-sm max-h-64">
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
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors duration-200 backdrop-blur-sm"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors duration-200 backdrop-blur-sm"
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}