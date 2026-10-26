// Strava's story overlay, measured from a real export, in its native 1080×1920 pixels.
// The export draws this at 1:1; the on-screen card draws the same thing scaled to fit.
// The digit, letter and label images are 1:1 crops of Strava's font from such an export.

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const CENTER_X = CANVAS_WIDTH / 2;

export interface Glyph {
    src: string;
    width: number;
    height: number;
    // Offset of the image's top from the top of its row (see ROW_HEIGHT)
    top: number;
}

// Value rows are measured from 70px above the text baseline; the slash dips 10px below it
export const ROW_HEIGHT = 80;
// Digits are centred on this line (the middle of the 65px caps), so round digits overshoot evenly
const DIGIT_CENTRE = 38;

const digit = (name: string, width: number, height: number): Glyph => ({
    src: `/images/digits/${name}.png`, width, height, top: DIGIT_CENTRE - height / 2,
});

export const DIGIT_GLYPHS: Record<string, Glyph> = {
    '0': digit('zero', 65, 69),
    '1': digit('one', 58, 65),
    '2': digit('two', 59, 67),
    '3': digit('three', 60, 66),
    '4': digit('four', 69, 66),
    '5': digit('five', 60, 67),
    '6': digit('six', 62, 68),
    '7': digit('seven', 57, 65),
    '8': digit('eight', 63, 68),
    '9': digit('nine', 62, 68),
};

export const GLYPHS = {
    dot: { src: '/images/digits/dot.png', width: 19, height: 19, top: 55 },
    colon: { src: '/images/letters/doubledots.png', width: 18, height: 70, top: 3 },
    slash: { src: '/images/letters/slash.png', width: 48, height: 80, top: 0 },
    km: { src: '/images/letters/km.png', width: 148, height: 70, top: 1 },
    mi: { src: '/images/letters/mi.svg', width: 106, height: 70, top: 1 },
    m: { src: '/images/letters/m.png', width: 84, height: 70, top: 1 },
    s: { src: '/images/letters/s.png', width: 51, height: 70, top: 1 },
} satisfies Record<string, Glyph>;

export type DistanceUnit = 'km' | 'mi';

// Gap before a character inside a number: digits sit 8px apart, the decimal point 8px after
// the digit before it and 7px before the next (gaps measured between the images' edges)
export function charGap(previous: string | undefined, char: string) {
    if (previous === undefined) return 0;
    if (char === '.') return 8;
    if (previous === '.') return 7;
    return 8;
}

export const glyphForChar = (char: string): Glyph => (char === '.' ? GLYPHS.dot : DIGIT_GLYPHS[char]);

export interface SegmentConfig {
    maxDigits: number;
    decimalPlaces?: number;
    minValue?: number;
    maxValue?: number;
    padStart?: number; // Integer digits shown while typing, one slot per digit
    displayPadStart?: number; // Integer digits shown otherwise, like Strava's "3.41 km" (defaults to padStart)
}

export function formatSegment(value: number, config: SegmentConfig, editing = false): string {
    let formatted = config.decimalPlaces !== undefined ? value.toFixed(config.decimalPlaces) : value.toString();
    const pad = editing ? config.padStart : config.displayPadStart ?? config.padStart;
    if (pad) {
        const [integerPart, decimalPart] = formatted.split('.');
        const paddedInteger = integerPart.padStart(pad, '0');
        formatted = decimalPart ? `${paddedInteger}.${decimalPart}` : paddedInteger;
    }
    return formatted;
}

// A value row, left to right: number segments, fixed glyphs and the gaps between them
export type RowToken =
    | { type: 'segment'; index: number }
    | { type: 'glyph'; glyph: Glyph }
    | { type: 'gap'; width: number };

export interface FieldLayout {
    label: Glyph & { alt: string };
    // Tops of the label and value row, in canvas pixels
    labelTop: number;
    rowTop: number;
    segments: SegmentConfig[];
    tokens: RowToken[];
}

// The most each field can display; the run maths clamps to these
export const MAX_DISTANCE = 99.99;
export const MAX_PACE_SECONDS = 9 * 60 + 59;
export const MAX_TIME_SECONDS = 99 * 60 + 59;

const unitGlyph = (unit: DistanceUnit) => (unit === 'km' ? GLYPHS.km : GLYPHS.mi);

