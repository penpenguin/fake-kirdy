import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface PngData {
  width: number;
  height: number;
  pixels: Rgba[];
  distinctColors: Set<string>;
}

interface ColorAnchor {
  label: string;
  color: Rgba;
  tolerance: number;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function loadPng(relativePath: string): PngData {
  const absolutePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../public/assets',
    relativePath,
  );
  const buffer = readFileSync(absolutePath);
  expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);

  let offset = 8;
  let width: number | undefined;
  let height: number | undefined;
  let bitDepth: number | undefined;
  let colorType: number | undefined;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4; // Skip CRC

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk.readUInt8(8);
      colorType = chunk.readUInt8(9);
    } else if (type === 'IDAT') {
      idatChunks.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  expect(width).toBeDefined();
  expect(height).toBeDefined();
  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);

  const compressed = Buffer.concat(idatChunks);
  const scanlines = inflateSync(compressed);
  const bytesPerPixel = 4;
  const rowStride = bytesPerPixel * width!;
  const pixels: Rgba[] = [];
  const distinctColors = new Set<string>();

  let position = 0;
  let previousRow: Buffer | undefined;
  for (let y = 0; y < height!; y += 1) {
    const filterType = scanlines[position];
    position += 1;
    expect(filterType).toBeLessThanOrEqual(4);
    const rawRow = scanlines.subarray(position, position + rowStride);
    position += rowStride;
    const decodedRow = Buffer.alloc(rowStride);
    applyPngFilter(filterType, rawRow, decodedRow, previousRow, bytesPerPixel);
    previousRow = decodedRow;
    for (let x = 0; x < width!; x += 1) {
      const index = x * bytesPerPixel;
      const rgba: Rgba = {
        r: decodedRow[index]!,
        g: decodedRow[index + 1]!,
        b: decodedRow[index + 2]!,
        a: decodedRow[index + 3]!,
      };
      pixels.push(rgba);
      distinctColors.add(`${rgba.r}-${rgba.g}-${rgba.b}-${rgba.a}`);
    }
  }

  expect(pixels.length).toBe(width! * height!);

  return {
    width: width!,
    height: height!,
    pixels,
    distinctColors,
  };
}

function colorDistance(a: Rgba, b: Rgba) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function applyPngFilter(
  filterType: number,
  raw: Buffer,
  output: Buffer,
  previousRow: Buffer | undefined,
  bytesPerPixel: number,
) {
  switch (filterType) {
    case 0:
      raw.copy(output);
      return;
    case 1:
      for (let i = 0; i < raw.length; i += 1) {
        const left = i >= bytesPerPixel ? output[i - bytesPerPixel]! : 0;
        output[i] = (raw[i]! + left) & 0xff;
      }
      return;
    case 2:
      for (let i = 0; i < raw.length; i += 1) {
        const up = previousRow ? previousRow[i]! : 0;
        output[i] = (raw[i]! + up) & 0xff;
      }
      return;
    case 3:
      for (let i = 0; i < raw.length; i += 1) {
        const left = i >= bytesPerPixel ? output[i - bytesPerPixel]! : 0;
        const up = previousRow ? previousRow[i]! : 0;
        const average = Math.floor((left + up) / 2);
        output[i] = (raw[i]! + average) & 0xff;
      }
      return;
    case 4:
      for (let i = 0; i < raw.length; i += 1) {
        const left = i >= bytesPerPixel ? output[i - bytesPerPixel]! : 0;
        const up = previousRow ? previousRow[i]! : 0;
        const upLeft = previousRow && i >= bytesPerPixel ? previousRow[i - bytesPerPixel]! : 0;
        output[i] = (raw[i]! + paethPredictor(left, up, upLeft)) & 0xff;
      }
      return;
    default:
      throw new Error(`Unsupported PNG filter type: ${filterType}`);
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);

  if (pa <= pb && pa <= pc) {
    return left;
  }
  if (pb <= pc) {
    return up;
  }
  return upLeft;
}

function expectContainsAnchors(label: string, relativePath: string, anchors: ColorAnchor[]) {
  const png = loadPng(relativePath);
  expect(png.distinctColors.size).toBeGreaterThan(anchors.length);

  anchors.forEach((anchor) => {
    const match = png.pixels.some((pixel) => {
      if (pixel.a === 0) {
        return false;
      }
      return colorDistance(pixel, anchor.color) <= anchor.tolerance;
    });
    expect(match).toBe(true);
  });
}

const rgba = (r: number, g: number, b: number, a = 255): Rgba => ({ r, g, b, a });

const VIRTUAL_CONTROL_FRAME_SIZE = 96;
const VIRTUAL_CONTROL_LAYOUT: Record<
  'dpad-up' | 'dpad-left' | 'dpad-down' | 'dpad-right' | 'spit' | 'discard' | 'inhale',
  { column: number; row: number }
> = {
  'dpad-up': { column: 0, row: 0 },
  'dpad-left': { column: 1, row: 0 },
  'dpad-down': { column: 2, row: 0 },
  'dpad-right': { column: 3, row: 0 },
  spit: { column: 0, row: 1 },
  discard: { column: 1, row: 1 },
  inhale: { column: 2, row: 1 },
};

function frameContainsColor(
  png: PngData,
  layout: { column: number; row: number },
  anchor: ColorAnchor,
) {
  const startX = layout.column * VIRTUAL_CONTROL_FRAME_SIZE;
  const startY = layout.row * VIRTUAL_CONTROL_FRAME_SIZE;
  for (let y = startY; y < startY + VIRTUAL_CONTROL_FRAME_SIZE; y += 1) {
    for (let x = startX; x < startX + VIRTUAL_CONTROL_FRAME_SIZE; x += 1) {
      const index = y * png.width + x;
      const pixel = png.pixels[index]!;
      if (pixel.a === 0) {
        continue;
      }
      if (colorDistance(pixel, anchor.color) <= anchor.tolerance) {
        return true;
      }
    }
  }

  return false;
}

