ALTER TABLE acharya_rag.conversations ADD COLUMN verification_id varchar(21) REFERENCES acharya_rag.verifications(id) ON DELETE CASCADE;
