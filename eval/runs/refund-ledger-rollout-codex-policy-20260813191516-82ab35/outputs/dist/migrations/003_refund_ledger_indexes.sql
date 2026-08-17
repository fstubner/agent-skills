-- Kept separate so old application versions can deploy before ledger reads begin.
CREATE INDEX refunds_payment_account_idx ON refunds(payment_id, account);