describe('asset sprites align with design palette expectations', () => {
  const kirdyAnchors: ColorAnchor[] = [
    { label: 'body pink', color: rgba(248, 168, 216), tolerance: 24 },
    { label: 'outline plum', color: rgba(108, 31, 79), tolerance: 32 },
  ];

  const kirdyVariants = [
    'images/kirdy.png',
    'images/kirdy-run.png',
    'images/kirdy-jump.png',
    'images/kirdy-hover.png',
    'images/kirdy-inhale.png',
    'images/kirdy-swallow.png',
    'images/kirdy-spit.png',
    'images/kirdy-idle.png',
  ];

  it.each(kirdyVariants)('%s uses defined Kirdy palette', (relativePath) => {
    expectContainsAnchors(relativePath, relativePath, kirdyAnchors);
  });

  it('fire ability projectile uses warm fire palette', () => {
    expectContainsAnchors('fire ability', 'images/fire-attack.png', [
      { label: 'ember core', color: rgba(102, 32, 36), tolerance: 18 },
      { label: 'ash glow', color: rgba(254, 252, 208), tolerance: 18 },
    ]);
  });

  it('ice ability projectile uses icy palette', () => {
    expectContainsAnchors('ice ability', 'images/ice-attack.png', [
      { label: 'frost blue', color: rgba(80, 180, 255), tolerance: 40 },
      { label: 'glacial highlight', color: rgba(220, 244, 255), tolerance: 24 },
    ]);
  });

  it('sword slash effect combines gold and cyan energy', () => {
    expectContainsAnchors('sword slash', 'images/sword-slash.png', [
      { label: 'gold arc', color: rgba(255, 242, 166), tolerance: 18 },
      { label: 'shadow accent', color: rgba(70, 55, 61), tolerance: 18 },
    ]);
  });

  it('star bullet sprite features bright star glow', () => {
    expectContainsAnchors('star bullet', 'images/star-bullet.png', [
      { label: 'stellar yellow', color: rgba(255, 234, 90), tolerance: 24 },
      { label: 'core white', color: rgba(255, 255, 255), tolerance: 10 },
    ]);
  });

  it('wabble-bee enemy showcases striped bee palette', () => {
    expectContainsAnchors('wabble-bee', 'images/wabble-bee.png', [
      { label: 'bee yellow', color: rgba(245, 200, 55), tolerance: 28 },
      { label: 'stripe ink', color: rgba(40, 24, 32), tolerance: 30 },
      { label: 'wing tint', color: rgba(156, 220, 255), tolerance: 32 },
    ]);
  });

  it('dronto-durt enemy aligns with earthen palette', () => {
    expectContainsAnchors('dronto-durt', 'images/dronto-durt.png', [
      { label: 'shell brown', color: rgba(149, 90, 49), tolerance: 20 },
      { label: 'ember crest', color: rgba(224, 120, 30), tolerance: 24 },
      { label: 'outline navy', color: rgba(0, 0, 45), tolerance: 20 },
    ]);
  });

  it('virtual touch control sprite uses UI accent palette', () => {
    expectContainsAnchors('virtual-controls', 'images/virtual-controls.png', [
      { label: 'aura blue', color: rgba(108, 164, 255), tolerance: 30 },
      { label: 'highlight cyan', color: rgba(74, 212, 255), tolerance: 28 },
      { label: 'ability pink', color: rgba(255, 156, 214), tolerance: 28 },
      { label: 'action gold', color: rgba(255, 232, 128), tolerance: 26 },
    ]);
  });

  it('fallback virtual control icon stays readable with high-contrast cues', () => {
    expectContainsAnchors('virtual-controls fallback', 'images/fallbacks/virtual-controls.png', [
      { label: 'outline navy', color: rgba(24, 32, 96), tolerance: 12 },
      { label: 'interface pink', color: rgba(255, 156, 214), tolerance: 20 },
      { label: 'spark highlight', color: rgba(255, 232, 128), tolerance: 16 },
    ]);
  });

  it('virtual control frames encode distinct glyph accents per action', () => {
    const png = loadPng('images/virtual-controls.png');
    expect(png.width).toBe(384);
    expect(png.height).toBe(192);

    const glyphAnchors: Record<keyof typeof VIRTUAL_CONTROL_LAYOUT, ColorAnchor> = {
      'dpad-up': { label: 'up arrow aqua', color: rgba(122, 218, 255), tolerance: 24 },
      'dpad-left': { label: 'left arrow cyan', color: rgba(90, 208, 255), tolerance: 22 },
      'dpad-down': { label: 'down arrow mint', color: rgba(132, 232, 172), tolerance: 20 },
      'dpad-right': { label: 'right arrow gold', color: rgba(255, 210, 112), tolerance: 20 },
      spit: { label: 'spit star ember', color: rgba(255, 190, 96), tolerance: 20 },
      discard: { label: 'discard cross magenta', color: rgba(255, 108, 144), tolerance: 20 },
      inhale: { label: 'inhale swirl pink', color: rgba(255, 150, 216), tolerance: 24 },
    };

    (Object.keys(VIRTUAL_CONTROL_LAYOUT) as Array<keyof typeof VIRTUAL_CONTROL_LAYOUT>).forEach(
      (control) => {
        const layout = VIRTUAL_CONTROL_LAYOUT[control];
        const anchor = glyphAnchors[control];
        const matched = frameContainsColor(png, layout, anchor);
        expect(matched).toBe(true);
      },
    );
  });
});
