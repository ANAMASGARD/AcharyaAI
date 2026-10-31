BEGIN;
-- Internal deletion/revision state is never exposed through Data API.
REVOKE SELECT ON acharya.accounts FROM authenticated;
DROP POLICY api_accounts ON acharya.accounts;
ALTER POLICY api_reports ON acharya.reports TO authenticated USING (
  owner = auth.user_id()
  AND current_setting('request.jwt.claims', true)::jsonb->>'iss' = 'https://clerk.superacharya.com'
  AND current_setting('request.jwt.claims', true)::jsonb->>'sid' LIKE 'sess_%'
);
COMMIT;
