CREATE TABLE payments (id text PRIMARY KEY, owner text NOT NULL, amount_cents integer NOT NULL CHECK (amount_cents > 0));
