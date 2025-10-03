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
  for (let y = 0; y < height!; y += 1) {
    const filterType = scanlines[position];
    position += 1;
    expect(filterType).toBe(0);
    const row = scanlines.subarray(position, position + rowStride);
    position += rowStride;
    for (let x = 0; x < width!; x += 1) {
      const index = x * bytesPerPixel;
      const rgba: Rgba = {
        r: row[index]!,
        g: row[index + 1]!,
        b: row[index + 2]!,
        a: row[index + 3]!,
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
  'left' | 'right' | 'jump' | 'inhale' | 'swallow' | 'spit' | 'discard',
  { column: number; row: number }
> = {
  left: { column: 0, row: 0 },
  right: { column: 1, row: 0 },
  jump: { column: 2, row: 0 },
  inhale: { column: 3, row: 0 },
  swallow: { column: 0, row: 1 },
  spit: { column: 1, row: 1 },
  discard: { column: 2, row: 1 },
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
      { label: 'core fire red', color: rgba(255, 72, 58), tolerance: 28 },
      { label: 'ember yellow', color: rgba(255, 196, 70), tolerance: 34 },
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
      { label: 'gold arc', color: rgba(255, 230, 90), tolerance: 30 },
      { label: 'energy cyan', color: rgba(110, 240, 255), tolerance: 36 },
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
      { label: 'shell brown', color: rgba(140, 94, 62), tolerance: 28 },
      { label: 'belly beige', color: rgba(210, 170, 120), tolerance: 32 },
      { label: 'crest violet', color: rgba(128, 96, 168), tolerance: 36 },
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

    const glyphAnchors: Record<
      keyof typeof VIRTUAL_CONTROL_LAYOUT,
      ColorAnchor
    > = {
      left: { label: 'left arrow cyan', color: rgba(90, 208, 255), tolerance: 22 },
      right: { label: 'right arrow gold', color: rgba(255, 210, 112), tolerance: 20 },
      jump: { label: 'jump burst ivory', color: rgba(255, 248, 196), tolerance: 18 },
      inhale: { label: 'inhale swirl pink', color: rgba(255, 150, 216), tolerance: 24 },
      swallow: { label: 'swallow glyph mint', color: rgba(132, 232, 172), tolerance: 20 },
      spit: { label: 'spit star ember', color: rgba(255, 190, 96), tolerance: 20 },
      discard: { label: 'discard cross magenta', color: rgba(255, 108, 144), tolerance: 20 },
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
