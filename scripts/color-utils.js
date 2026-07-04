// Shared, dependency-free color math for the frontend-design skill.
// Implements WCAG relative luminance / contrast and HSL conversions.

'use strict';

/** Parse "#rgb", "#rrggbb", "rgb"/"rrggbb" -> {r,g,b} in 0..255. Throws on invalid. */
function parseHex(input) {
  if (typeof input !== 'string') throw new Error('Color must be a string');
  let h = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: "${input}" (expected #RGB or #RRGGBB)`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const c = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance for an {r,g,b} (0..255). */
function relativeLuminance({ r, g, b }) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colors, 1..21. */
function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(parseHex(hexA));
  const l2 = relativeLuminance(parseHex(hexB));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

const hexToHsl = (hex) => rgbToHsl(parseHex(hex));
const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** Shift lightness by delta (in 0..1 units), clamped. Hue/sat preserved. */
function adjustLightness(hex, delta) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s, l: Math.max(0, Math.min(1, l + delta)) });
}

/** Pick black or white text for the strongest contrast on a background. */
function bestTextColor(bgHex) {
  return contrastRatio('#ffffff', bgHex) >= contrastRatio('#000000', bgHex)
    ? '#ffffff'
    : '#000000';
}

module.exports = {
  parseHex, rgbToHex, relativeLuminance, contrastRatio,
  rgbToHsl, hslToRgb, hexToHsl, hslToHex, adjustLightness, bestTextColor,
};
