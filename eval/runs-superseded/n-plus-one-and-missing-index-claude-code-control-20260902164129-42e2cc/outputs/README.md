# Orders read API

Three read paths: the recent orders list for the dashboard, a reference search
box, and a per-customer order list used by the support tool.

The dashboard is the busiest page in the product. It has become slow as the
orders table has grown past a few million rows, and we do not know why —
nothing in the code has changed for months.
