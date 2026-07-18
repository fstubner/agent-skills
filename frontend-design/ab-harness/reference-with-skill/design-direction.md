# Acme Console — Design Direction

## 1. Archetype + personality
**Enterprise / operational.** Dense, data-forward admin console for API project management. Calm, authoritative, no decorative fluff.

## 2. Type pairing
**IBM Plex Sans** for UI chrome and labels; **IBM Plex Mono** for project slugs, session IDs, and stat values. Hierarchy via weight (600 section titles, 500 labels) and size steps from tokens — not color alone.

## 3. Surface strategy
**Dark chrome + light content well** (enterprise default). Sidebar and top bar use `chrome-*` tokens on near-black; main canvas sits in `content-well` with white `surface-base` cards elevated on `surface-raised`. Dark mode inverts the well while keeping chrome darker still.

## 4. Accent placement
Brand blue (`#2563eb`) reserved for primary actions, active nav indicator, and focus rings. Status colors (success/warning/danger) only on badges and feedback — never as decorative fills.

## 5. Deliberate non-generic move
**Monospace data rail:** stat card values and project slugs render in Plex Mono with tight tracking, giving the console a telemetry-board feel distinct from generic SaaS dashboards.
