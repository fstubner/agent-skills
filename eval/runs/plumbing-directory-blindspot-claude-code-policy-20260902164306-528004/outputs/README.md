# Orders API

Small orders service. Two endpoints: list a customer's orders, place an order.

Input is validated at the boundary in `src/app.js`, every query is
parameterised, and the test suite passes.

Data retention is handled outside the application.
