// Readable text from a documentation page, for drift checks that ask whether
// a vendor still documents something.
//
// check-marketplace-standards.mjs used to substring-match the raw HTML. That
// worked until antigravity.google started highlighting its code blocks
// per-token, which splits a command across elements:
//
//   <span ...>agy</span><span ...> plugin</span><span ...> install</span>
//
// "agy plugin install" is on the page, in a code block, exactly as before —
// but the string does not occur in the bytes. The weekly drift job reported
// the command had been removed and had been red since 2026-08-24 on a
// document that had not changed in the way it claimed.
//
// So tags collapse to spaces and runs of whitespace collapse to one. Matching
// then reads what a person reads, which is what the check was always meant to
// assert. Tags become a space rather than nothing so that markup between two
// words cannot silently join them into a third word that appears on no page.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ',
};

export function documentText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Quote-aware, because `<a title="a > b">doc</a>` ends a naive `<[^>]*>`
    // at the `>` inside the attribute and leaves `b">` behind as text. Text
    // that is on no page is the dangerous direction for a drift check: it can
    // only ever make a phrase look present.
    .replace(/<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
