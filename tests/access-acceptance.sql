-- Run this WHOLE file as ONE fail-fast execute_sql payload as project postgres.
-- An unhandled DO error must abort the payload before the final receipt.
-- All synthetic users/profiles/families/content/markers live in an exception
-- subtransaction and are rolled back before the explicit outer ROLLBACK.
-- No DDL, Auth API, SMTP, sessions, Storage uploads, Storage object mutation,
-- or external calls. Direct verified Auth fixtures do not prove signup/JWT/email.
begin;

do $acceptance$
declare
  v_original_role text := current_user;
  v_a uuid := '319f734c-8bda-4814-95f0-42bda900a001'; -- owner
  v_b uuid := '319f734c-8bda-4814-95f0-42bda900a002'; -- admin/editor
  v_c uuid := '319f734c-8bda-4814-95f0-42bda900a003'; -- member/author
  v_d uuid := '319f734c-8bda-4814-95f0-42bda900a004'; -- viewer
  v_e uuid := '319f734c-8bda-4814-95f0-42bda900a005'; -- other family owner
  v_u uuid := '319f734c-8bda-4814-95f0-42bda900a006'; -- unverified
  v_ids uuid[];
  v_emails text[] := array['welyto-access-owner@example.invalid','welyto-access-admin@example.invalid',
    'welyto-access-member@example.invalid','welyto-access-viewer@example.invalid',
    'welyto-access-outsider@example.invalid','welyto-access-unverified@example.invalid'];
  v_family uuid;
  v_other_family uuid;
  v_delete_family uuid;
  v_empty_family uuid;
  v_admin_token text;
  v_member_token text;
  v_duplicate_token text;
  v_viewer_token text;
  v_unverified_token text;
  v_issued_token text;
  v_expired_token text;
  v_token text;
  v_private uuid;
  v_family_memory uuid;
  v_selected uuid;
  v_owner_memory uuid;
  v_other_memory uuid;
  v_delete_memory uuid;
  v_person uuid;
  v_other_person uuid;
  v_photo uuid;
  v_photo_path text;
  v_delete_photo_path text;
  v_photo_ids uuid[] := '{}';
  v_recipients jsonb;
  v_owner_recipients jsonb;
  v_result jsonb;
  v_count bigint;
  v_denied boolean;
  v_index integer;
  v_checks text[] := '{}';
  v_before text;
  v_after text;
  v_objects_before bigint;
  v_rolled_back boolean := false;
  v_snapshot_sql text := $snapshot$
    select md5(string_agg(line,E'\n' order by line)) from (
      select 'relation:' || n.nspname || '.' || c.relname || ':' || c.relrowsecurity::text || ':' || coalesce(c.relacl::text,'') as line
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p')
      union all select 'column:' || n.nspname || '.' || c.relname || '.' || a.attname || ':' || coalesce(a.attacl::text,'')
        from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public','private') and a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p')
      union all select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):' || coalesce(p.proacl::text,'') || ':' || pg_get_functiondef(p.oid)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private') and p.prokind = 'f'
      union all select 'policy:' || schemaname || '.' || tablename || '.' || policyname || ':' || roles::text || ':' || cmd || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'')
        from pg_policies where schemaname in ('public','private') or (schemaname = 'storage' and policyname like 'welyto_%')
      union all select 'constraint:' || n.nspname || '.' || c.relname || '.' || k.conname || ':' || pg_get_constraintdef(k.oid)
        from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','private')
      union all select 'index:' || n.nspname || '.' || c.relname || ':' || pg_get_indexdef(i.indexrelid)
        from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','private')
      union all select 'schema:' || nspname || ':' || coalesce(nspacl::text,'') from pg_namespace where nspname in ('public','private')
      union all select 'bucket:' || id || ':' || public::text || ':' || file_size_limit::text || ':' || allowed_mime_types::text from storage.buckets where id = 'memory-photos'
    ) catalog_lines
  $snapshot$;
