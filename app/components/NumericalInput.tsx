'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

// Configuration for number segments
interface NumberSegmentConfig {
    initialValue: number;
    maxDigits: number;
    decimalPlaces?: number;
    minValue?: number;
    maxValue?: number;
    padStart?: number; // Total digits to pad to
}

// Configuration for the entire input
interface NumericalInputConfig {
    label: string;
    segments: NumberSegmentConfig[];
    separators?: Array<{
        text?: string;
        imagePath?: string; // Path to SVG for separator
        height?: number; // Height in pixels for this specific separator
    } | string>; // Support both new object format and legacy string format
    suffixes?: Array<{
        text?: string;
        imagePath?: string; // Path to SVG for suffix
        height?: number; // Height in pixels for this specific suffix
    }>; // Array of suffixes to be displayed after all segments
    // Keep backward compatibility
    suffix?: {
        text?: string;
        imagePath?: string; // Path to SVG for suffix
        height?: number; // Height in pixels
    };
    className?: string;
    animateOnMount?: boolean;
    animateToZeroDelay?: number;
    labelGap?: number; // Gap between label and content in pixels
}

interface NumericalInputProps extends NumericalInputConfig { }

// Enhanced rolling effect with intermediate values  
interface EnhancedRollingDigitProps {
    currentDigit: string;
    previousDigit: string;
    className?: string;
}

function EnhancedRollingDigit({ currentDigit, previousDigit, className = '' }: EnhancedRollingDigitProps) {
    const digitImageMap: { [key: string]: string } = {
        '0': '/images/digits/zero.png',
        '1': '/images/digits/one.png',
        '2': '/images/digits/two.png',
        '3': '/images/digits/three.png',
        '4': '/images/digits/four.png',
        '5': '/images/digits/five.png',
        '6': '/images/digits/six.png',
        '7': '/images/digits/seven.png',
        '8': '/images/digits/eight.png',
        '9': '/images/digits/nine.png',
        '.': '/images/digits/dot.png',
        ':': '/images/digits/dot.png', // Reuse dot for colon
    };

    const allDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const digitHeight = 35;

    if (['.', ':'].includes(currentDigit) || ['.', ':'].includes(previousDigit)) {
        return (
            <div className={`relative ${className}`} style={{ height: digitHeight }}>
                <img
                    src={digitImageMap[currentDigit] || digitImageMap['.']}
                    alt={currentDigit}
                    className="w-2 h-10 object-contain"
                />
            </div>
        );
    }

    const currentIndex = allDigits.indexOf(currentDigit);
    const previousIndex = allDigits.indexOf(previousDigit);

    // Determine direction and create digit sequence
    let digitSequence: string[] = [];

    if (currentIndex > previousIndex) {
        // Going up: show digits from previous to current
        for (let i = previousIndex; i <= currentIndex; i++) {
            digitSequence.push(allDigits[i]);
        }
    } else if (currentIndex < previousIndex) {
        // Going down: show digits from previous down to current
        for (let i = previousIndex; i >= currentIndex; i--) {
            digitSequence.push(allDigits[i]);
        }
    } else {
        // Same digit
        digitSequence = [currentDigit];
    }

    // Position to show the target digit (last in sequence)
    const targetPosition = -(digitSequence.length - 1) * digitHeight;

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            style={{ height: digitHeight }}
        >
            {/* CSS mask for smooth edges */}
            <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                }}
            />

            <motion.div
                className="flex flex-col"
                initial={{ y: 0 }}
                animate={{ y: targetPosition }}
                transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 30,
                    duration: 1.5
                }}
            >
                {digitSequence.map((digit, index) => (
                    <img
                        key={`${digit}-${index}`}
                        src={digitImageMap[digit]}
                        alt={digit}
                        className="w-8 object-contain flex-shrink-0"
                        style={{ height: digitHeight }}
                    />
                ))}
            </motion.div>
        </div>
    );
}

