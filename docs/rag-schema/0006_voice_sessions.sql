CREATE TABLE IF NOT EXISTS acharya_rag.voice_sessions (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21),
 owner text NOT NULL,
 conversation_id varchar(21) REFERENCES acharya_rag.conversations(id) ON DELETE SET NULL,
 call_id text,
 status text NOT NULL CHECK(status IN ('connecting','active','ending','ended','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 ended_at timestamptz,
 usage jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS voice_one_active_owner ON acharya_rag.voice_sessions(owner) WHERE status IN ('connecting','active','ending');
ALTER TABLE acharya_rag.messages ADD COLUMN IF NOT EXISTS voice_session_id varchar(21) REFERENCES acharya_rag.voice_sessions(id) ON DELETE CASCADE;
ALTER TABLE acharya_rag.messages ADD COLUMN IF NOT EXISTS voice_item_id text;
ALTER TABLE acharya_rag.messages ADD COLUMN IF NOT EXISTS interrupted boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS voice_message_item ON acharya_rag.messages(voice_session_id,voice_item_id) WHERE voice_session_id IS NOT NULL;