begin
  v_ids := array[v_a,v_b,v_c,v_d,v_e,v_u];
  begin
    if current_user <> 'postgres' or session_user <> 'postgres' then raise exception 'Run as project postgres.'; end if;
    if exists(select 1 from auth.users where id = any(v_ids) or email = any(v_emails))
      or exists(select 1 from public.profiles where id = any(v_ids)) then
      raise exception 'Reserved fixture identities already exist; refusing to reuse them.'; end if;
    if exists(select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
      where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and t.tgenabled <> 'D'
        and not (t.tgname = 'welyto_new_profile' and n.nspname = 'private' and p.proname = 'new_profile')) then
      raise exception 'Inspect additional Auth triggers for external side effects before inserting fixtures.'; end if;
    if exists(select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
      where n.nspname in ('public','private') and not t.tgisinternal and t.tgenabled <> 'D'
        and not (pn.nspname = 'private' and p.proname = 'check_owner')) then
      raise exception 'Inspect additional application triggers before fixture writes.'; end if;
    if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
      raise exception 'Request roles must not bypass RLS.'; end if;
    if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relrowsecurity
      and ((n.nspname = 'public' and c.relname in ('profiles','families','family_members','invitations','memories','people','memory_people','memory_recipients','photos'))
        or (n.nspname = 'private' and c.relname in ('invitation_tokens','account_deletions','family_deletions')))) <> 12 then
      raise exception 'Every application table must have RLS.'; end if;
    if has_table_privilege('anon','public.memories','select')
      or has_table_privilege('authenticated','public.memories','update')
      or has_table_privilege('authenticated','public.family_members','update')
      or has_table_privilege('authenticated','private.invitation_tokens','select')
      or has_column_privilege('authenticated','public.profiles','id','update')
      or not has_column_privilege('authenticated','public.profiles','display_name','update')
      or has_function_privilege('anon','public.create_family(text,text)','execute') then
      raise exception 'A narrow application grant boundary changed.'; end if;
    if exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      and p.proname in ('create_family','create_invitation','accept_invitation','set_member_role','remove_member','transfer_ownership',
        'save_memory','archive_memory','reserve_photo','complete_photo','remove_photo','begin_account_deletion','finish_account_deletion',
        'begin_family_deletion','finish_family_deletion','deletion_photo_paths') and p.prosecdef) then
      raise exception 'Public mutation wrappers must remain security invokers.'; end if;
    if not exists(select 1 from storage.buckets where id = 'memory-photos' and not public and file_size_limit = 8388608
      and cardinality(allowed_mime_types) = 3 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']) then
      raise exception 'Private photo bucket limits do not match the contract.'; end if;
    execute v_snapshot_sql into v_before;
    select count(*) into v_objects_before from storage.objects where bucket_id = 'memory-photos';
    v_checks := array_append(v_checks,'RLS invoker RPC grants and private photo bucket limits');

    execute 'set local role anon';
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims','{"role":"anon"}',true);
    v_denied := false;
    begin perform public.create_family('Forbidden','Europe/Madrid'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Anonymous family creation must fail.'; end if;
    v_denied := false;
    begin perform 1 from public.profiles; exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Anonymous profile reads must fail.'; end if;
    v_denied := false;
    begin perform public.begin_account_deletion(); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Anonymous deletion must fail.'; end if;
    v_checks := array_append(v_checks,'anonymous data creation reads and deletion stay denied');

    execute format('set local role %I',v_original_role);
    for v_index in 1..6 loop
      insert into auth.users(id,email,email_confirmed_at,is_anonymous,role,aud,raw_user_meta_data,created_at,updated_at)
        values(v_ids[v_index],v_emails[v_index],case when v_index < 6 then now() else null end,false,'authenticated','authenticated',
          jsonb_build_object('display_name',case when v_index = 5 then repeat('X',120) else 'Synthetic person ' || v_index end,
            'role','owner','is_admin',true),now(),now());
    end loop;
    if (select count(*) from public.profiles where id = any(v_ids)) <> 6
      or (select display_name from public.profiles where id = v_e) is distinct from repeat('X',80) then
      raise exception 'Auth trigger must create bounded profiles without granting access.'; end if;
    v_checks := array_append(v_checks,'Auth fixture trigger creates bounded display-only profiles');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub',v_u::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u,'role','authenticated',
      'user_metadata',jsonb_build_object('role','owner','is_admin',true))::text,true);
    v_denied := false;
    begin perform public.create_family('Unverified forbidden','Europe/Madrid'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied or (select count(*) from public.profiles where id = v_u) <> 0 then
      raise exception 'Unverified metadata must not authorize family creation or profile reads.'; end if;
    v_checks := array_append(v_checks,'unverified account and editable owner metadata do not grant access');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_family := public.create_family('Synthetic family','Europe/Madrid');
    if v_family is null or (select owner_id from public.families where id = v_family) is distinct from v_a
      or (select role from public.family_members where family_id = v_family and user_id = v_a) is distinct from 'owner' then
      raise exception 'Family creation must atomically install the caller as owner.'; end if;
    v_denied := false;
    begin perform public.create_family('Bad timezone','Invalid/FixtureZone'); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Invalid family timezone must fail.'; end if;
    v_admin_token := public.create_invitation(v_family,v_emails[2],'admin');
    v_member_token := public.create_invitation(v_family,v_emails[3],'member');
    v_duplicate_token := public.create_invitation(v_family,v_emails[3],'member');
    v_viewer_token := public.create_invitation(v_family,v_emails[4],'viewer');
    v_unverified_token := public.create_invitation(v_family,v_emails[6],'member');
    v_expired_token := public.create_invitation(v_family,v_emails[5],'member');
    v_checks := array_append(v_checks,'family creation binds one owner and validates timezone');
    execute format('set local role %I',v_original_role);
    if v_admin_token is null or v_admin_token !~ '^[0-9a-f]{64}$' or not exists (
      select 1 from private.invitation_tokens t join public.invitations i on i.id = t.invitation_id
      where t.token_hash = extensions.digest(v_admin_token,'sha256') and octet_length(t.token_hash) = 32
        and t.invited_by = v_a and i.email = v_emails[2] and i.expires_at = now()+interval '7 days'
    ) then raise exception 'Invitation must store only a SHA-256 digest and expire in seven days.'; end if;
    update public.invitations i set expires_at = now()-interval '1 second' from private.invitation_tokens t
      where t.invitation_id = i.id and t.token_hash = extensions.digest(v_expired_token,'sha256');
    v_checks := array_append(v_checks,'invitation hashes and seven-day expiry are persisted privately');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub',v_e::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_e,'role','authenticated',
      'user_metadata',jsonb_build_object('role','owner','is_admin',true,'family_id',v_family))::text,true);
    v_denied := false;
    begin perform public.accept_invitation(v_admin_token); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Wrong verified email must not consume an invitation.'; end if;
    v_denied := false;
    begin perform public.accept_invitation(v_expired_token); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Expired invitation must fail.'; end if;
    if (select count(*) from public.families where id = v_family) <> 0 then raise exception 'Owner metadata must not expose another family.'; end if;
    perform set_config('request.jwt.claim.sub',v_u::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_u,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.accept_invitation(v_unverified_token); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Matching but unverified email must not join.'; end if;
    v_checks := array_append(v_checks,'wrong email unverified email and expired invitations fail closed');
    for v_index in 2..4 loop
      perform set_config('request.jwt.claim.sub',v_ids[v_index]::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_ids[v_index],'role','authenticated')::text,true);
      v_token := case v_index when 2 then v_admin_token when 3 then v_member_token else v_viewer_token end;
      if public.accept_invitation(v_token) is distinct from v_family then raise exception 'Verified invited account must join the named family.'; end if;
      v_denied := false;
      begin perform public.accept_invitation(v_token); exception when sqlstate '42501' then v_denied := true; end;
      if not v_denied then raise exception 'Consumed invitation must not be reused.'; end if;
    end loop;
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    if (select role from public.family_members where family_id = v_family and user_id = v_b) is distinct from 'admin'
      or (select role from public.family_members where family_id = v_family and user_id = v_c) is distinct from 'member'
      or (select role from public.family_members where family_id = v_family and user_id = v_d) is distinct from 'viewer' then
      raise exception 'Invitation roles must override editable owner metadata.'; end if;
    update public.profiles set display_name = 'Synthetic renamed owner' where id = v_a;
    if (select display_name from public.profiles where id = v_a) is distinct from 'Synthetic renamed owner' then raise exception 'Own profile update failed.'; end if;
    update public.profiles set display_name = 'Forbidden' where id = v_b;
    if found then raise exception 'Another profile was editable.'; end if;
    v_checks := array_append(v_checks,'verified invitations install exact roles and profile updates stay owned');

    perform public.set_member_role(v_family,v_c,'admin');
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    v_issued_token := public.create_invitation(v_family,v_emails[5],'member');
    v_denied := false;
    begin perform public.create_invitation(v_family,v_emails[5],'admin'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Admin must not appoint another admin.'; end if;
    v_denied := false;
    begin perform public.set_member_role(v_family,v_b,'owner'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Admin must not promote themselves.'; end if;
    v_denied := false;
    begin perform public.transfer_ownership(v_family,v_c); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Admin must not transfer ownership.'; end if;
    v_denied := false;
    begin perform public.remove_member(v_family,v_a); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Admin must not remove the owner.'; end if;
    v_denied := false;
    begin perform public.remove_member(v_family,v_c); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Admin must not remove another admin.'; end if;
    perform public.remove_member(v_family,v_d);
    if (select count(*) from public.family_members where family_id = v_family and user_id = v_d) <> 0 then raise exception 'Admin must be able to remove a viewer.'; end if;
    v_checks := array_append(v_checks,'admin can invite and remove viewers but cannot escalate or replace owners');
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    perform public.set_member_role(v_family,v_c,'member');
    v_viewer_token := public.create_invitation(v_family,v_emails[4],'viewer');
    perform set_config('request.jwt.claim.sub',v_d::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_d,'role','authenticated')::text,true);
    perform public.accept_invitation(v_viewer_token);
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.create_invitation(v_family,v_emails[5],'member'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied or (select count(*) from public.invitations where family_id = v_family) <> 0 then
      raise exception 'Ordinary members must not manage invitations.'; end if;
    v_denied := false;
    begin update public.family_members set role = 'owner' where family_id = v_family and user_id = v_c;
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Direct membership changes must fail.'; end if;
    v_checks := array_append(v_checks,'member invitation access and direct role mutations stay denied');

    v_recipients := jsonb_build_array(jsonb_build_object('user_id',v_a,'can_edit',true),
      jsonb_build_object('user_id',v_b,'can_edit',true),jsonb_build_object('user_id',v_d,'can_edit',false));
    v_private := public.save_memory(v_family,'Synthetic private memory','Private story',date '1990-01-01','Private place','private',
      array['Private person C'],array['private'],'[]'::jsonb);
    v_family_memory := public.save_memory(v_family,'Synthetic family memory','Family story',current_date,'Shared place','family',
      array[' Shared person ','Shared person'],array[' weekly ','weekly','family'],'[]'::jsonb);
    v_selected := public.save_memory(v_family,'Synthetic selected memory','Selected story',current_date,'Selected place','selected',
      array['Shared person'],array['selected'],v_recipients);
    if v_private is null or v_family_memory is null or v_selected is null
      or (select author_id from public.memories where id = v_private) is distinct from v_c
      or (select occurred_on from public.memories where id = v_private) is distinct from date '1990-01-01' then
      raise exception 'Memory creation must bind author and preserve the memory date.'; end if;
    select id into v_person from public.people where family_id = v_family and name = 'Shared person';
    if v_person is null or (select cardinality(tags) from public.memories where id = v_family_memory) is distinct from 2
      or not (select tags @> array['weekly','family'] from public.memories where id = v_family_memory) then
      raise exception 'People/tags must normalize whitespace and duplicates.'; end if;
    v_checks := array_append(v_checks,'author creates private family and selected memories with normalized people and tags');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_owner_recipients := jsonb_build_array(jsonb_build_object('user_id',v_c,'can_edit',true),jsonb_build_object('user_id',v_b,'can_edit',true));
    v_owner_memory := public.save_memory(v_family,'Synthetic owner selected memory','Owner story',current_date,'','selected',
      array['Shared person'],array['retained'],v_owner_recipients);
    if (select count(*) from public.memories where id = v_private) <> 0 then raise exception 'Owner status must not reveal private memories.'; end if;
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    if (select count(*) from public.memories where id = v_private) <> 0
      or (select count(*) from public.people where name = 'Private person C' and family_id = v_family) <> 0
      or (select count(*) from public.memory_people where memory_id = v_private) <> 0
      or (select count(*) from public.memories where id in (v_family_memory,v_selected)) <> 2 then
      raise exception 'Admin management must not expose private stories or people names.'; end if;
    v_checks := array_append(v_checks,'owner and admin management do not expose private memory or people data');

    perform set_config('request.jwt.claim.sub',v_d::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_d,'role','authenticated')::text,true);
    if (select count(*) from public.memories where id in (v_family_memory,v_selected)) <> 2 then raise exception 'Viewer must read granted family/selected memories.'; end if;
    v_denied := false;
    begin perform public.save_memory(v_family,'Forbidden viewer memory','',current_date,'','family','{}','{}','[]'::jsonb);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Viewer must not create memories.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_selected,'image/jpeg',1); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Viewer must not reserve photos.'; end if;
    v_checks := array_append(v_checks,'viewer reads granted memories but cannot contribute or upload');

    perform set_config('request.jwt.claim.sub',v_e::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_e,'role','authenticated')::text,true);
    if (select count(*) from public.memories where family_id = v_family) <> 0
      or (select count(*) from public.family_members where family_id = v_family) <> 0 then
      raise exception 'Outsider must not read family content or membership.'; end if;
    v_other_family := public.create_family('Synthetic other family','UTC');
    v_other_memory := public.save_memory(v_other_family,'Other family memory','Other story',current_date,'','family',
      array['Shared person'],array['other'],'[]'::jsonb);
    select id into v_other_person from public.people where family_id = v_other_family and name = 'Shared person';
    if v_other_person is null or v_other_person = v_person then raise exception 'Equal person names in two families must retain separate identities.'; end if;
    v_token := public.create_invitation(v_other_family,v_emails[2],'member');
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    perform public.accept_invitation(v_token);
    v_checks := array_append(v_checks,'outsider data is isolated and person identities remain family scoped');

    if public.save_memory(v_family,'Synthetic edited selected memory','Editor story',current_date,'Edited place','selected',
      array['Shared person'],array['selected'],v_recipients,v_selected) is distinct from v_selected then
      raise exception 'Selected edit recipient must be able to edit the same memory.'; end if;
    if (select story from public.memories where id = v_selected) is distinct from 'Editor story' then raise exception 'Editor save did not persist.'; end if;
    v_checks := array_append(v_checks,'selected recipient with edit permission can update content');
    v_denied := false;
    begin perform public.save_memory(v_family,'Forbidden audience','',current_date,'','family','{}','{}','[]'::jsonb,v_selected);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Editor must not change visibility.'; end if;
    v_denied := false;
    begin perform public.save_memory(v_family,'Forbidden recipients','',current_date,'','selected','{}','{}',
      jsonb_build_array(jsonb_build_object('user_id',v_b,'can_edit',true)),v_selected);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Editor must not change recipients.'; end if;
    v_denied := false;
    begin perform public.save_memory(v_other_family,'Forbidden family move','',current_date,'','family','{}','{}','[]'::jsonb,v_selected);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Editor belonging to both families must not move a memory.'; end if;
    v_denied := false;
    begin update public.memories set author_id = v_b,family_id = v_other_family where id = v_selected;
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied or (select author_id from public.memories where id = v_selected) is distinct from v_c
      or (select family_id from public.memories where id = v_selected) is distinct from v_family
      or (select story from public.memories where id = v_selected) is distinct from 'Editor story' then
      raise exception 'Author/family/audience must remain immutable to editors and failed saves atomic.'; end if;
    v_checks := array_append(v_checks,'editor cannot change audience recipients family or author');

    v_denied := false;
    begin perform public.archive_memory(v_selected,true); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Editor must not archive another author memory.'; end if;
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    perform public.archive_memory(v_family_memory,true);
    if (select archived_at from public.memories where id = v_family_memory) is null then raise exception 'Author archive did not persist.'; end if;
    v_denied := false;
    begin perform public.save_memory(v_family,'Archived write','',current_date,'','family','{}','{}','[]'::jsonb,v_family_memory);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Archived memory must reject edits.'; end if;
    perform public.archive_memory(v_family_memory,false);
    if (select archived_at from public.memories where id = v_family_memory) is not null then raise exception 'Author unarchive did not persist.'; end if;
    v_checks := array_append(v_checks,'only author archives and archived memories reject edits');

    for v_index in 1..3 loop
      v_result := case v_index
        when 1 then jsonb_build_array(jsonb_build_object('user_id',v_e,'can_edit',false))
        when 2 then jsonb_build_array(jsonb_build_object('user_id',v_b,'can_edit',true),jsonb_build_object('user_id',v_b,'can_edit',true))
        else jsonb_build_array(jsonb_build_object('user_id',v_d,'can_edit',true)) end;
      v_denied := false;
      begin perform public.save_memory(v_family,'Invalid recipients','',current_date,'','selected','{}','{}',v_result);
      exception when sqlstate '22023' then v_denied := true; end;
      if not v_denied then raise exception 'Cross-family duplicate or viewer-editor recipients must fail.'; end if;
    end loop;
    if (select count(*) from public.memories where family_id = v_family and title = 'Invalid recipients') <> 0 then
      raise exception 'Rejected recipients left a partial memory.'; end if;
    v_denied := false;
    begin insert into public.memory_people(memory_id,person_id) values(v_selected,v_other_person);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Direct cross-family person linking must fail.'; end if;
    v_checks := array_append(v_checks,'recipient validation is atomic and direct cross-family people linking is denied');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    perform public.set_member_role(v_family,v_b,'viewer');
    if (select can_edit from public.memory_recipients where memory_id = v_selected and user_id = v_b) is distinct from false then
      raise exception 'Viewer demotion must clear existing edit grants.'; end if;
    v_recipients := jsonb_build_array(jsonb_build_object('user_id',v_a,'can_edit',true),
      jsonb_build_object('user_id',v_b,'can_edit',false),jsonb_build_object('user_id',v_d,'can_edit',false));
    if public.save_memory(v_family,'Synthetic second-editor update','Second editor story',current_date,'','selected',
      array['Shared person'],array['selected'],v_recipients,v_selected) is distinct from v_selected then
      raise exception 'Another granted editor must still save after the demotion.'; end if;
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.save_memory(v_family,'Forbidden viewer edit','',current_date,'','selected','{}','{}',v_recipients,v_selected);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Demoted viewer must not edit using an old grant.'; end if;
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    perform public.set_member_role(v_family,v_b,'admin');
    v_checks := array_append(v_checks,'viewer demotion clears grants without blocking another selected editor');

    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/gif',100); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Unsupported photo MIME must fail.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/jpeg',0); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Empty photo must fail.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/jpeg',8388609); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Photo over eight MiB must fail.'; end if;
    v_checks := array_append(v_checks,'photo reservations reject unsupported MIME empty and oversized content');
    for v_index in 1..20 loop
      v_result := public.reserve_photo(v_private,case v_index when 2 then 'image/png' when 3 then 'image/webp' else 'image/jpeg' end,
        case when v_index = 3 then 8388608 else 1 end);
      v_photo := (v_result->>'id')::uuid;
      v_photo_ids := array_append(v_photo_ids,v_photo);
      if v_photo is null or v_result->>'state' is distinct from 'pending'
        or (v_result->>'uploader_id')::uuid is distinct from v_c or (v_result->>'memory_id')::uuid is distinct from v_private
        or v_result->>'content_type' is distinct from case v_index when 2 then 'image/png' when 3 then 'image/webp' else 'image/jpeg' end
        or (v_result->>'byte_size')::bigint is distinct from case when v_index = 3 then 8388608 else 1 end
        or v_result->>'storage_path' is distinct from v_family::text || '/' || v_private::text || '/' || v_photo::text ||
          case v_index when 2 then '.png' when 3 then '.webp' else '.jpg' end then
        raise exception 'Photo reservation must bind actor memory state and exact path.'; end if;
      if v_index = 1 then v_photo_path := v_result->>'storage_path'; end if;
    end loop;
    if (select count(*) from public.photos where memory_id = v_private and state = 'pending') <> 20
      or private.photo_read_allowed(v_photo_path) is distinct from true
      or private.photo_write_allowed(v_photo_path,'{"mimetype":"image/jpeg","size":1}'::jsonb,'insert') is distinct from true
      or private.photo_write_allowed(v_photo_path,'{"mimetype":"image/png","size":1}'::jsonb,'insert') is distinct from false
      or private.photo_write_allowed(v_photo_path || '.wrong','{}'::jsonb,'insert') is distinct from false then
      raise exception 'Expected twenty reservations with exact-path and metadata authorizers.'; end if;
    v_checks := array_append(v_checks,'JPEG PNG and WebP reservations use exact pending paths and allow the byte boundary');
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/jpeg',1); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Twenty-first pending photo must fail.'; end if;
    v_denied := false;
    begin perform public.complete_photo(v_photo_ids[1]); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied or (select state from public.photos where id = v_photo_ids[1]) is distinct from 'pending' then
      raise exception 'Completion without a real object must fail and retain pending state.'; end if;
    perform public.remove_photo(v_photo_ids[20]);
    if (select count(*) from public.photos where memory_id = v_private) <> 19 then raise exception 'Empty reservation removal must delete only metadata.'; end if;
    v_checks := array_append(v_checks,'photo cap missing-object completion and empty-reservation removal are enforced');

    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    if (select count(*) from public.photos where memory_id = v_private) <> 0 or private.photo_read_allowed(v_photo_path) is distinct from false then
      raise exception 'Admin cannot read private photo metadata or satisfy original-photo authorization.'; end if;
    v_checks := array_append(v_checks,'private photo metadata and SQL original-photo authorizer exclude admins');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    perform public.remove_member(v_family,v_c);
    if exists(select 1 from public.memory_recipients where memory_id = v_owner_memory and user_id = v_c) then raise exception 'Removal must delete recipient grants.'; end if;
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    if (select count(*) from public.memories where family_id = v_family) <> 0
      or (select count(*) from public.families where id = v_family) <> 0
      or private.photo_read_allowed(v_photo_path) is distinct from false then raise exception 'Removal must revoke fresh content and photo authorization.'; end if;
    v_denied := false;
    begin perform public.accept_invitation(v_duplicate_token); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Another outstanding invitation must not undo removal.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/jpeg',1); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Removed author must not reserve another photo.'; end if;
    v_checks := array_append(v_checks,'removal revokes fresh access and invalidates a second outstanding invitation');
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_token := public.create_invitation(v_family,v_emails[3],'member');
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    perform public.accept_invitation(v_token);
    if (select count(*) from public.memories where id = v_private) <> 1 or (select count(*) from public.memories where id = v_owner_memory) <> 0 then
      raise exception 'Fresh re-invitation restores membership but not deleted recipient grants.'; end if;
    v_checks := array_append(v_checks,'fresh deliberate invitation restores membership without restoring old grants');

    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    v_issued_token := public.create_invitation(v_family,v_emails[5],'member');
    perform public.remove_member(v_family,v_b);
    if (select count(*) from public.families where id = v_family) <> 0 then raise exception 'Non-owner admin self-leave must remove family access.'; end if;
    perform set_config('request.jwt.claim.sub',v_e::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_e,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.accept_invitation(v_issued_token); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'An invitation issued by a departed manager must be invalidated.'; end if;
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_token := public.create_invitation(v_family,v_emails[2],'admin');
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    perform public.accept_invitation(v_token);
    v_checks := array_append(v_checks,'non-owner self-leave invalidates invitations issued by that manager');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.remove_member(v_family,v_a); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Owner self-removal must fail.'; end if;
    v_denied := false;
    begin perform public.transfer_ownership(v_family,v_e); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Owner must not transfer to a nonmember.'; end if;
    perform public.transfer_ownership(v_family,v_b);
    if (select owner_id from public.families where id = v_family) is distinct from v_b
      or (select role from public.family_members where family_id = v_family and user_id = v_a) is distinct from 'admin' then
      raise exception 'Transfer must install one new owner and demote the former owner.'; end if;
    v_denied := false;
    begin perform public.set_member_role(v_family,v_c,'viewer'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Former owner must lose owner-only powers.'; end if;
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    perform public.transfer_ownership(v_family,v_a);
    v_checks := array_append(v_checks,'ownership transfer is atomic and owner self-removal or outsider transfer fails');

    execute format('set local role %I',v_original_role);
    v_denied := false;
    begin
      delete from public.family_members where family_id = v_family and user_id = v_a;
      set constraints all immediate;
    exception when sqlstate '23514' then v_denied := true; end;
    if not v_denied then raise exception 'Deferred constraint must prevent an ownerless family even for direct administrative DML.'; end if;
    set constraints all deferred;
    v_denied := false;
    begin delete from auth.users where id = v_a; exception when sqlstate '23503' then v_denied := true; end;
    if not v_denied then raise exception 'Owned family must block an Auth/profile cascade that would orphan it.'; end if;
    v_checks := array_append(v_checks,'database owner constraints reject orphaning membership and Auth deletion');

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.begin_account_deletion(); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Family owner must transfer or delete before account deletion.'; end if;
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.finish_account_deletion(); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Account finalization without a guard must fail.'; end if;
    v_denied := false;
    begin perform 1 from public.deletion_photo_paths(null,100); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Cleanup paths must require the caller deletion guard.'; end if;
    v_checks := array_append(v_checks,'account deletion requires a non-owner authenticated guard before finalization');

    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_delete_family := public.create_family('Synthetic deletion family','UTC');
    v_delete_memory := public.save_memory(v_delete_family,'Delete family memory','Delete story',current_date,'','family',array['Delete-only person'],'{}','[]'::jsonb);
    v_result := public.reserve_photo(v_delete_memory,'image/png',1);
    v_delete_photo_path := v_result->>'storage_path';
    v_token := public.create_invitation(v_delete_family,v_emails[2],'member');
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    perform public.accept_invitation(v_token);
    v_denied := false;
    begin perform public.begin_family_deletion(v_delete_family); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'A non-owner must not begin family deletion.'; end if;
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.finish_family_deletion(v_delete_family); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Owner family finalization must require its guard.'; end if;
    perform public.begin_family_deletion(v_delete_family);
    perform public.begin_family_deletion(v_delete_family);
    if (select count(*) from public.families where id = v_delete_family) <> 1
      or (select count(*) from public.family_members where family_id = v_delete_family) <> 1
      or (select role from public.family_members where family_id = v_delete_family and user_id = v_a) is distinct from 'owner'
      or (select count(*) from public.memories where family_id = v_delete_family) <> 0
      or private.photo_read_allowed(v_delete_photo_path) is distinct from false then
      raise exception 'Pending owner must retain retry metadata without family content.'; end if;
    v_checks := array_append(v_checks,'family deletion is owner-guarded and preserves narrow retry discovery');
    v_denied := false;
    begin perform public.save_memory(v_delete_family,'Blocked pending write','',current_date,'','family','{}','{}','[]'::jsonb);
    exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Pending family must block memory writes.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_delete_memory,'image/jpeg',1); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Pending family must block photo reservations.'; end if;
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    if (select count(*) from public.families where id = v_delete_family) <> 0
      or (select count(*) from public.memories where family_id = v_delete_family) <> 0 then raise exception 'Other members must lose pending-family visibility.'; end if;
    v_denied := false;
    begin perform 1 from public.deletion_photo_paths(v_delete_family,100); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Another member must not obtain owner cleanup paths.'; end if;
    v_denied := false;
    begin perform public.finish_family_deletion(v_delete_family); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Another member must not finish owner deletion.'; end if;
    v_checks := array_append(v_checks,'pending family blocks content writes and excludes other members from cleanup');
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    if (select count(*) from public.deletion_photo_paths(v_delete_family,100)) <> 0 then raise exception 'Unuploaded reservations must not pretend to be real Storage objects.'; end if;
    perform public.finish_family_deletion(v_delete_family);
    perform public.finish_family_deletion(v_delete_family);
    if (select count(*) from public.families where id = v_delete_family) <> 0 then raise exception 'Family finalization did not delete its metadata.'; end if;
    v_empty_family := public.create_family('Synthetic empty family','UTC');
    perform public.begin_family_deletion(v_empty_family);
    perform public.finish_family_deletion(v_empty_family);
    v_checks := array_append(v_checks,'family cleanup finalizes empty and unuploaded-only families without fabricated objects');

    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    perform public.begin_account_deletion();
    perform public.begin_account_deletion();
    if (select count(*) from public.profiles where id = v_c) <> 1 or (select count(*) from public.families) <> 0
      or (select count(*) from public.memories) <> 0 or private.photo_read_allowed(v_photo_path) is distinct from false then
      raise exception 'Pending account must retain own profile while losing normal content access.'; end if;
    v_denied := false;
    begin perform public.create_family('Blocked pending account','UTC'); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Pending account must not create new ownership.'; end if;
    v_denied := false;
    begin perform public.reserve_photo(v_private,'image/jpeg',1); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Pending account must not reserve uploads.'; end if;
    v_denied := false;
    begin perform 1 from public.deletion_photo_paths(null,101); exception when sqlstate '22023' then v_denied := true; end;
    if not v_denied then raise exception 'Deletion path batches must remain bounded.'; end if;
    v_checks := array_append(v_checks,'pending account preserves retry profile and blocks new families or uploads');
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_denied := false;
    begin perform public.transfer_ownership(v_family,v_c); exception when sqlstate '42501' then v_denied := true; end;
    if not v_denied then raise exception 'Incoming ownership must not bypass a pending account marker.'; end if;
    if (select count(*) from public.memories where author_id = v_c) <> 0 then raise exception 'Pending author content must not remain readable to another member.'; end if;
    v_checks := array_append(v_checks,'pending account cannot receive ownership and its authored content stays hidden');
    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    if (select count(*) from public.deletion_photo_paths(null,100)) <> 0 then raise exception 'Only real existing objects qualify for Storage cleanup.'; end if;
    perform public.finish_account_deletion();
    perform public.begin_account_deletion();
    perform public.finish_account_deletion();
    if (select count(*) from public.profiles where id = v_c) <> 1 then raise exception 'Auth deletion retry must retain the profile until Auth Admin succeeds.'; end if;
    execute format('set local role %I',v_original_role);
    if not exists(select 1 from auth.users where id = v_c)
      or not exists(select 1 from private.account_deletions where user_id = v_c)
      or exists(select 1 from public.memories where author_id = v_c)
      or exists(select 1 from public.photos where uploader_id = v_c)
      or exists(select 1 from public.family_members where user_id = v_c)
      or exists(select 1 from public.people where family_id = v_family and name = 'Private person C')
      or not exists(select 1 from public.people where id = v_person and name = 'Shared person')
      or not exists(select 1 from public.memories where id = v_other_memory and author_id = v_e) then
      raise exception 'Account cleanup must remove owned data/orphans, retain shared data and remain retryable before Auth deletion.'; end if;
    if exists(select 1 from public.memories m join public.memory_people mp on mp.memory_id = m.id join public.people p on p.id = mp.person_id
      where (m.family_id in (v_family,v_other_family)) and p.family_id <> m.family_id) then
      raise exception 'A fixture memory/person link crossed family boundaries.'; end if;
    v_checks := array_append(v_checks,'account data cleanup removes authored content and orphans while preserving retry and unrelated data');

    set constraints all immediate;
    if (select count(*) from storage.objects where bucket_id = 'memory-photos') <> v_objects_before then raise exception 'Acceptance must not change Storage objects.'; end if;
    execute v_snapshot_sql into v_after;
    if v_before is distinct from v_after then raise exception 'Acceptance changed catalog grants policies functions indexes or bucket configuration.'; end if;
    v_checks := array_append(v_checks,'catalog configuration stays unchanged and valid final ownership constraints pass');
    raise sqlstate 'WA001' using message = 'welyto_access_acceptance_rollback';
  exception when sqlstate 'WA001' then
    if sqlerrm <> 'welyto_access_acceptance_rollback' then raise; end if;
    v_rolled_back := true;
  end;

  if not v_rolled_back or current_user <> v_original_role then raise exception 'Rollback must restore the original administrator role.'; end if;
  if exists(select 1 from auth.users where id = any(v_ids)) or exists(select 1 from public.profiles where id = any(v_ids))
    or exists(select 1 from public.families where owner_id = any(v_ids))
    or exists(select 1 from public.family_members where user_id = any(v_ids))
    or exists(select 1 from public.memories where author_id = any(v_ids))
    or exists(select 1 from public.photos where uploader_id = any(v_ids))
    or exists(select 1 from private.account_deletions where user_id = any(v_ids))
    or exists(select 1 from private.family_deletions where actor_id = any(v_ids))
    or exists(select 1 from public.people where family_id in (v_family,v_other_family,v_delete_family,v_empty_family))
    or exists(select 1 from public.invitations where family_id in (v_family,v_other_family,v_delete_family,v_empty_family))
    or exists(select 1 from private.invitation_tokens where invited_by = any(v_ids)) then
    raise exception 'Rollback left synthetic Auth application or deletion-marker data.'; end if;
  execute v_snapshot_sql into v_after;
  if v_before is distinct from v_after or (select count(*) from storage.objects where bucket_id = 'memory-photos') <> v_objects_before then
    raise exception 'Rollback changed the catalog or Storage objects.'; end if;
  v_checks := array_append(v_checks,'all synthetic Auth profiles family content and deletion markers roll back');
  if cardinality(v_checks) <> 37 then raise exception 'Named assertion count changed; update the receipt.'; end if;
  raise notice 'Welyto access acceptance passed % groups; fixtures rolled back; catalog MD5 %.',cardinality(v_checks),v_after;
end;
$acceptance$;

rollback;

-- execute_sql returns only this final fresh read. The whole-payload DO must have
-- succeeded; no temporary table or session report is assumed to survive ROLLBACK.
with assertion_groups as (
  select array[
    'RLS invoker RPC grants and private photo bucket limits',
    'anonymous data creation reads and deletion stay denied',
    'Auth fixture trigger creates bounded display-only profiles',
    'unverified account and editable owner metadata do not grant access',
    'family creation binds one owner and validates timezone',
    'invitation hashes and seven-day expiry are persisted privately',
    'wrong email unverified email and expired invitations fail closed',
    'verified invitations install exact roles and profile updates stay owned',
    'admin can invite and remove viewers but cannot escalate or replace owners',
    'member invitation access and direct role mutations stay denied',
    'author creates private family and selected memories with normalized people and tags',
    'owner and admin management do not expose private memory or people data',
    'viewer reads granted memories but cannot contribute or upload',
    'outsider data is isolated and person identities remain family scoped',
    'selected recipient with edit permission can update content',
    'editor cannot change audience recipients family or author',
    'only author archives and archived memories reject edits',
    'recipient validation is atomic and direct cross-family people linking is denied',
    'viewer demotion clears grants without blocking another selected editor',
    'photo reservations reject unsupported MIME empty and oversized content',
    'JPEG PNG and WebP reservations use exact pending paths and allow the byte boundary',
    'photo cap missing-object completion and empty-reservation removal are enforced',
    'private photo metadata and SQL original-photo authorizer exclude admins',
    'removal revokes fresh access and invalidates a second outstanding invitation',
    'fresh deliberate invitation restores membership without restoring old grants',
    'non-owner self-leave invalidates invitations issued by that manager',
    'ownership transfer is atomic and owner self-removal or outsider transfer fails',
    'database owner constraints reject orphaning membership and Auth deletion',
    'account deletion requires a non-owner authenticated guard before finalization',
    'family deletion is owner-guarded and preserves narrow retry discovery',
    'pending family blocks content writes and excludes other members from cleanup',
    'family cleanup finalizes empty and unuploaded-only families without fabricated objects',
    'pending account preserves retry profile and blocks new families or uploads',
    'pending account cannot receive ownership and its authored content stays hidden',
    'account data cleanup removes authored content and orphans while preserving retry and unrelated data',
    'catalog configuration stays unchanged and valid final ownership constraints pass',
    'all synthetic Auth profiles family content and deletion markers roll back'
  ]::text[] as checks
), fixtures as (
  select array['319f734c-8bda-4814-95f0-42bda900a001','319f734c-8bda-4814-95f0-42bda900a002',
    '319f734c-8bda-4814-95f0-42bda900a003','319f734c-8bda-4814-95f0-42bda900a004',
    '319f734c-8bda-4814-95f0-42bda900a005','319f734c-8bda-4814-95f0-42bda900a006']::uuid[] as ids
), residue as (
  select (select count(*) from auth.users where id = any(fixtures.ids)) as auth_users,
    (select count(*) from public.profiles where id = any(fixtures.ids)) as profiles,
    (select count(*) from public.families where owner_id = any(fixtures.ids)) as families,
    (select count(*) from public.family_members where user_id = any(fixtures.ids)) as memberships,
    (select count(*) from public.memories where author_id = any(fixtures.ids)) as memories,
    (select count(*) from public.photos where uploader_id = any(fixtures.ids)) as photos,
    (select count(*) from private.account_deletions where user_id = any(fixtures.ids)) as account_markers,
    (select count(*) from private.family_deletions where actor_id = any(fixtures.ids)) as family_markers,
    (select count(*) from private.invitation_tokens where invited_by = any(fixtures.ids)) as issued_invitation_hashes
  from fixtures
)
select jsonb_build_object('passed',not exists(select 1 from jsonb_each(to_jsonb(residue)) e where e.value <> '0'::jsonb),
  'checks_passed',cardinality(assertion_groups.checks),'checks',to_jsonb(assertion_groups.checks),
  'fixture_residue_after_rollback',to_jsonb(residue),'catalog_snapshot_before_after_match',true,
  'storage_objects_mutated',false,
  'proof_boundary','PostgreSQL grants RLS sequential RPC authorization owner/audience/recipient constraints and reservation/deletion metadata only. No real signup email delivery JWT sessions Edge Functions Storage upload/download/object deletion device browser or concurrent-client proof.'
) as access_acceptance from assertion_groups cross join residue;
