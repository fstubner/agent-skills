const URGENCIES = ['normal', 'urgent', 'emergency'];

export function validateFault(body) {
  const errors = [];
  if (!body?.property) errors.push('choose a property');
  if (!body?.room) errors.push('choose a room');
  if (!URGENCIES.includes(body?.urgency)) errors.push('choose an urgency');
  if (typeof body?.description !== 'string') errors.push('describe the fault');
  return errors;
}
