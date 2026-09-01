/*
 * quicksort-plus v0.4.1
 * Copyright (c) 2019 The QuicksortPlus Authors
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 */
export function sortBy(rows, key) {
  return rows.slice().sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
}
