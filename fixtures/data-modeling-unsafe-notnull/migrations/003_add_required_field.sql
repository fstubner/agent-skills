ALTER TABLE users ADD COLUMN tenant_id UUID NOT NULL;

ALTER TABLE orders RENAME COLUMN buyer_id TO customer_id;

ALTER TABLE users ADD COLUMN external_id UUID DEFAULT gen_random_uuid();
