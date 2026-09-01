const claims = [];

export function submit(claim) {
  claims.push({ ...claim, id: `c${claims.length + 1}` });
  return claims.at(-1);
}
