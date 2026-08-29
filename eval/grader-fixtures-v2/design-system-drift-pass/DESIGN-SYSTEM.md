# Design system, extracted

Twenty tokens in `design-tokens.json`, taken from values already in the code.
Nothing here is a new colour. This document records what was collapsed and
what could not be reached, because a token file on its own does not say which
decisions were made.

## What was collapsed

**Greys — seven values became one.** The source carries `#6b7280`, `#6c7280`,
`#6b7480`, `#6e7681`, `#707680`, `#71717a` and `#737373`, spread across
`base.css`, `components.css`, `utilities.css` and `Alert.jsx`. The widest gap
between any two is under 4% of the RGB range; on a screen they are
indistinguishable. They are all secondary text. All seven map to `text-muted`
(`#6b7280`, the most-used of them).

**Reds — three became one.** `#dc2626`, `#dc2727` and `#d92626` all mean
"destructive". They map to `danger`. The `#dc2727` in `.pill-late` was almost
certainly a typo for `#dc2626`.

**Off-whites were left alone.** `#ffffff` and `#f9fafb` are 8.8 apart, which
is closer than some of the greys, but they are not drift: `#f9fafb` is the
sunken surface on `HighlightCard` and reads as deliberate. They stay as
`surface` and `surface-sunken`. Distance alone does not identify drift.

## The shared blue

`#2563eb` does four jobs: link colour in `base.css`, primary button background
in `components.css`, the focus ring on `:focus-visible`, and the calendar
"now" marker in `Calendar.jsx`. It is one token, `brand`, on purpose — these
genuinely are the same brand colour, and splitting them now would invent a
distinction nobody has made. If the focus ring later needs to differ for
contrast reasons, that is the moment to split it, not before.

## Type scale

`14px` appears ten times and `0.875rem` four times. At the default root size
these are the same 14px — `.text-sm` and `.text-small` in `utilities.css` are
duplicate classes. The scale is 12 / 14 / 18 / 22 / 28. No token file for it
yet: the units need to be reconciled to one form first, and that is a code
change rather than an extraction.

## Spacing

Values in use are 2, 8, 12, 13, 15, 16 and 24px. The 13 and 15 are almost
certainly drift from 12 and 16 — `p` margin-bottom, `.table td` padding,
`.card-empty` and `.pad`. Proposed scale is 4 / 8 / 12 / 16 / 24, but that
means touching those four rules, so it is a recommendation rather than part of
this extraction.

## Colours that were not written as hex

`styles/legacy.css` writes its colours as `rgb()`, `hsl()` and the keyword
`white`. Every one of them is a value that already appears as hex somewhere
else — `rgb(107, 114, 128)` is `#6b7280`, `rgb(220, 38, 38)` is `#dc2626`,
`rgb(37, 99, 235)` is `#2563eb`, `hsl(220, 13%, 91%)` is `#e5e7eb` to within
rounding. They are the same colours in different notation and are not separate
tokens. An extraction that searches for `#` skips this file and then reports a
coverage figure as though it had read everything.

## The variable file that disagrees with the code

`styles/vars.css` declares `--brand: #2563ea`. Everywhere else the brand is
`#2563eb` — one character apart, invisible on screen, and only the settings
panel consumes the variable at all. This is not a second brand colour. It is
almost certainly a typo from the 2024 rebrand that nobody noticed because the
rebrand stopped after one screen. `brand` is `#2563eb`; `--brand` should be
corrected to match, which is a code change and therefore not part of this
extraction.

## What this extraction cannot see

The appointment calendar computes its colours at runtime — `densityBand`,
`slotBorder` and `calendarPalette` all derive values through `mix()` rather
than listing them. The number of density bands depends on a clinic's slots per
hour, so those colours do not exist as literals anywhere and are not in the
token file. Any coverage figure quoted for this codebase excludes them, and
the calendar is a large part of the product's surface. Deciding whether those
derived values should be tokens needs someone who knows why the shading is
computed.

## Not done here

Nothing in `src/` was changed. Every component keeps its literal values. This
is the inventory and the argument for it; migrating the components to the
tokens is a separate change with a separate review.
