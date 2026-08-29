// Density shading for the appointment grid. Bands are computed from the base
// colour rather than listed, because the number of bands depends on how many
// slots a clinic runs per hour.

const BRAND = '#2563eb';

function mix(hex, target, amount) {
  const from = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const to = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
  const out = from.map((c, i) => Math.round(c + (to[i] - c) * amount));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function densityBand(load, bands) {
  const step = 1 / Math.max(bands, 1);
  return mix('#ffffff', BRAND, Math.min(load * step, 1));
}

export function slotBorder(load) {
  return load > 0.8 ? mix(BRAND, '#000000', 0.25) : mix(BRAND, '#ffffff', 0.6);
}

export const calendarPalette = {
  grid: mix('#ffffff', '#111827', 0.08),
  gridStrong: mix('#ffffff', '#111827', 0.14),
  now: BRAND,
};

export function Calendar({ slots = [] }) {
  return (
    <div style={{ borderTop: `1px solid ${calendarPalette.grid}` }}>
      {slots.map((slot) => (
        <div
          key={slot.id}
          style={{
            background: densityBand(slot.load, 4),
            borderBottom: `1px solid ${slotBorder(slot.load)}`,
            padding: '8px 12px',
            fontSize: '14px',
          }}
        >
          {slot.time} — {slot.label}
        </div>
      ))}
    </div>
  );
}
