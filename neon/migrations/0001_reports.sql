-- Apply to an isolated database with migration credentials, after Data API creates auth.user_id().
-- Passwords are provisioned separately; never embed them in migrations.
BEGIN;
CREATE ROLE acharya_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA IF NOT EXISTS acharya;
REVOKE ALL ON SCHEMA acharya FROM PUBLIC;
GRANT USAGE ON SCHEMA acharya TO acharya_runtime, authenticated;
CREATE TABLE acharya.accounts (
  owner text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  deleted_at timestamptz,
  last_request_at timestamptz
);
CREATE TABLE acharya.reports (
  id varchar(21) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{21}$'),
  owner text NOT NULL REFERENCES acharya.accounts(owner),
  revision bigint NOT NULL,
  payload jsonb NOT NULL,
  digest text NOT NULL,
  UNIQUE(owner, revision)
);
ALTER TABLE acharya.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acharya.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE acharya.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE acharya.reports FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_accounts ON acharya.accounts TO acharya_runtime
  USING (owner = current_setting('app.clerk_user_id', true))
  WITH CHECK (owner = current_setting('app.clerk_user_id', true));
CREATE POLICY runtime_reports ON acharya.reports TO acharya_runtime
  USING (owner = current_setting('app.clerk_user_id', true))
  WITH CHECK (owner = current_setting('app.clerk_user_id', true));
CREATE POLICY api_accounts ON acharya.accounts FOR SELECT TO authenticated USING (owner = auth.user_id());
CREATE POLICY api_reports ON acharya.reports FOR SELECT TO authenticated
  USING (owner = auth.user_id() AND EXISTS (
    SELECT 1 FROM acharya.accounts a WHERE a.owner = auth.user_id() AND a.deleted_at IS NULL));
GRANT SELECT, INSERT, UPDATE ON acharya.accounts TO acharya_runtime;
GRANT SELECT, INSERT, DELETE ON acharya.reports TO acharya_runtime;
GRANT SELECT ON acharya.accounts, acharya.reports TO authenticated;

-- All operations lock the same owner row, so revision allocation/commit ordering and
-- deletion are serialized. Duplicate uploads return the original acknowledgement.
CREATE FUNCTION acharya.report_operation(action text, report jsonb DEFAULT NULL, hash text DEFAULT NULL, after_revision bigint DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, acharya AS $$
DECLARE who text := current_setting('app.clerk_user_id', true); account acharya.accounts;
  existing acharya.reports; next_revision bigint; items jsonb;
BEGIN
  IF who IS NULL OR who !~ '^user_' THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  INSERT INTO acharya.accounts(owner) VALUES(who) ON CONFLICT DO NOTHING;
  SELECT * INTO account FROM acharya.accounts WHERE owner = who FOR UPDATE;
  IF action = 'delete' THEN
    UPDATE acharya.accounts SET deleted_at = COALESCE(deleted_at, now()) WHERE owner = who;
    DELETE FROM acharya.reports WHERE owner = who;
    RETURN jsonb_build_object('status', 'deleted');
  END IF;
  IF account.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_DELETED'; END IF;
  IF account.last_request_at > clock_timestamp() - interval '200 milliseconds' THEN RAISE EXCEPTION 'RATE_LIMIT'; END IF;
  UPDATE acharya.accounts SET last_request_at = clock_timestamp() WHERE owner = who;
  IF action = 'push' THEN
    IF report IS NULL OR hash IS NULL OR report->>'id' !~ '^[A-Za-z0-9_-]{21}$' OR octet_length(report::text) > 900000 THEN RAISE EXCEPTION 'INVALID_REPORT'; END IF;
    SELECT * INTO existing FROM acharya.reports WHERE id = report->>'id' AND owner = who;
    IF FOUND THEN
      IF existing.digest <> hash THEN RAISE EXCEPTION 'REPORT_CONFLICT'; END IF;
      RETURN jsonb_build_object('id', existing.id, 'revision', existing.revision::text);
    END IF;
    UPDATE acharya.accounts SET revision = revision + 1 WHERE owner = who RETURNING revision INTO next_revision;
    INSERT INTO acharya.reports(id, owner, revision, payload, digest) VALUES(report->>'id', who, next_revision, report, hash);
    RETURN jsonb_build_object('id', report->>'id', 'revision', next_revision::text);
  ELSIF action = 'pull' THEN
    IF after_revision < 0 OR after_revision > account.revision THEN RAISE EXCEPTION 'INVALID_CURSOR'; END IF;
    SELECT jsonb_agg(jsonb_build_object('report', payload, 'revision', revision::text) ORDER BY revision), max(revision)
      INTO items, next_revision FROM (SELECT payload, revision FROM acharya.reports WHERE owner = who AND revision > after_revision ORDER BY revision LIMIT 20) page;
    RETURN jsonb_build_object('items', COALESCE(items, '[]'::jsonb), 'cursor', COALESCE(next_revision, after_revision)::text, 'hasMore', COALESCE(next_revision, after_revision) < account.revision);
  END IF;
  RAISE EXCEPTION 'INVALID_ACTION';
END $$;
REVOKE ALL ON FUNCTION acharya.report_operation(text, jsonb, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acharya.report_operation(text, jsonb, text, bigint) TO acharya_runtime;
COMMIT;
