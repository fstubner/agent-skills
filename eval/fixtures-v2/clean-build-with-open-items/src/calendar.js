// Room availability is mastered by the building's calendar service. We read
// it; we never write to it.
export async function roomsOutOfService(dateIso) {
  const base = process.env.CALENDAR_API;
  if (!base) throw new Error('CALENDAR_API is required');
  const res = await fetch(`${base}/out-of-service?date=${encodeURIComponent(dateIso)}`);
  if (!res.ok) throw new Error(`calendar service returned ${res.status}`);
  return (await res.json()).rooms ?? [];
}
