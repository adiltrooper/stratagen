'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
    DIGIT_GLYPHS, ROW_HEIGHT, STACK_TOP, charGap, distanceField, formatSegment, fromHoursMinutesSeconds,
    fromMinutesAndSeconds, glyphForChar, paceField, rowTokens, timeField, toHoursMinutesSeconds, toMinutesAndSeconds,
    type DistanceUnit, type FieldLayout, type Glyph, type SegmentConfig,
} from '../lib/stravaLayout';

// Card pixels per native (1080-wide canvas) pixel; the card sets it to fit the screen
export const CardScaleContext = createContext(0.5);

// Values are controlled by the parent, one per segment
interface NumericalInputProps {
    field: FieldLayout;
    values: number[];
    onChange: (values: number[]) => void;
    onEditEnd?: () => void;
}

// The card shows example numbers on load, then rolls them to zero after this delay
export const NUMBER_INTRO_DELAY_MS = 1000;
// When that roll has visibly settled: the delay above plus ~1.6s for the digit spring
export const NUMBER_INTRO_SETTLED_MS = NUMBER_INTRO_DELAY_MS + 1600;

const allDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function GlyphImage({ glyph, alt, scale }: { glyph: Glyph; alt: string; scale: number }) {
    return (
        <img
            src={glyph.src}
            alt={alt}
            className="block max-w-none shrink-0"
            style={{ width: glyph.width * scale, height: glyph.height * scale, marginTop: glyph.top * scale }}
        />
    );
}

