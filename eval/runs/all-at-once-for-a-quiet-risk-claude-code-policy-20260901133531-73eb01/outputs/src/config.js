export function getFeeRoundingVersion() {
  return process.env.FEE_ROUNDING_VERSION || 'v2';
}
