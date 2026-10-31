BEGIN;
-- Only the narrowly scoped SECURITY DEFINER dispatcher can write community data.
-- Runtime logins must NEVER be members of this service role.
CREATE ROLE acharya_community_service NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT acharya_community_service TO CURRENT_USER;
GRANT USAGE, CREATE ON SCHEMA acharya TO acharya_community_service;
GRANT SELECT, INSERT, UPDATE ON acharya.accounts TO acharya_community_service;
CREATE POLICY community_accounts ON acharya.accounts TO acharya_community_service
  USING (owner = current_setting('app.clerk_user_id', true))
  WITH CHECK (owner = current_setting('app.clerk_user_id', true));
ALTER TABLE acharya.accounts ADD COLUMN community_window_started_at timestamptz, ADD COLUMN community_request_count integer NOT NULL DEFAULT 0;

CREATE TABLE acharya.community_profiles (
 owner text PRIMARY KEY REFERENCES acharya.accounts(owner), display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80)
);
CREATE TABLE acharya.community_groups (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), owner text NOT NULL REFERENCES acharya.accounts(owner),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), description text NOT NULL CHECK(length(description)<=3000),
 subject_tag text, join_code varchar(21) UNIQUE NOT NULL, creation_payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE acharya.community_memberships (
 group_id varchar(21) NOT NULL REFERENCES acharya.community_groups(id) ON DELETE CASCADE,
 owner text NOT NULL REFERENCES acharya.accounts(owner), joined_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(group_id,owner)
);
CREATE TABLE acharya.community_posts (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), owner text NOT NULL REFERENCES acharya.accounts(owner),
 group_id varchar(21) REFERENCES acharya.community_groups(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), body text NOT NULL CHECK(length(body)<=10000),
 subject_tag text NOT NULL CHECK(length(subject_tag)<=80), link_url text, creation_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX community_posts_page ON acharya.community_posts(created_at DESC,id DESC);
CREATE INDEX community_posts_group ON acharya.community_posts(group_id,created_at DESC,id DESC);
CREATE TABLE acharya.community_comments (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), post_id varchar(21) NOT NULL REFERENCES acharya.community_posts(id) ON DELETE CASCADE,
 owner text NOT NULL REFERENCES acharya.accounts(owner), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
 creation_payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX community_comments_page ON acharya.community_comments(post_id,created_at DESC,id DESC);
CREATE TABLE acharya.community_votes (
 post_id varchar(21) NOT NULL REFERENCES acharya.community_posts(id) ON DELETE CASCADE, owner text NOT NULL REFERENCES acharya.accounts(owner),
 value smallint NOT NULL CHECK(value IN (-1,1)), PRIMARY KEY(post_id,owner)
);
CREATE TABLE acharya.community_saves (
 post_id varchar(21) NOT NULL REFERENCES acharya.community_posts(id) ON DELETE CASCADE, owner text NOT NULL REFERENCES acharya.accounts(owner), PRIMARY KEY(post_id,owner)
);
CREATE TABLE acharya.community_messages (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), group_id varchar(21) NOT NULL REFERENCES acharya.community_groups(id) ON DELETE CASCADE,
 owner text NOT NULL REFERENCES acharya.accounts(owner), body text NOT NULL CHECK(length(body)<=10000), link_url text,
 creation_payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX community_messages_page ON acharya.community_messages(group_id,created_at DESC,id DESC);