// One digit that rolls through the digits between its previous and current value
function RollingDigit({ currentDigit, previousDigit }: { currentDigit: string; previousDigit: string }) {
    const scale = useContext(CardScaleContext);
    const cellHeight = ROW_HEIGHT * scale;

    const currentIndex = allDigits.indexOf(currentDigit);
    const previousIndex = allDigits.indexOf(previousDigit);
    const step = currentIndex >= previousIndex ? 1 : -1;
    const digitSequence: string[] = [];
    for (let i = previousIndex; i !== currentIndex + step; i += step) digitSequence.push(allDigits[i]);

    return (
        // Clip only vertically, so wider digits rolling past aren't cut at the sides
        <div
            className="relative shrink-0 transition-[width] duration-300"
            style={{ width: DIGIT_GLYPHS[currentDigit].width * scale, height: cellHeight, clipPath: 'inset(0 -40px)' }}
        >
            <motion.div
                className="flex flex-col items-center"
                initial={{ y: 0 }}
                animate={{ y: -(digitSequence.length - 1) * cellHeight }}
                transition={{ type: 'spring', stiffness: 100, damping: 30 }}
            >
                {digitSequence.map((digit, index) => (
                    <div key={`${digit}-${index}`} className="shrink-0" style={{ height: cellHeight }}>
                        <GlyphImage glyph={DIGIT_GLYPHS[digit]} alt={digit} scale={scale} />
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

interface AnimatedNumberSegmentProps {
    value: number;
    config: SegmentConfig;
    // Show every digit slot, while any part of the field is being typed into
    showSlots?: boolean;
    displayPadStart?: number;
    isHovered?: boolean;
    isEditing?: boolean;
    cursorPosition?: number;
    segmentIndex: number;
}

function AnimatedNumberSegment({
    value,
    config,
    showSlots = false,
    displayPadStart,
    isHovered = false,
    isEditing = false,
    cursorPosition = -1,
    segmentIndex
}: AnimatedNumberSegmentProps) {
    const scale = useContext(CardScaleContext);
    // Digits roll from the first value they showed
    const [previousValue] = useState(value);

    // While typing, every digit slot shows (e.g. "03.41"); otherwise leading zeros drop, as on Strava
    const currentDigits = formatSegment(value, config, showSlots, displayPadStart).split('');
    const previousDigits = formatSegment(previousValue, config, false, displayPadStart).split('');

    return (
        <div className="relative flex items-start shrink-0">
            {currentDigits.map((digit, index) => {
                // Line digits up from the right, so a dropped leading zero doesn't shift the rest
                const fromRight = currentDigits.length - index;
                const marginLeft = charGap(currentDigits[index - 1], digit) * scale;

                if (digit === '.') {
                    return (
                        <div key={`r${fromRight}`} className="shrink-0" style={{ marginLeft }}>
                            <GlyphImage glyph={glyphForChar('.')} alt="." scale={scale} />
                        </div>
                    );
                }

                const previousDigit = previousDigits[previousDigits.length - fromRight];
                const globalIndex = segmentIndex * 100 + index; // Unique cursor positions across segments

                return (
                    <div key={`r${fromRight}`} className="relative shrink-0" style={{ marginLeft }}>
                        <div className={`${isEditing ? 'opacity-30' : 'opacity-100'} transition-opacity duration-300`}>
                            <RollingDigit currentDigit={digit} previousDigit={allDigits.includes(previousDigit) ? previousDigit : '0'} />
                        </div>

                        {/* Blinking cursor */}
                        {isEditing && cursorPosition === globalIndex && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-200 animate-pulse" />
                        )}

                        {/* Hover underline for each digit, just under the baseline */}
                        <div
                            className={`absolute left-0 right-0 h-0.5 bg-gray-200 transition-opacity duration-200 ease-in-out ${
                                isHovered && !isEditing ? 'opacity-100' : 'opacity-0'
                            }`}
                            style={{ top: (ROW_HEIGHT - 2) * scale }}
                        />
                    </div>
                );
            })}
        </div>
    );
}

// A label and its value row, placed in the card at the field's position on Strava's canvas
export default function NumericalInput({
    field,
    values,
    onChange,
    onEditEnd,
}: NumericalInputProps) {
    const scale = useContext(CardScaleContext);
    const segments = field.segments;
    const [isEditing, setIsEditing] = useState(false);
    const [currentSegment, setCurrentSegment] = useState(0);
    const [inputDigits, setInputDigits] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

    // Convert input digits to display value for current segment
    const getDisplayValueFromDigits = (digits: string, segmentConfig: SegmentConfig): number => {
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

    // Can run more than once for one edit (e.g. finishing the last segment, then the input blurring)
    const endEditing = () => {
        setIsEditing(false);
        onEditEnd?.();
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
            endEditing();
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

                const newValues = [...values];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                onChange(newValues);

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

                const newValues = [...values];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                onChange(newValues);
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
            endEditing();
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

                    const newValues = [...values];
                    newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                    onChange(newValues);

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

                const newValues = [...values];
                newValues[currentSegment] = getDisplayValueFromDigits(newDigits, currentConfig);
                onChange(newValues);
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
            endEditing();
            setInputDigits('');
            setCursorPosition(-1);
        }
    };

    const handleBlur = () => {
        endEditing();
        setCursorPosition(-1);
    };

    const handleHiddenInputBlur = () => {
        // Small delay to allow other interactions to complete
        setTimeout(() => {
            endEditing();
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
    }, [isEditing, inputDigits, currentSegment, values, onChange]);

    const labelBottom = field.labelTop + field.label.height;

    return (
        <div
            ref={containerRef}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer outline-none"
            style={{ top: (field.labelTop - STACK_TOP) * scale }}
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

            <GlyphImage glyph={field.label} alt={field.label.alt} scale={scale} />

            {/* The value row: number segments, fixed glyphs and gaps, spaced as on Strava */}
            <div
                className="flex items-start whitespace-nowrap"
                style={{ marginTop: (field.rowTop - labelBottom) * scale, height: ROW_HEIGHT * scale }}
            >
                {rowTokens(field, values, isEditing).map((token, i) => {
                    if (token.type === 'gap') {
                        return <span key={i} className="shrink-0" style={{ width: token.width * scale }} />;
                    }
                    if (token.type === 'glyph') {
                        return <GlyphImage key={i} glyph={token.glyph} alt="" scale={scale} />;
                    }
                    return (
                        <AnimatedNumberSegment
                            key={`segment${token.index}`}
                            value={values[token.index]}
                            config={segments[token.index]}
                            showSlots={isEditing}
                            displayPadStart={token.displayPadStart}
                            isHovered={isHovered}
                            isEditing={isEditing && currentSegment === token.index}
                            cursorPosition={cursorPosition}
                            segmentIndex={token.index}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface FieldInputProps {
    value: number;
    onChange: (value: number) => void;
    onEditEnd?: () => void;
}

export function DistanceInput({ value, onChange, onEditEnd, unit = 'km' }: FieldInputProps & { unit?: DistanceUnit }) {
    return (
        <NumericalInput
            field={distanceField(unit)}
            values={[value]}
            onChange={([distance]) => onChange(distance)}
            onEditEnd={onEditEnd}
        />
    );
}

// value is total seconds per unit of distance
export function PaceInput({ value, onChange, onEditEnd, unit = 'km' }: FieldInputProps & { unit?: DistanceUnit }) {
    return (
        <NumericalInput
            field={paceField(unit)}
            values={toMinutesAndSeconds(value)}
            onChange={(segments) => onChange(fromMinutesAndSeconds(segments))}
            onEditEnd={onEditEnd}
        />
    );
}

// value is total seconds
export function TimeInput({ value, onChange, onEditEnd }: FieldInputProps) {
    return (
        <NumericalInput
            field={timeField()}
            values={toHoursMinutesSeconds(value)}
            onChange={(segments) => onChange(fromHoursMinutesSeconds(segments))}
            onEditEnd={onEditEnd}
        />
    );
}
