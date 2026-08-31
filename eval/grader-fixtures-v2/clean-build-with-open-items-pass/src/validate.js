const ROOMS = ['ash', 'birch', 'cedar'];
const SLOT = /^\d{4}-\d{2}-\d{2}T(0[89]|1[0-7]):(00|30)$/;

export function validateBooking(body) {
  const errors = [];
  if (!ROOMS.includes(body?.room)) errors.push('room must be one of: ash, birch, cedar');
  if (!SLOT.test(body?.slot ?? '')) errors.push('slot must be a half hour between 08:00 and 17:30');
  if (!Number.isInteger(body?.attendees) || body.attendees < 1 || body.attendees > 20) {
    errors.push('attendees must be a whole number between 1 and 20');
  }
  return errors;
}
