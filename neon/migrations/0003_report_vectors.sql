BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE UNIQUE INDEX reports_owner_id_idx ON acharya.reports(owner,id);
CREATE TABLE acharya.report_vectors (
  id varchar(21) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{21}$'),
  owner text NOT NULL,
  report_id varchar(21) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('notes','reflection')),
  chunk_index integer NOT NULL CHECK (chunk_index BETWEEN 0 AND 1000),
  title text NOT NULL CHECK (length(title) <= 80),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 400),
  contract text NOT NULL CHECK (contract = 'eg2-text270m-int4-2d079ee2-litert018-cpu-f32-prefix1-mrl256-l2-chunk1'),
  embedding vector(256) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner,report_id) REFERENCES acharya.reports(owner,id) ON DELETE CASCADE,
  UNIQUE(owner,report_id,kind,chunk_index,contract)
);
CREATE INDEX report_vectors_owner_report_idx ON acharya.report_vectors(owner,report_id);
ALTER TABLE acharya.report_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE acharya.report_vectors FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_vectors ON acharya.report_vectors TO acharya_runtime
 USING(owner = current_setting('app.clerk_user_id', true))
 WITH CHECK(owner = current_setting('app.clerk_user_id', true));
CREATE POLICY api_vectors ON acharya.report_vectors FOR SELECT TO authenticated
 USING(owner = auth.user_id() AND EXISTS(SELECT 1 FROM acharya.accounts WHERE owner=auth.user_id() AND deleted_at IS NULL));
GRANT SELECT,INSERT,DELETE ON acharya.report_vectors TO acharya_runtime;
GRANT SELECT ON acharya.report_vectors TO authenticated;
CREATE FUNCTION acharya.vector_operation(batch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,acharya,public AS $$
DECLARE who text := current_setting('app.clerk_user_id',true); account acharya.accounts;
 item jsonb; old acharya.report_vectors; value vector(256); ids jsonb := '[]';
BEGIN
 IF who IS NULL OR who !~ '^user_' THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 SELECT * INTO account FROM acharya.accounts WHERE owner=who FOR UPDATE;
 IF NOT FOUND OR account.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_DELETED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM acharya.reports WHERE owner=who AND id=batch->>'reportId') THEN RAISE EXCEPTION 'REPORT_UNAVAILABLE'; END IF;
 IF jsonb_typeof(batch->'chunks') <> 'array' OR jsonb_array_length(batch->'chunks') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_VECTOR'; END IF;
 IF account.last_request_at > clock_timestamp()-interval '200 milliseconds' THEN RAISE EXCEPTION 'RATE_LIMIT'; END IF;
 UPDATE acharya.accounts SET last_request_at=clock_timestamp() WHERE owner=who;
 FOR item IN SELECT * FROM jsonb_array_elements(batch->'chunks') LOOP
   IF jsonb_array_length(item->'vector') <> 256 THEN RAISE EXCEPTION 'INVALID_VECTOR'; END IF;
   value := (item->'vector')::text::vector(256);
   IF abs(vector_norm(value)-1) > 0.0001 THEN RAISE EXCEPTION 'INVALID_VECTOR'; END IF;
   SELECT * INTO old FROM acharya.report_vectors WHERE owner=who AND report_id=batch->>'reportId' AND kind=item->>'kind'
     AND chunk_index=(item->>'chunkIndex')::integer AND contract=item->>'contract';
   IF FOUND THEN
     IF old.content <> item->>'content' OR old.title <> item->>'title' OR old.embedding <> value THEN RAISE EXCEPTION 'REPORT_CONFLICT'; END IF;
   ELSE
     INSERT INTO acharya.report_vectors(id,owner,report_id,kind,chunk_index,title,content,contract,embedding)
       VALUES(item->>'id',who,batch->>'reportId',item->>'kind',(item->>'chunkIndex')::integer,item->>'title',item->>'content',item->>'contract',value);
   END IF;
   ids := ids || jsonb_build_array(item->>'id');
 END LOOP;
 RETURN jsonb_build_object('ids',ids);
END $$;
REVOKE ALL ON FUNCTION acharya.vector_operation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acharya.vector_operation(jsonb) TO acharya_runtime;
COMMIT;