CREATE TABLE acharya.community_media (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), owner text NOT NULL REFERENCES acharya.accounts(owner),
 group_id varchar(21), post_id varchar(21) REFERENCES acharya.community_posts(id) ON DELETE SET NULL,
 message_id varchar(21) REFERENCES acharya.community_messages(id) ON DELETE SET NULL,
 file_id text UNIQUE, file_path text NOT NULL UNIQUE, width integer CHECK(width>0),height integer CHECK(height>0),
 format text NOT NULL CHECK(format IN ('jpeg','png','webp','gif')), size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','attached','deleting')),
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 3), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(NOT(post_id IS NOT NULL AND message_id IS NOT NULL))
);
CREATE INDEX community_media_post ON acharya.community_media(post_id);
CREATE INDEX community_media_message ON acharya.community_media(message_id);
CREATE TABLE acharya.community_cleanup_jobs (
 id varchar(21) PRIMARY KEY REFERENCES acharya.community_media(id), attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours', lease_until timestamptz, lease_token text,
 last_error text, completed_at timestamptz
);
CREATE INDEX community_cleanup_due ON acharya.community_cleanup_jobs(next_attempt_at) WHERE completed_at IS NULL;
CREATE TABLE acharya.community_blocks (
 owner text NOT NULL REFERENCES acharya.accounts(owner), target_owner text NOT NULL CHECK(target_owner LIKE 'user_%'),
 PRIMARY KEY(owner,target_owner), CHECK(owner<>target_owner)
);
CREATE TABLE acharya.community_reports (
 id varchar(21) PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{21}$'), owner text NOT NULL REFERENCES acharya.accounts(owner),
 target_type text NOT NULL CHECK(target_type IN ('post','comment','message')),target_id varchar(21) NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','removed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), reviewed_by text, reviewed_at timestamptz
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','groups','memberships','posts','comments','votes','saves','messages','media','cleanup_jobs','blocks','reports'] LOOP
  EXECUTE format('ALTER TABLE acharya.community_%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE acharya.community_%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY service_only ON acharya.community_%I TO acharya_community_service USING (true) WITH CHECK (true)',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON acharya.community_%I TO acharya_community_service',t);
  EXECUTE format('REVOKE ALL ON acharya.community_%I FROM PUBLIC, acharya_runtime, authenticated',t);
 END LOOP;
END $$;

CREATE FUNCTION acharya.community_member(g text,w text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT EXISTS(SELECT 1 FROM acharya.community_memberships WHERE group_id=g AND owner=w)
$$;
CREATE FUNCTION acharya.community_blocked(a text,b text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT EXISTS(SELECT 1 FROM acharya.community_blocks WHERE (owner=a AND target_owner=b) OR (owner=b AND target_owner=a))
$$;
CREATE FUNCTION acharya.community_read_post(p text,w text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT EXISTS(SELECT 1 FROM acharya.community_posts WHERE id=p AND (group_id IS NULL OR acharya.community_member(group_id,w)) AND NOT acharya.community_blocked(owner,w))
$$;
CREATE FUNCTION acharya.community_image_json(m acharya.community_media) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT jsonb_build_object('imageId',m.id,'ownerClerkId',m.owner,'status',m.status,'fileId',m.file_id,'filePath',m.file_path,'width',m.width,'height',m.height,'format',m.format,'mimeType','image/'||m.format,'fileName',m.id||'.'||m.format,'sizeBytes',m.size_bytes,'sortOrder',m.sort_order,'groupId',m.group_id,'createdAt',m.created_at)
$$;
CREATE FUNCTION acharya.community_post_json(p acharya.community_posts,w text) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT jsonb_build_object('postId',p.id,'title',p.title,'body',p.body,'subjectTag',p.subject_tag,'linkUrl',p.link_url,
  'createdAt',p.created_at,'authorClerkId',p.owner,'authorDisplayName',pr.display_name,'authorAvatarLetter',upper(left(pr.display_name,1)),
  'authorImageUrl',NULL,'groupId',p.group_id,'groupName',(SELECT name FROM acharya.community_groups WHERE id=p.group_id),
  'demoSeed',false,'demoWelcome',false,'score',COALESCE((SELECT sum(value) FROM acharya.community_votes WHERE post_id=p.id),0),
  'commentCount',(SELECT count(*) FROM acharya.community_comments WHERE post_id=p.id AND NOT acharya.community_blocked(owner,w)),
  'viewerVote',(SELECT value FROM acharya.community_votes WHERE post_id=p.id AND owner=w),
  'viewerSaved',EXISTS(SELECT 1 FROM acharya.community_saves WHERE post_id=p.id AND owner=w),
  'images',COALESCE((SELECT jsonb_agg(jsonb_build_object('imageId',id,'mimeType','image/'||format,'fileName',id||'.'||format,'sortOrder',sort_order,'width',width,'height',height) ORDER BY sort_order) FROM acharya.community_media WHERE post_id=p.id AND status='attached'),'[]'::jsonb))
 FROM acharya.community_profiles pr WHERE pr.owner=p.owner
$$;
CREATE FUNCTION acharya.community_comment_json(c acharya.community_comments) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT jsonb_build_object('commentId',c.id,'body',c.body,'createdAt',c.created_at,'authorClerkId',c.owner,'authorDisplayName',display_name,'authorAvatarLetter',upper(left(display_name,1))) FROM acharya.community_profiles WHERE owner=c.owner
$$;
CREATE FUNCTION acharya.community_message_json(m acharya.community_messages) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT jsonb_build_object('messageId',m.id,'body',m.body,'linkUrl',m.link_url,'createdAt',m.created_at,'authorClerkId',m.owner,'authorDisplayName',display_name,'authorAvatarLetter',upper(left(display_name,1)),
 'images',COALESCE((SELECT jsonb_agg(jsonb_build_object('imageId',id,'mimeType','image/'||format,'fileName',id||'.'||format,'sortOrder',sort_order,'width',width,'height',height) ORDER BY sort_order) FROM acharya.community_media WHERE message_id=m.id AND status='attached'),'[]'::jsonb)) FROM acharya.community_profiles WHERE owner=m.owner
$$;
CREATE FUNCTION acharya.community_group_json(g acharya.community_groups) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,acharya AS $$
 SELECT jsonb_build_object('groupId',g.id,'name',g.name,'description',g.description,'subjectTag',g.subject_tag,'joinCode',g.join_code,'createdAt',g.created_at,'ownerClerkId',g.owner,'memberCount',(SELECT count(*) FROM acharya.community_memberships WHERE group_id=g.id),'isMember',true,
 'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('clerkId',m.owner,'displayName',p.display_name,'avatarLetter',upper(left(p.display_name,1)),'role',CASE WHEN m.owner=g.owner THEN 'owner' ELSE 'member' END,'joinedAt',m.joined_at) ORDER BY m.joined_at) FROM acharya.community_memberships m JOIN acharya.community_profiles p ON p.owner=m.owner WHERE m.group_id=g.id),'[]'::jsonb))
$$;
CREATE FUNCTION acharya.community_queue_media(p text DEFAULT NULL,m text DEFAULT NULL,w text DEFAULT NULL,g text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,acharya AS $$
BEGIN
 WITH targets AS (UPDATE acharya.community_media SET status='deleting' WHERE status<>'deleting' AND ((p IS NOT NULL AND post_id=p) OR (m IS NOT NULL AND message_id=m) OR (w IS NOT NULL AND owner=w) OR (g IS NOT NULL AND group_id=g))
  RETURNING id,(post_id IS NULL AND message_id IS NULL) AS pending_upload)
 INSERT INTO acharya.community_cleanup_jobs(id,next_attempt_at) SELECT id,clock_timestamp()+CASE WHEN pending_upload THEN interval '120 seconds' ELSE interval '0 seconds' END FROM targets
 ON CONFLICT(id) DO UPDATE SET next_attempt_at=excluded.next_attempt_at,completed_at=NULL;
END $$;

CREATE FUNCTION acharya.community_operation(action text,data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,acharya AS $$
DECLARE who text:=current_setting('app.clerk_user_id',true); a acharya.accounts; p acharya.community_posts;
 g acharya.community_groups; c acharya.community_comments; m acharya.community_messages; im acharya.community_media;
 rr acharya.community_reports; lim integer:=COALESCE((data->>'limit')::integer,20); items jsonb; more boolean; last_item jsonb;
 target text:=data->>'id'; gid text:=data->>'groupId'; ct timestamptz; ci text; aft timestamptz; ai text; image_id text; n integer:=0;
 mod boolean:=COALESCE(current_setting('app.community_moderator',true)='true',false); moderated_image boolean:=false; trusted_cleanup boolean:=COALESCE(current_setting('app.community_cleanup',true)='true',false); existing jsonb; job record; jobs jsonb:='[]'::jsonb;
BEGIN
 IF who IS NULL OR who !~ '^user_' THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 IF jsonb_typeof(data)<>'object' OR lim<1 OR lim>50 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 IF trusted_cleanup AND action NOT IN ('media_cleanup_claim','media_cleanup_complete','media_cleanup_fail') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT trusted_cleanup THEN
  INSERT INTO acharya.accounts(owner) VALUES(who) ON CONFLICT DO NOTHING;
  SELECT * INTO a FROM acharya.accounts WHERE owner=who FOR UPDATE;
  IF action NOT IN ('account_delete','media_upload_failed') AND a.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_DELETED'; END IF;
  IF action NOT IN ('account_delete','media_upload_failed') THEN
   UPDATE acharya.accounts SET community_request_count=CASE WHEN community_window_started_at>clock_timestamp()-interval '1 minute' THEN community_request_count+1 ELSE 1 END,
    community_window_started_at=CASE WHEN community_window_started_at>clock_timestamp()-interval '1 minute' THEN community_window_started_at ELSE clock_timestamp() END WHERE owner=who RETURNING * INTO a;
   IF a.community_request_count>240 THEN RAISE EXCEPTION 'RATE_LIMIT'; END IF;
  END IF;
 END IF;
 IF data ? 'displayName' THEN
  IF length(data->>'displayName') NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  INSERT INTO acharya.community_profiles(owner,display_name) VALUES(who,data->>'displayName') ON CONFLICT(owner) DO UPDATE SET display_name=excluded.display_name;
 END IF;
 IF data ? 'cursor' THEN ct:=(data->'cursor'->>'createdAt')::timestamptz; ci:=data->'cursor'->>'id'; END IF;
 IF data ? 'after' THEN aft:=(data->'after'->>'createdAt')::timestamptz; ai:=data->'after'->>'id'; END IF;
 -- Membership revocation and every group mutation use the same group-row lock.
 IF gid IS NOT NULL AND action<>'group_create' THEN
  SELECT * INTO g FROM acharya.community_groups WHERE id=gid FOR UPDATE;
  IF NOT FOUND OR NOT acharya.community_member(gid,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 END IF;
 IF action IN ('posts_list','post_get','post_create','comment_create','post_vote','post_save','post_delete') THEN
  IF gid IS NOT NULL AND NOT acharya.community_member(gid,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF action='posts_list' THEN
   SELECT COALESCE(jsonb_agg(acharya.community_post_json(q,who) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) INTO items
   FROM (SELECT pp.* FROM acharya.community_posts pp WHERE (pp.group_id IS NULL AND gid IS NULL OR pp.group_id=gid)
    AND NOT acharya.community_blocked(pp.owner,who) AND (ct IS NULL OR (pp.created_at,pp.id)<(ct,ci)) ORDER BY pp.created_at DESC,pp.id DESC LIMIT lim+1) q;
   more:=jsonb_array_length(items)>lim; items:=CASE WHEN more THEN items- lim ELSE items END; last_item:=items->(jsonb_array_length(items)-1);
   RETURN jsonb_build_object('posts',items,'count',jsonb_array_length(items),'hasMore',more,'nextCursor',CASE WHEN more THEN jsonb_build_object('createdAt',last_item->>'createdAt','id',last_item->>'postId') ELSE NULL END);
  ELSIF action='post_create' THEN
   SELECT creation_payload INTO existing FROM acharya.community_posts WHERE id=data->>'postId' AND owner=who;
   IF FOUND THEN
    IF existing<>data THEN RAISE EXCEPTION 'CONFLICT'; END IF;
    SELECT * INTO p FROM acharya.community_posts WHERE id=data->>'postId'; RETURN jsonb_build_object('post',acharya.community_post_json(p,who));
   END IF;
   INSERT INTO acharya.community_posts(id,owner,group_id,title,body,subject_tag,link_url,creation_payload)
    VALUES(data->>'postId',who,gid,data->>'title',data->>'body',data->>'subjectTag',data->>'linkUrl',data) RETURNING * INTO p;
  ELSE
   SELECT group_id INTO gid FROM acharya.community_posts WHERE id=target;
   IF gid IS NOT NULL THEN
    SELECT * INTO g FROM acharya.community_groups WHERE id=gid FOR UPDATE;
    IF NOT FOUND OR NOT acharya.community_member(gid,who) AND NOT (action='post_delete' AND mod) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   END IF;
   IF NOT acharya.community_read_post(target,who) AND NOT (action='post_delete' AND mod) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   SELECT * INTO p FROM acharya.community_posts WHERE id=target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   IF action='post_delete' THEN
    IF p.owner<>who AND NOT mod THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    PERFORM acharya.community_queue_media(p.id); DELETE FROM acharya.community_posts WHERE id=p.id; RETURN jsonb_build_object('deleted',true);
   ELSIF action='post_vote' THEN
    IF data->>'value' IS NULL THEN DELETE FROM acharya.community_votes WHERE post_id=p.id AND owner=who;
    ELSE INSERT INTO acharya.community_votes(post_id,owner,value) VALUES(p.id,who,(data->>'value')::smallint) ON CONFLICT(post_id,owner) DO UPDATE SET value=excluded.value; END IF;
    RETURN jsonb_build_object('score',COALESCE((SELECT sum(value) FROM acharya.community_votes WHERE post_id=p.id),0),'viewerVote',(SELECT value FROM acharya.community_votes WHERE post_id=p.id AND owner=who));
   ELSIF action='post_save' THEN
    IF (data->>'save')::boolean THEN INSERT INTO acharya.community_saves(post_id,owner) VALUES(p.id,who) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM acharya.community_saves WHERE post_id=p.id AND owner=who; END IF;
    RETURN jsonb_build_object('viewerSaved',(data->>'save')::boolean);
   ELSIF action='comment_create' THEN
    SELECT * INTO c FROM acharya.community_comments WHERE id=data->>'commentId';
    IF FOUND THEN IF c.owner<>who OR c.creation_payload<>data THEN RAISE EXCEPTION 'CONFLICT'; END IF;
    ELSE INSERT INTO acharya.community_comments(id,post_id,owner,body,creation_payload) VALUES(data->>'commentId',p.id,who,data->>'body',data) RETURNING * INTO c; END IF;
    RETURN jsonb_build_object('comment',acharya.community_comment_json(c));
   ELSE
    SELECT COALESCE(jsonb_agg(acharya.community_comment_json(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) INTO items FROM
    (SELECT cc.* FROM acharya.community_comments cc WHERE post_id=p.id AND NOT acharya.community_blocked(cc.owner,who) AND (ct IS NULL OR (cc.created_at,cc.id)<(ct,ci)) ORDER BY cc.created_at DESC,cc.id DESC LIMIT lim+1) q;
    more:=jsonb_array_length(items)>lim; items:=CASE WHEN more THEN items-lim ELSE items END; last_item:=items->(jsonb_array_length(items)-1);
    RETURN jsonb_build_object('post',acharya.community_post_json(p,who),'comments',items,'hasMore',more,'nextCursor',CASE WHEN more THEN jsonb_build_object('createdAt',last_item->>'createdAt','id',last_item->>'commentId') ELSE NULL END);
   END IF;
  END IF;
 ELSIF action IN ('groups_list','group_create','group_join','group_get','member_remove','messages_list','message_create','message_delete') THEN
  IF action='groups_list' THEN SELECT COALESCE(jsonb_agg(acharya.community_group_json(gg) ORDER BY gg.created_at DESC),'[]'::jsonb) INTO items FROM acharya.community_groups gg WHERE acharya.community_member(gg.id,who); RETURN jsonb_build_object('groups',items); END IF;
  IF action='group_create' THEN
   SELECT * INTO g FROM acharya.community_groups WHERE id=data->>'groupId';
   IF FOUND THEN IF g.owner<>who OR g.creation_payload<>(data-'joinCode') THEN RAISE EXCEPTION 'CONFLICT'; END IF;
   ELSE INSERT INTO acharya.community_groups(id,owner,name,description,subject_tag,join_code,creation_payload) VALUES(gid,who,data->>'name',data->>'description',data->>'subjectTag',data->>'joinCode',data-'joinCode') RETURNING * INTO g;
    INSERT INTO acharya.community_memberships(group_id,owner) VALUES(g.id,who); END IF;
   RETURN jsonb_build_object('group',acharya.community_group_json(g));
  ELSIF action='group_join' THEN
   SELECT * INTO g FROM acharya.community_groups WHERE join_code=data->>'code' FOR UPDATE;
   IF NOT FOUND OR acharya.community_blocked(g.owner,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   INSERT INTO acharya.community_memberships(group_id,owner) VALUES(g.id,who) ON CONFLICT DO NOTHING;
   RETURN jsonb_build_object('group',acharya.community_group_json(g));
  END IF;
  IF NOT acharya.community_member(gid,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO g FROM acharya.community_groups WHERE id=gid FOR UPDATE;
  IF action='group_get' THEN RETURN jsonb_build_object('group',acharya.community_group_json(g));
  ELSIF action='member_remove' THEN
   IF g.owner<>who OR target=g.owner THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   DELETE FROM acharya.community_memberships WHERE group_id=g.id AND owner=target;
   UPDATE acharya.community_groups SET join_code=data->>'joinCode' WHERE id=g.id;
   -- Previously shared URLs expire within five minutes; new requests are denied immediately.
   RETURN jsonb_build_object('removed',true);
  ELSIF action='message_delete' THEN
   SELECT * INTO m FROM acharya.community_messages WHERE id=target AND group_id=g.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   IF m.owner<>who AND g.owner<>who AND NOT mod THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   PERFORM acharya.community_queue_media(NULL,m.id); DELETE FROM acharya.community_messages WHERE id=m.id; RETURN jsonb_build_object('deleted',true);
  ELSIF action='messages_list' THEN
   SELECT COALESCE(jsonb_agg(acharya.community_message_json(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) INTO items FROM
   (SELECT mm.* FROM acharya.community_messages mm WHERE group_id=g.id AND NOT acharya.community_blocked(mm.owner,who)
    AND (ct IS NULL OR (mm.created_at,mm.id)<(ct,ci)) AND (aft IS NULL OR (mm.created_at,mm.id)>(aft,ai)) ORDER BY mm.created_at DESC,mm.id DESC LIMIT lim+1) q;
   more:=jsonb_array_length(items)>lim; items:=CASE WHEN more THEN items-lim ELSE items END; last_item:=items->(jsonb_array_length(items)-1);
   SELECT COALESCE(jsonb_agg(value ORDER BY ordinality DESC),'[]'::jsonb) INTO items FROM jsonb_array_elements(items) WITH ORDINALITY;
   RETURN jsonb_build_object('messages',items,'hasMore',more,'nextCursor',CASE WHEN more THEN jsonb_build_object('createdAt',last_item->>'createdAt','id',last_item->>'messageId') ELSE NULL END);
  ELSIF action='message_create' THEN
   SELECT * INTO m FROM acharya.community_messages WHERE id=data->>'messageId';
   IF FOUND THEN IF m.owner<>who OR m.creation_payload<>data THEN RAISE EXCEPTION 'CONFLICT'; END IF; RETURN jsonb_build_object('message',acharya.community_message_json(m)); END IF;
   INSERT INTO acharya.community_messages(id,group_id,owner,body,link_url,creation_payload) VALUES(data->>'messageId',gid,who,data->>'body',data->>'linkUrl',data) RETURNING * INTO m;
  END IF;
 ELSIF action='report_create' THEN
  IF data->>'targetType'='post' THEN IF NOT acharya.community_read_post(data->>'targetId',who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  ELSIF data->>'targetType'='comment' THEN SELECT * INTO c FROM acharya.community_comments WHERE id=data->>'targetId'; IF NOT FOUND OR NOT acharya.community_read_post(c.post_id,who) OR acharya.community_blocked(c.owner,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  ELSIF data->>'targetType'='message' THEN SELECT * INTO m FROM acharya.community_messages WHERE id=data->>'targetId'; IF NOT FOUND OR NOT acharya.community_member(m.group_id,who) OR acharya.community_blocked(m.owner,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  ELSE RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  SELECT * INTO rr FROM acharya.community_reports WHERE id=data->>'reportId';
  IF FOUND THEN IF rr.owner<>who OR rr.target_type<>data->>'targetType' OR rr.target_id<>data->>'targetId' OR rr.reason<>data->>'reason' THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  ELSE INSERT INTO acharya.community_reports(id,owner,target_type,target_id,reason) VALUES(data->>'reportId',who,data->>'targetType',data->>'targetId',data->>'reason'); END IF;
  RETURN jsonb_build_object('reported',true);
 ELSIF action='blocks_list' THEN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('clerkId',b.target_owner,'displayName',COALESCE(pr.display_name,'Teacher'))),'[]'::jsonb) INTO items
   FROM acharya.community_blocks b LEFT JOIN acharya.community_profiles pr ON pr.owner=b.target_owner WHERE b.owner=who;
  RETURN jsonb_build_object('blocks',items);
 ELSIF action='unblock' THEN
  DELETE FROM acharya.community_blocks WHERE owner=who AND target_owner=target; RETURN jsonb_build_object('blocked',false);
 ELSIF action='block' THEN
  INSERT INTO acharya.community_blocks(owner,target_owner) VALUES(who,target) ON CONFLICT DO NOTHING; RETURN jsonb_build_object('blocked',true);
 ELSIF action IN ('moderation_list','moderation_action') THEN
  IF NOT mod THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF action='moderation_list' THEN
   SELECT COALESCE(jsonb_agg(jsonb_build_object('reportId',r.id,'targetType',r.target_type,'targetId',r.target_id,'reason',r.reason,'status',r.status,'createdAt',r.created_at,'reporterClerkId',r.owner,
    'body',CASE r.target_type WHEN 'post' THEN (SELECT title||E'\n'||body FROM acharya.community_posts WHERE id=r.target_id) WHEN 'comment' THEN (SELECT body FROM acharya.community_comments WHERE id=r.target_id) ELSE (SELECT body FROM acharya.community_messages WHERE id=r.target_id) END,
    'authorClerkId',CASE r.target_type WHEN 'post' THEN (SELECT owner FROM acharya.community_posts WHERE id=r.target_id) WHEN 'comment' THEN (SELECT owner FROM acharya.community_comments WHERE id=r.target_id) ELSE (SELECT owner FROM acharya.community_messages WHERE id=r.target_id) END,
    'images',COALESCE((SELECT jsonb_agg(jsonb_build_object('imageId',mm.id,'mimeType','image/'||mm.format,'fileName',mm.id||'.'||mm.format,'sortOrder',mm.sort_order,'width',mm.width,'height',mm.height) ORDER BY mm.sort_order)
     FROM acharya.community_media mm WHERE mm.status='attached' AND (r.target_type='post' AND mm.post_id=r.target_id OR r.target_type='message' AND mm.message_id=r.target_id)),'[]'::jsonb)) ORDER BY r.created_at),'[]'::jsonb) INTO items
    FROM (SELECT * FROM acharya.community_reports WHERE status='open' ORDER BY created_at LIMIT 50) r; RETURN jsonb_build_object('reports',items);
  END IF;
  SELECT * INTO rr FROM acharya.community_reports WHERE id=target FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF data->>'action'='remove' THEN
   IF rr.target_type='post' THEN PERFORM acharya.community_queue_media(rr.target_id); DELETE FROM acharya.community_posts WHERE id=rr.target_id;
   ELSIF rr.target_type='comment' THEN DELETE FROM acharya.community_comments WHERE id=rr.target_id;
   ELSE PERFORM acharya.community_queue_media(NULL,rr.target_id); DELETE FROM acharya.community_messages WHERE id=rr.target_id; END IF;
  ELSIF data->>'action'<>'dismiss' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  UPDATE acharya.community_reports SET status=CASE WHEN data->>'action'='remove' THEN 'removed' ELSE 'dismissed' END, reviewed_by=who,reviewed_at=clock_timestamp() WHERE id=rr.id;
  RETURN jsonb_build_object('reviewed',true);
 ELSIF action='media_prepare' THEN
  IF gid IS NOT NULL AND NOT acharya.community_member(gid,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO im FROM acharya.community_media WHERE id=data->>'imageId' FOR UPDATE;
  IF FOUND THEN
   IF im.owner<>who OR im.group_id IS DISTINCT FROM gid OR im.content_hash<>data->>'contentHash' OR im.size_bytes<>(data->>'sizeBytes')::integer OR im.format<>data->>'format' THEN RAISE EXCEPTION 'CONFLICT'; END IF;
   IF im.status='deleting' THEN RAISE EXCEPTION 'CONFLICT'; END IF;
   IF im.status='pending' THEN
    UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()+interval '24 hours' WHERE id=im.id AND completed_at IS NULL;
   END IF;
  ELSE
   INSERT INTO acharya.community_media(id,owner,group_id,file_path,format,size_bytes,content_hash) VALUES(data->>'imageId',who,gid,'/acharya/community/'||(data->>'imageId')||'.'||(data->>'format'),data->>'format',(data->>'sizeBytes')::integer,data->>'contentHash') RETURNING * INTO im;
   INSERT INTO acharya.community_cleanup_jobs(id) VALUES(im.id);
  END IF;
  RETURN jsonb_build_object('image',acharya.community_image_json(im));
 ELSIF action='media_upload_failed' THEN
  -- An upload may finish externally after deletion/tombstoning. Keep a cleanup intent
  -- even if an earlier worker already found no file; fence its stale completion too.
  SELECT * INTO im FROM acharya.community_media WHERE id=data->>'imageId' AND owner=who FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('queued',false); END IF;
  IF im.status='deleting' THEN
   INSERT INTO acharya.community_cleanup_jobs(id,next_attempt_at) VALUES(im.id,clock_timestamp()+interval '120 seconds')
   ON CONFLICT(id) DO UPDATE SET next_attempt_at=excluded.next_attempt_at,completed_at=NULL,lease_until=NULL,lease_token=NULL;
   RETURN jsonb_build_object('queued',true);
  END IF;
  RETURN jsonb_build_object('queued',false);
 ELSIF action='media_register' THEN
  -- Acquire group before media, matching publication and group deletion lock order.
  SELECT group_id INTO gid FROM acharya.community_media WHERE id=data->>'imageId' AND owner=who;
  IF gid IS NOT NULL THEN
   SELECT * INTO g FROM acharya.community_groups WHERE id=gid FOR UPDATE;
   IF NOT FOUND OR NOT acharya.community_member(gid,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  SELECT * INTO im FROM acharya.community_media WHERE id=data->>'imageId' AND owner=who FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF im.status='deleting' OR im.file_path<>data->>'filePath' OR im.format<>data->>'format' OR im.size_bytes<>(data->>'sizeBytes')::integer THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  IF im.group_id IS NOT NULL AND NOT acharya.community_member(im.group_id,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF im.file_id IS NOT NULL AND im.file_id<>data->>'fileId' THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  UPDATE acharya.community_media SET file_id=data->>'fileId',width=(data->>'width')::integer,height=(data->>'height')::integer WHERE id=im.id RETURNING * INTO im;
  RETURN jsonb_build_object('image',acharya.community_image_json(im));
 ELSIF action='media_access' THEN
  SELECT * INTO im FROM acharya.community_media WHERE id=data->>'imageId' AND status<>'deleting';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  -- Reviewers may inspect only attached photos on a currently open report.
  -- Being a moderator alone never grants access to arbitrary private group photos.
  moderated_image:=mod AND im.status='attached' AND EXISTS(SELECT 1 FROM acharya.community_reports WHERE status='open'
   AND (target_type='post' AND target_id=im.post_id OR target_type='message' AND target_id=im.message_id));
  IF im.group_id IS NOT NULL AND NOT moderated_image THEN
   SELECT * INTO g FROM acharya.community_groups WHERE id=im.group_id FOR UPDATE;
   IF NOT FOUND OR NOT acharya.community_member(im.group_id,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  IF im.status='attached' AND NOT moderated_image THEN
   IF im.post_id IS NOT NULL THEN IF NOT acharya.community_read_post(im.post_id,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   ELSE SELECT * INTO m FROM acharya.community_messages WHERE id=im.message_id; IF NOT FOUND OR NOT acharya.community_member(m.group_id,who) OR acharya.community_blocked(m.owner,who) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF; END IF;
  ELSIF im.status<>'attached' AND (im.owner<>who OR im.group_id IS NOT NULL AND NOT acharya.community_member(im.group_id,who)) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN jsonb_build_object('image',acharya.community_image_json(im));
 ELSIF action='media_cleanup_claim' THEN
  FOR job IN SELECT j.* FROM acharya.community_cleanup_jobs j JOIN acharya.community_media mm ON mm.id=j.id
   WHERE (trusted_cleanup OR mm.owner=who) AND mm.status IN ('pending','deleting') AND j.completed_at IS NULL AND j.next_attempt_at<=clock_timestamp()
    AND (j.lease_until IS NULL OR j.lease_until<clock_timestamp()) ORDER BY j.next_attempt_at LIMIT LEAST(lim,10) FOR UPDATE OF mm SKIP LOCKED LOOP
   -- Lock order matches prepare/delete: media first, then its cleanup job.
   UPDATE acharya.community_cleanup_jobs SET attempts=attempts+1,lease_until=clock_timestamp()+interval '5 minutes',lease_token=md5(random()::text||clock_timestamp()::text)
    WHERE id=job.id AND completed_at IS NULL AND next_attempt_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp()) RETURNING * INTO job;
   IF NOT FOUND THEN CONTINUE; END IF;
   UPDATE acharya.community_media SET status='deleting' WHERE id=job.id AND status IN ('pending','deleting') RETURNING * INTO im;
   IF NOT FOUND THEN
    UPDATE acharya.community_cleanup_jobs SET lease_until=NULL,lease_token=NULL WHERE id=job.id;
    CONTINUE;
   END IF;
   jobs:=jobs||jsonb_build_array(jsonb_build_object('jobId',job.id,'imageId',job.id,'fileId',im.file_id,'filePath',im.file_path,'attempts',job.attempts,'leaseToken',job.lease_token));
  END LOOP; RETURN jsonb_build_object('jobs',jobs);
 ELSIF action IN ('media_cleanup_complete','media_cleanup_fail') THEN
  IF NOT EXISTS(SELECT 1 FROM acharya.community_media WHERE id=data->>'jobId' AND (trusted_cleanup OR owner=who)) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE acharya.community_cleanup_jobs SET completed_at=CASE WHEN action='media_cleanup_complete' THEN clock_timestamp() ELSE NULL END,
   next_attempt_at=clock_timestamp()+make_interval(secs=>LEAST(86400,30*power(2,LEAST(attempts,11)))::integer),last_error=CASE WHEN action='media_cleanup_fail' THEN left(data->>'error',200) ELSE NULL END,
   lease_until=NULL,lease_token=NULL WHERE id=data->>'jobId' AND lease_token=data->>'leaseToken' AND lease_until>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF; RETURN jsonb_build_object('updated',true);
 ELSIF action='account_delete' THEN
  -- All media, including other authors' media in a deleted owner's group, is durable cleanup work.
  FOR g IN SELECT * FROM acharya.community_groups WHERE owner=who ORDER BY id FOR UPDATE LOOP PERFORM acharya.community_queue_media(NULL,NULL,NULL,g.id); END LOOP;
  PERFORM acharya.community_queue_media(NULL,NULL,who);
  DELETE FROM acharya.community_groups WHERE owner=who;
  DELETE FROM acharya.community_posts WHERE owner=who;
  DELETE FROM acharya.community_messages WHERE owner=who;
  DELETE FROM acharya.community_comments WHERE owner=who;
  DELETE FROM acharya.community_votes WHERE owner=who; DELETE FROM acharya.community_saves WHERE owner=who;
  DELETE FROM acharya.community_memberships WHERE owner=who; DELETE FROM acharya.community_blocks WHERE owner=who OR target_owner=who;
  DELETE FROM acharya.community_reports WHERE owner=who; DELETE FROM acharya.community_profiles WHERE owner=who;
  RETURN jsonb_build_object('deleted',true);
 ELSE RAISE EXCEPTION 'INVALID_REQUEST'; END IF;

 -- Atomic attachment: publishing and claiming media either both commit or both roll back.
 IF action IN ('post_create','message_create') THEN
  IF jsonb_typeof(data->'images')<>'array' OR jsonb_array_length(data->'images')>4 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  FOR image_id IN SELECT value->>'imageId' FROM jsonb_array_elements(data->'images') LOOP
   SELECT * INTO im FROM acharya.community_media WHERE id=image_id AND owner=who FOR UPDATE;
   IF NOT FOUND OR im.status<>'pending' OR im.file_id IS NULL OR im.group_id IS DISTINCT FROM gid THEN RAISE EXCEPTION 'INVALID_MEDIA'; END IF;
   UPDATE acharya.community_media SET status='attached',post_id=CASE WHEN action='post_create' THEN p.id ELSE NULL END,message_id=CASE WHEN action='message_create' THEN m.id ELSE NULL END,sort_order=n WHERE id=im.id;
   n:=n+1;
  END LOOP;
  IF action='post_create' THEN RETURN jsonb_build_object('post',acharya.community_post_json(p,who)); END IF;
  RETURN jsonb_build_object('message',acharya.community_message_json(m));
 END IF;
 RAISE EXCEPTION 'INVALID_REQUEST';
END $$;

-- Restrict every helper as well as the public dispatcher; no default PUBLIC execution.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='acharya' AND p.proname LIKE 'community_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, acharya_runtime, authenticated',f.signature);
  EXECUTE format('ALTER FUNCTION %s OWNER TO acharya_community_service',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION acharya.community_operation(text,jsonb) TO acharya_runtime;
REVOKE CREATE ON SCHEMA acharya FROM acharya_community_service;
COMMIT;
