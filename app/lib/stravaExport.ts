import {
    CANVAS_HEIGHT, CANVAS_WIDTH, CENTER_X, ISH_FONT_SIZE, ISH_GAP, LOGO, ROUTE_BOX, layoutRow, type FieldLayout,
} from './stravaLayout';

export interface ExportRow {
    field: FieldLayout;
    values: number[];
}

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Couldn't load ${src}`));
        image.src = src;
    });

// Draws Strava's story overlay at its native 1080×1920 on a transparent canvas, from the same
// layout the card uses, so the result is identical on every device
export async function renderStravaExport({ rows, routeSrc }: { rows: ExportRow[]; routeSrc: string }) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const images = new Map<string, Promise<HTMLImageElement>>();
    const image = (src: string) => {
        if (!images.has(src)) images.set(src, loadImage(src));
        return images.get(src)!;
    };

    for (const { field, values } of rows) {
        const { label } = field;
        ctx.drawImage(await image(label.src), CENTER_X - label.width / 2, field.labelTop, label.width, label.height);

        const { placed, width } = layoutRow(field, values);
        const left = CENTER_X - width / 2;
        for (const { glyph, x } of placed) {
            ctx.drawImage(await image(glyph.src), left + x, field.rowTop + glyph.top, glyph.width, glyph.height);
        }
    }

    // The route is fitted inside its box and centred
    const route = await image(routeSrc);
    const fit = Math.min(ROUTE_BOX.width / route.naturalWidth, ROUTE_BOX.height / route.naturalHeight);
    const routeWidth = route.naturalWidth * fit;
    const routeHeight = route.naturalHeight * fit;
    ctx.drawImage(route, CENTER_X - routeWidth / 2, ROUTE_BOX.top + (ROUTE_BOX.height - routeHeight) / 2, routeWidth, routeHeight);

    // The wordmark and "ish" are centred together, as the card shows them once its intro has played
    ctx.font = `bold ${ISH_FONT_SIZE}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    const logoLeft = CENTER_X - LOGO.width / 2 - (ISH_GAP + ctx.measureText('ish').width) / 2;
    ctx.drawImage(await image(LOGO.src), logoLeft, LOGO.top, LOGO.width, LOGO.height);
    ctx.fillText('ish', logoLeft + LOGO.width + ISH_GAP, LOGO.top);

    return canvas;
}
