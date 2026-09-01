# Inventory tool

Two modules. `src/inventory.js` bands a stock count and formats an export row;
`src/store.js` reads and writes the count file.

Stock bands: 0 or below is `out`, 1 to 5 is `low`, above 5 is `ok`.

Writes go to a temporary file and are renamed into place, so a crash mid-write
cannot leave a half-written file.
