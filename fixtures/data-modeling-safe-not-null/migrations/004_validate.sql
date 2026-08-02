-- scans under SHARE UPDATE EXCLUSIVE; reads and writes continue
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;