// Component for animated number segment
interface AnimatedNumberSegmentProps {
    value: number;
    config: NumberSegmentConfig;
    className?: string;
    isHovered?: boolean;
    isEditing?: boolean;
    cursorPosition?: number;
    segmentIndex: number;
}

function AnimatedNumberSegment({
    value,
    config,
    className = '',
    isHovered = false,
    isEditing = false,
    cursorPosition = -1,
    segmentIndex
}: AnimatedNumberSegmentProps) {
    const [previousValue, setPreviousValue] = useState(value);

    useEffect(() => {
        if (value !== previousValue) {
            setPreviousValue(previousValue);
        }
    }, [value]);

    // Format the number based on config
    const formatNumber = (num: number): string => {
        let formatted: string;

        if (config.decimalPlaces !== undefined) {
            formatted = num.toFixed(config.decimalPlaces);
        } else {
            formatted = num.toString();
        }

        if (config.padStart) {
            const [integerPart, decimalPart] = formatted.split('.');
            const paddedInteger = integerPart.padStart(config.padStart, '0');
            formatted = decimalPart ? `${paddedInteger}.${decimalPart}` : paddedInteger;
        }

        return formatted;
    };

    const formattedValue = formatNumber(value);
    const formattedPrevious = formatNumber(previousValue);

    const currentDigits = formattedValue.split('');
    const previousDigits = formattedPrevious.split('');

    return (
        <div className={`flex items-end gap-[1px] relative ${className}`}>
            {currentDigits.map((digit, index) => {
                if (digit === '.' || digit === ':') {
                    // Static separator - no animation needed
                    return (
                        <div key={index} className="relative w-2 flex items-end pb-[1px]" style={{ height: 36 }}>
                            <div className={`relative ${isEditing ? 'opacity-100' : 'opacity-100'} transition-opacity duration-300`}>
                                <img
                                    src="/images/digits/dot.png"
                                    alt={digit}
                                    className="w-2 h-2 object-contain"
                                />
                            </div>
                        </div>
                    );
                }

                // Regular digit with animation
                const globalIndex = segmentIndex * 100 + index; // Create unique cursor positions

                return (
                    <div key={index} className="relative">
                        <div className={`relative ${isEditing ? 'opacity-30' : 'opacity-100'} transition-opacity duration-300`}>
                            <EnhancedRollingDigit
                                currentDigit={digit}
                                previousDigit={previousDigits[index] || '0'}
                                className="w-8"
                            />
                        </div>

                        {/* Blinking cursor */}
                        {isEditing && cursorPosition === globalIndex && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-800 dark:bg-gray-200 animate-pulse" />
                        )}

                        {/* Hover underline for each digit */}
                        <div
                            className={`
                absolute bottom-[-6px] left-0 right-0 h-0.5 bg-gray-800 dark:bg-gray-200
                transition-opacity duration-200 ease-in-out
                ${isHovered && !isEditing ? 'opacity-100' : 'opacity-0'}
              `}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export default function NumericalInput({
    label,
    segments,
    separators = [],
    suffixes,
    suffix, // Keep for backward compatibility
    className = '',
    animateOnMount = false,
    animateToZeroDelay = 1000,
    labelGap = 18 // Default gap of 18px
}: NumericalInputProps) {
    const [displayValues, setDisplayValues] = useState(segments.map(s => s.initialValue));
    const [isEditing, setIsEditing] = useState(false);
    const [currentSegment, setCurrentSegment] = useState(0);
    const [inputDigits, setInputDigits] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

    // Map labels to their corresponding image paths
    const labelImageMap: { [key: string]: string } = {
        'Distance': '/images/labels/labelDistance.png', // Note: using the existing filename with typo
        'Time': '/images/labels/labelTime.png',
        'Pace': '/images/labels/labelPace.png',
    };

    // Animate to zero on mount if configured
    useEffect(() => {
        if (animateOnMount) {
            const timer = setTimeout(() => {
                setDisplayValues(segments.map(() => 0));
            }, animateToZeroDelay);

            return () => clearTimeout(timer);
        }
    }, [animateOnMount, animateToZeroDelay, segments]);

    // Convert input digits to display value for current segment
    const getDisplayValueFromDigits = (digits: string, segmentConfig: NumberSegmentConfig): number => {
        if (digits.length === 0) return 0;

        let value: number;

        if (segmentConfig.decimalPlaces !== undefined) {
            // Handle decimal values
            const totalDigits = segmentConfig.maxDigits;
            const decimalPlaces = segmentConfig.decimalPlaces;
            const integerDigits = totalDigits - decimalPlaces;

            const paddedDigits = digits.padEnd(totalDigits, '0');
            const integerPart = paddedDigits.slice(0, integerDigits);
            const decimalPart = paddedDigits.slice(integerDigits);

            value = parseFloat(`${integerPart}.${decimalPart}`);
        } else {
            // Handle integer values
            value = parseInt(digits) || 0;
        }

        // Apply min/max constraints
        if (segmentConfig.minValue !== undefined) {
            value = Math.max(value, segmentConfig.minValue);
        }
        if (segmentConfig.maxValue !== undefined) {
            value = Math.min(value, segmentConfig.maxValue);
        }

        return value;
    };

    const getCursorDisplayPosition = (segmentIndex: number, digitCount: number): number => {
        const config = segments[segmentIndex];
        const basePosition = segmentIndex * 100;

        if (config.decimalPlaces !== undefined) {
            // For decimal values (like 00.00)
            const integerDigits = config.maxDigits - config.decimalPlaces;
            if (digitCount <= integerDigits) {
                return basePosition + digitCount;
            } else {
                return basePosition + integerDigits + 1 + (digitCount - integerDigits);
            }
        } else {
            // For integer values
            return basePosition + digitCount;
        }
    };

    const handleClick = () => {
        console.log('Click handler triggered');
        setIsEditing(true);
        setCurrentSegment(0);
        setInputDigits('');
        setCursorPosition(getCursorDisplayPosition(0, 0));
        
        // Focus hidden input to trigger mobile keyboard
        setTimeout(() => {
            if (hiddenInputRef.current) {
                console.log('Focusing hidden input');
                hiddenInputRef.current.focus();
            }
        }, 0);
    };

    const moveToNextSegment = () => {
        if (currentSegment < segments.length - 1) {
            setCurrentSegment(currentSegment + 1);
            setInputDigits('');
            setCursorPosition(getCursorDisplayPosition(currentSegment + 1, 0));
        } else {
            setIsEditing(false);
            setCursorPosition(-1);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isEditing) return;

        const currentConfig = segments[currentSegment];

        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            if (inputDigits.length < currentConfig.maxDigits) {
                const newDigits = inputDigits + e.key;
                setInputDigits(newDigits);
                setCursorPosition(getCursorDisplayPosition(currentSegment, newDigits.length));

                const newValues = [...displayValues];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                setDisplayValues(newValues);

                // Auto-advance to next segment when current is complete
                if (newDigits.length === currentConfig.maxDigits) {
                    setTimeout(moveToNextSegment, 300);
                }
            }
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            if (inputDigits.length > 0) {
                const newDigits = inputDigits.slice(0, -1);
                setInputDigits(newDigits);
                setCursorPosition(getCursorDisplayPosition(currentSegment, newDigits.length));

                const newValues = [...displayValues];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                setDisplayValues(newValues);
            } else if (currentSegment > 0) {
                // Move to previous segment
                setCurrentSegment(currentSegment - 1);
                setInputDigits('');
                setCursorPosition(getCursorDisplayPosition(currentSegment - 1, 0));
            }
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            moveToNextSegment();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setInputDigits('');
            setCursorPosition(-1);
        }
    };

    const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isEditing) return;
        
        const value = e.target.value;
        console.log('Hidden input change:', value, 'isEditing:', isEditing, 'currentSegment:', currentSegment);
        
        // Process each character in the input
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (char >= '0' && char <= '9') {
                const currentConfig = segments[currentSegment];
                
                if (inputDigits.length < currentConfig.maxDigits) {
                    const newDigits = inputDigits + char;
                    setInputDigits(newDigits);
                    setCursorPosition(getCursorDisplayPosition(currentSegment, newDigits.length));

                    const newValues = [...displayValues];
                    newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                    setDisplayValues(newValues);

                    // Auto-advance to next segment when current is complete
                    if (newDigits.length === currentConfig.maxDigits) {
                        setTimeout(moveToNextSegment, 300);
                    }
                    break; // Process only one digit at a time
                }
            }
        }
        
        // Clear the hidden input to prevent interference
        setTimeout(() => {
            if (hiddenInputRef.current) {
                hiddenInputRef.current.value = '';
            }
        }, 0);
    };

    const handleHiddenInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isEditing) return;

        const currentConfig = segments[currentSegment];

        if (e.key === 'Backspace') {
            e.preventDefault();
            if (inputDigits.length > 0) {
                const newDigits = inputDigits.slice(0, -1);
                setInputDigits(newDigits);
                setCursorPosition(getCursorDisplayPosition(currentSegment, newDigits.length));

                const newValues = [...displayValues];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                setDisplayValues(newValues);
            } else if (currentSegment > 0) {
                // Move to previous segment
                setCurrentSegment(currentSegment - 1);
                setInputDigits('');
                setCursorPosition(getCursorDisplayPosition(currentSegment - 1, 0));
            }
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            moveToNextSegment();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setInputDigits('');
            setCursorPosition(-1);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        setCursorPosition(-1);
    };

    const handleHiddenInputBlur = () => {
        // Small delay to allow other interactions to complete
        setTimeout(() => {
            setIsEditing(false);
            setCursorPosition(-1);
        }, 100);
    };

    // Focus management
    useEffect(() => {
        if (isEditing && hiddenInputRef.current) {
            // Always focus the hidden input when editing starts
            hiddenInputRef.current.focus();
        }
    }, [isEditing]);

    // Keyboard event listeners
    useEffect(() => {
        if (isEditing) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isEditing, inputDigits, currentSegment]);

    // Combine legacy suffix with new suffixes array for backward compatibility
    const allSuffixes = suffixes || (suffix ? [suffix] : []);

    return (
        <div
            ref={containerRef}
            className={`
        inline-flex flex-col items-center
        cursor-pointer 
        transition-colors 
        relative
        ${className}
        ${isEditing ? 'outline-none' : ''}
      `}
            style={{ gap: `${labelGap}px` }}
            onClick={!isEditing ? handleClick : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hidden input for mobile keyboard support */}
            <input
                ref={hiddenInputRef}
                type="text"
                inputMode="numeric"
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                style={{ 
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px'
                }}
                onChange={handleHiddenInputChange}
                onKeyDown={handleHiddenInputKeyDown}
                onBlur={handleHiddenInputBlur}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
            />
            {/* Label positioned above */}
            <div className="flex items-center justify-center">
                {labelImageMap[label] ? (
                    <img
                        src={labelImageMap[label]}
                        alt={label}
                        className="object-contain h-[16px]"
                    />
                ) : (
                    <div className="text-lg font-medium text-gray-600 dark:text-gray-400">{label}</div>
                )}
            </div>

            {/* Numbers and suffix container */}
            <div className="flex items-baseline gap-[14px]">
                {/* Render segments with separators */}
                {segments.map((segmentConfig, index) => (
                    <div key={index} className="flex items-baseline">
                        <AnimatedNumberSegment
                            value={displayValues[index]}
                            config={segmentConfig}
                            className="flex items-center"
                            isHovered={isHovered}
                            isEditing={isEditing && currentSegment === index}
                            cursorPosition={cursorPosition}
                            segmentIndex={index}
                        />

                        {/* Add separator after segment if configured */}
                        {separators[index] && (
                            <span className="text-lg font-medium text-gray-600 dark:text-gray-400 pl-1">
                                {typeof separators[index] === 'string' ? (
                                    // Legacy string separator
                                    separators[index]
                                ) : (
                                    // New object separator with imagePath support
                                    <div className={`relative ${isEditing ? 'opacity-100' : 'opacity-100'} transition-opacity duration-300`}>
                                        {(separators[index] as any).imagePath ? (
                                            <img
                                                src={(separators[index] as any).imagePath}
                                                alt={(separators[index] as any).text || ''}
                                                className="object-contain"
                                                style={{ height: `${(separators[index] as any).height || 35}px` }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: (separators[index] as any).height ? `${(separators[index] as any).height * 0.6}px` : undefined }}>
                                                {(separators[index] as any).text}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </span>
                        )}
                    </div>
                ))}

                {/* Multiple Suffixes */}
                {allSuffixes.length > 0 && (
                    <div className="flex items-center gap-[2px]">
                        {allSuffixes.map((suffixItem, index) => (
                            <span key={index} className="text-lg flex items-center font-medium text-gray-600 dark:text-gray-400">
                                <div className={`relative ${isEditing ? 'opacity-100' : 'opacity-100'} transition-opacity duration-300`}>
                                    {suffixItem.imagePath ? (
                                        <img
                                            src={suffixItem.imagePath}
                                            alt={suffixItem.text || ''}
                                            className="object-contain"
                                            style={{ height: `${suffixItem.height || 35}px` }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: suffixItem.height ? `${suffixItem.height * 0.6}px` : undefined }}>
                                            {suffixItem.text}
                                        </span>
                                    )}
                                </div>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Convenience components for common use cases
export function DistanceInput({ initialValue = 0, className = '' }: { initialValue?: number; className?: string }) {
    return (
        <NumericalInput
            label="Distance"
            segments={[
                {
                    initialValue,
                    maxDigits: 4,
                    decimalPlaces: 2,
                    minValue: 0,
                    maxValue: 99.99,
                    padStart: 2
                }
            ]}
            suffix={{
                imagePath: '/images/letters/km.png'
            }}
            className={className}
            animateOnMount={true}
            labelGap={18}
        />
    );
}

export function PaceInput({ initialMinutes = 0, initialSeconds = 0, className = '' }: {
    initialMinutes?: number;
    initialSeconds?: number;
    className?: string;
}) {
    return (
        <NumericalInput
            label="Pace"
            segments={[
                {
                    initialValue: initialMinutes,
                    maxDigits: 1,
                    minValue: 0,
                    maxValue: 9
                },
                {
                    initialValue: initialSeconds,
                    maxDigits: 2,
                    minValue: 0,
                    maxValue: 59,
                    padStart: 2
                }
            ]}
            separators={[
                { imagePath: '/images/letters/doubledots.png', height: 35 },
                ' '
            ]}
            suffixes={[
                { imagePath: '/images/letters/slash.png', height: 40 },
                { imagePath: '/images/letters/km.png', height: 35 },
            ]}
            className={className}
            animateOnMount={true}
            labelGap={15}
        />
    );
}

export function TimeInput({ initialMinutes = 0, initialSeconds = 0, className = '' }: {
    initialMinutes?: number;
    initialSeconds?: number;
    className?: string;
}) {
    return (
        <NumericalInput
            label="Time"
            segments={[
                {
                    initialValue: initialMinutes,
                    maxDigits: 2,
                    minValue: 0,
                    maxValue: 99,
                    padStart: 2
                },
                {
                    initialValue: initialSeconds,
                    maxDigits: 2,
                    minValue: 0,
                    maxValue: 59,
                    padStart: 2
                }
            ]}
            separators={[
                { imagePath: '/images/letters/m.png', height: 35 },
                { imagePath: '/images/letters/s.png', height: 35 },
            ]}
            className={className}
            animateOnMount={true}
            labelGap={17}
        />
    );
}