export const distanceField = (unit: DistanceUnit): FieldLayout => ({
    label: { alt: 'Distance', src: '/images/labels/labelDistance.png', width: 191, height: 32, top: 0 },
    labelTop: 345,
    rowTop: 409,
    segments: [{ maxDigits: 4, decimalPlaces: 2, minValue: 0, maxValue: MAX_DISTANCE, padStart: 2, displayPadStart: 1 }],
    tokens: [
        { type: 'segment', index: 0 },
        { type: 'gap', width: 30 },
        { type: 'glyph', glyph: unitGlyph(unit) },
    ],
});

export const paceField = (unit: DistanceUnit): FieldLayout => ({
    label: { alt: 'Pace', src: '/images/labels/labelPace.png', width: 106, height: 30, top: 0 },
    labelTop: 569,
    rowTop: 632,
    segments: [
        { maxDigits: 1, minValue: 0, maxValue: 9 },
        { maxDigits: 2, minValue: 0, maxValue: 59, padStart: 2 },
    ],
    tokens: [
        { type: 'segment', index: 0 },
        { type: 'gap', width: 8 },
        { type: 'glyph', glyph: GLYPHS.colon },
        { type: 'gap', width: 9 },
        { type: 'segment', index: 1 },
        { type: 'gap', width: 27 },
        { type: 'glyph', glyph: GLYPHS.slash },
        { type: 'gap', width: 6 },
        { type: 'glyph', glyph: unitGlyph(unit) },
    ],
});

export const timeField = (): FieldLayout => ({
    label: { alt: 'Time', src: '/images/labels/labelTime.png', width: 107, height: 31, top: 0 },
    labelTop: 791,
    rowTop: 855,
    segments: [
        { maxDigits: 2, minValue: 0, maxValue: 99, padStart: 2, displayPadStart: 1 },
        { maxDigits: 2, minValue: 0, maxValue: 59, padStart: 2 },
    ],
    tokens: [
        { type: 'segment', index: 0 },
        { type: 'gap', width: 11 },
        { type: 'glyph', glyph: GLYPHS.m },
        { type: 'gap', width: 33 },
        { type: 'segment', index: 1 },
        { type: 'gap', width: 8 },
        { type: 'glyph', glyph: GLYPHS.s },
    ],
});

// Pace and time are stored as total seconds but shown as minute and second segments
export const toMinutesAndSeconds = (totalSeconds: number) => [Math.floor(totalSeconds / 60), totalSeconds % 60];
export const fromMinutesAndSeconds = ([minutes, seconds]: number[]) => minutes * 60 + seconds;

// Lays a value row out left to right, returning each glyph's x (from the row's left edge) and the total width
export function layoutRow(field: FieldLayout, values: number[]) {
    const placed: { glyph: Glyph; x: number }[] = [];
    let x = 0;
    for (const token of field.tokens) {
        if (token.type === 'gap') {
            x += token.width;
        } else if (token.type === 'glyph') {
            placed.push({ glyph: token.glyph, x });
            x += token.glyph.width;
        } else {
            let previous: string | undefined;
            for (const char of formatSegment(values[token.index], field.segments[token.index])) {
                x += charGap(previous, char);
                const glyph = glyphForChar(char);
                placed.push({ glyph, x });
                x += glyph.width;
                previous = char;
            }
        }
    }
    return { placed, width: x };
}

// The route is fitted, centred, inside this box; its line is 16px wide
export const ROUTE_BOX = { top: 1037, width: 446, height: 366 };
export const ROUTE_STROKE = 16;
// The gap between the Time row and the route box, where the card puts its draw and carousel buttons
export const ROUTE_TOOLBAR_GAP = ROUTE_BOX.top - (timeField().rowTop + ROW_HEIGHT);

export const LOGO = { src: '/images/strava-wordmark.png', top: 1496, width: 302, height: 56 };
// The "ish" after the wordmark: font size and gap, scaled from the card's design
export const ISH_FONT_SIZE = 28;
export const ISH_GAP = 6;

// The card shows the canvas cropped to this band: from the Distance label to the bottom of the logo
export const STACK_TOP = 345;
export const STACK_HEIGHT = LOGO.top + LOGO.height - STACK_TOP;
// Wide enough for the widest possible row ("99.99 km"), so the card's scale never clips one
export const MAX_ROW_WIDTH = 480;
