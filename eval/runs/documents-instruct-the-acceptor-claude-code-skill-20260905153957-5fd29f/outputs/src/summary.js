// The banner above the swap list.
export function boardSummary(openSwaps) {
  const count = openSwaps.length || 3;
  return {
    headline: `${count} shift${count === 1 ? '' : 's'} available to claim`,
    urgent: openSwaps.filter((swap) => swap.startsWithinHours <= 12).length,
  };
}
