-- Welyto initial family/memory schema; filename created by Supabase CLI.
begin;
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Family member' check (length(trim(display_name)) between 1 and 80)
);
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  timezone text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(),
  primary key (family_id,user_id)
);
create unique index family_one_owner on public.family_members(family_id) where role = 'owner';
create index family_members_user on public.family_members(user_id,family_id);
create index families_owner on public.families(owner_id);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null check (length(email) between 3 and 254 and email = lower(trim(email))),
  role text not null check (role in ('admin','member','viewer')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_family on public.invitations(family_id,created_at desc);
create table private.invitation_tokens (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  token_hash bytea not null unique,
  invited_by uuid references public.profiles(id) on delete set null
);
create index invitation_tokens_inviter on private.invitation_tokens(invited_by);
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  story text not null default '' check (length(story) <= 20000),
  occurred_on date not null,
  location text not null default '' check (length(location) <= 200),
  visibility text not null check (visibility in ('family','private','selected')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index memories_family_week on public.memories(family_id,created_at desc);
create index memories_author on public.memories(author_id);
create table public.people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  unique (family_id,name)
);
create table public.memory_people (
  memory_id uuid not null references public.memories(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  primary key (memory_id,person_id)
);
create index memory_people_person on public.memory_people(person_id);
create table public.memory_recipients (
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_edit boolean not null default false,
  primary key (memory_id,user_id)
);
create index memory_recipients_user on public.memory_recipients(user_id,memory_id);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 8388608),
  state text not null default 'pending' check (state in ('pending','ready')),
  created_at timestamptz not null default now()
);
create index photos_memory on public.photos(memory_id);
create index photos_uploader on public.photos(uploader_id);
create table private.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
create table private.family_deletions (
  family_id uuid primary key references public.families(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now()
);
create index family_deletions_actor on private.family_deletions(actor_id);

create function private.verified_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and exists (
    select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false)
  );
$$;
create function private.user_active(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.verified_user(p_user_id)
    and not exists (select 1 from private.account_deletions d where d.user_id = p_user_id);
$$;
create function private.can_retry_family_deletion(p_family_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.user_active(auth.uid()) and exists (
    select 1 from private.family_deletions d join public.families f on f.id = d.family_id
    where d.family_id = p_family_id and d.actor_id = auth.uid() and f.owner_id = auth.uid()
  );
$$;
create function private.require_user(p_allow_deleting boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  -- Serialize a user's mutations with their account-deletion guard.
  perform 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous,false) for update;
  if not found then raise exception 'A verified account is required.' using errcode = '42501'; end if;
  if not p_allow_deleting and exists (select 1 from private.account_deletions where user_id = v_user) then
    raise exception 'Account deletion is pending. Retry deletion to finish.' using errcode = '42501';
  end if;
  return v_user;
end;
$$;
create function private.is_member(p_family_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.user_active(p_user_id)
    and not exists (select 1 from private.family_deletions d where d.family_id = p_family_id)
    and exists (select 1 from public.family_members fm where fm.family_id = p_family_id and fm.user_id = p_user_id);
$$;
create function private.is_manager(p_family_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(p_family_id,auth.uid()) and exists (
    select 1 from public.family_members where family_id = p_family_id and user_id = auth.uid() and role in ('owner','admin')
  );
$$;
create function private.can_read_memory(p_memory_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memories m where m.id = p_memory_id
    and private.is_member(m.family_id,auth.uid()) and private.user_active(m.author_id)
    and (m.author_id = auth.uid() or m.visibility = 'family' or (m.visibility = 'selected' and exists (
      select 1 from public.memory_recipients r where r.memory_id = m.id and r.user_id = auth.uid()
    ))));
$$;
create function private.can_edit_memory(p_memory_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memories m join public.family_members fm on fm.family_id = m.family_id
    where m.id = p_memory_id and fm.user_id = auth.uid() and fm.role <> 'viewer'
      and private.can_read_memory(m.id) and (m.author_id = auth.uid() or (m.visibility = 'selected' and exists (
        select 1 from public.memory_recipients r where r.memory_id = m.id and r.user_id = auth.uid() and r.can_edit
      ))));
$$;
create function private.lock_family(p_family_id uuid) returns public.families
language plpgsql security definer set search_path = '' as $$
declare v_family public.families;
begin
  perform private.require_user();
  select * into v_family from public.families where id = p_family_id for update;
  if not found or not private.is_member(p_family_id,auth.uid()) then
    raise exception 'Family access is unavailable.' using errcode = '42501';
  end if;
  return v_family;
end;
$$;
create function private.lock_memory(p_memory_id uuid) returns public.memories
language plpgsql security definer set search_path = '' as $$
declare v_memory public.memories; v_family_id uuid;
begin
  select family_id into v_family_id from public.memories where id = p_memory_id;
  perform private.lock_family(v_family_id);
  select * into v_memory from public.memories where id = p_memory_id for update;
  if not found or not private.can_edit_memory(p_memory_id) then
    raise exception 'Memory edit access is unavailable.' using errcode = '42501';
  end if;
  return v_memory;
end;
$$;

-- These two trigger functions run for trusted Auth/constraint events, not RPC callers.
create function private.new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values (new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),80),''),'Family member'));
  return new;
end;
$$;
create trigger welyto_new_profile after insert on auth.users for each row execute function private.new_profile();
insert into public.profiles(id,display_name)
  select id,coalesce(nullif(left(trim(raw_user_meta_data->>'display_name'),80),''),'Family member') from auth.users
  on conflict (id) do nothing;
create function private.check_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_family_id uuid;
begin
  if tg_table_name = 'families' then v_family_id := coalesce(new.id,old.id);
  else v_family_id := coalesce(new.family_id,old.family_id); end if;
  if exists (select 1 from public.families f where f.id = v_family_id and not exists (
    select 1 from public.family_members fm where fm.family_id = f.id and fm.user_id = f.owner_id and fm.role = 'owner'
  )) then raise exception 'A family must retain its owner membership.' using errcode = '23514'; end if;
  return null;
end;
$$;
create constraint trigger welyto_family_owner after insert or update on public.families
  deferrable initially deferred for each row execute function private.check_owner();
create constraint trigger welyto_member_owner after insert or update or delete on public.family_members
  deferrable initially deferred for each row execute function private.check_owner();

create function private.create_family(p_name text,p_timezone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_id uuid;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 100 or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then raise exception 'Provide a family name and valid timezone.' using errcode = '22023'; end if;
  insert into public.families(name,timezone,owner_id) values(trim(p_name),p_timezone,v_user) returning id into v_id;
  insert into public.family_members(family_id,user_id,role) values(v_id,v_user,'owner');
  return v_id;
end;
$$;
create function private.create_invitation(p_family_id uuid,p_email text,p_role text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_family public.families; v_id uuid; v_token text := encode(extensions.gen_random_bytes(32),'hex');
begin
  v_family := private.lock_family(p_family_id);
  if not private.is_manager(p_family_id) or p_role is null or p_role not in ('admin','member','viewer')
    or (p_role = 'admin' and v_family.owner_id <> auth.uid()) then
    raise exception 'Only an owner can appoint admins; owners and admins can invite members/viewers.' using errcode = '42501';
  end if;
  if p_email is null or length(trim(p_email)) not between 3 and 254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Provide a valid email address.' using errcode = '22023';
  end if;
  insert into public.invitations(family_id,email,role,expires_at) values
    (p_family_id,lower(trim(p_email)),p_role,now() + interval '7 days') returning id into v_id;
  insert into private.invitation_tokens(invitation_id,token_hash,invited_by)
    values(v_id,extensions.digest(v_token,'sha256'),auth.uid());
  return v_token;
end;
$$;
create function private.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_invite public.invitations; v_email text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invitation is unavailable.' using errcode = '22023'; end if;
  select i.* into v_invite from public.invitations i join private.invitation_tokens t on t.invitation_id = i.id
    where t.token_hash = extensions.digest(p_token,'sha256');
  if not found then raise exception 'Invitation is unavailable.' using errcode = '42501'; end if;
  perform 1 from public.families where id = v_invite.family_id for update;
  select * into v_invite from public.invitations where id = v_invite.id for update;
  if not found then raise exception 'Invitation is unavailable.' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id = v_user and email_confirmed_at is not null;
  if v_invite.accepted_at is not null or v_invite.expires_at <= now() or v_invite.email is distinct from v_email
    or exists (select 1 from private.family_deletions where family_id = v_invite.family_id) then
    raise exception 'Invitation is expired, used, or belongs to another verified email.' using errcode = '42501';
  end if;
  insert into public.family_members(family_id,user_id,role) values(v_invite.family_id,v_user,v_invite.role)
    on conflict (family_id,user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v_invite.id;
  return v_invite.family_id;
end;
$$;
create function private.set_member_role(p_family_id uuid,p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_family public.families;
begin
  v_family := private.lock_family(p_family_id);
  if v_family.owner_id <> auth.uid() or p_user_id = v_family.owner_id or p_role is null or p_role not in ('admin','member','viewer')
    or not private.is_member(p_family_id,p_user_id) then raise exception 'Only the owner can change another current member role.' using errcode = '42501'; end if;
  update public.family_members set role = p_role where family_id = p_family_id and user_id = p_user_id;
  if p_role = 'viewer' then
    perform 1 from public.memories m where m.family_id = p_family_id and exists(select 1 from public.memory_recipients r
      where r.memory_id = m.id and r.user_id = p_user_id and r.can_edit) order by m.id for update;
    update public.memory_recipients r set can_edit = false from public.memories m
      where r.memory_id = m.id and m.family_id = p_family_id and r.user_id = p_user_id and r.can_edit;
  end if;
end;
$$;
create function private.remove_member(p_family_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_family public.families; v_role text;
begin
  v_family := private.lock_family(p_family_id);
  select role into v_role from public.family_members where family_id = p_family_id and user_id = p_user_id;
  if v_role is null or p_user_id = v_family.owner_id or (p_user_id <> auth.uid()
    and (not private.is_manager(p_family_id) or (v_family.owner_id <> auth.uid() and v_role = 'admin'))) then
    raise exception 'Members can leave; admins can remove members/viewers; owners must transfer first.' using errcode = '42501';
  end if;
  perform 1 from public.memories m where m.family_id = p_family_id and exists(select 1 from public.memory_recipients r
    where r.memory_id = m.id and r.user_id = p_user_id) order by m.id for update;
  delete from public.memory_recipients r using public.memories m
    where r.memory_id = m.id and m.family_id = p_family_id and r.user_id = p_user_id;
  -- Removing membership must also prevent reuse of another outstanding invitation.
  delete from public.invitations i where i.family_id = p_family_id and i.accepted_at is null and (
    i.email = (select lower(email) from auth.users where id = p_user_id)
    or exists(select 1 from private.invitation_tokens t where t.invitation_id = i.id and t.invited_by = p_user_id)
  );
  delete from public.family_members where family_id = p_family_id and user_id = p_user_id;
end;
$$;
create function private.transfer_ownership(p_family_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_family public.families;
begin
  v_family := private.lock_family(p_family_id);
  if v_family.owner_id <> auth.uid() or p_user_id = auth.uid() or not private.is_member(p_family_id,p_user_id) then
    raise exception 'Only the owner can transfer to another current member.' using errcode = '42501';
  end if;
  update public.family_members set role = 'admin' where family_id = p_family_id and user_id = auth.uid();
  update public.family_members set role = 'owner' where family_id = p_family_id and user_id = p_user_id;
  update public.families set owner_id = p_user_id where id = p_family_id;
end;
$$;

create function private.save_memory(p_family_id uuid,p_title text,p_story text,p_occurred_on date,p_location text,
  p_visibility text,p_people text[],p_tags text[],p_recipients jsonb,p_memory_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_memory public.memories; v_id uuid; v_person text; v_person_id uuid;
  v_recipients jsonb; v_existing jsonb;
begin
  perform private.lock_family(p_family_id);
  if not exists (select 1 from public.family_members where family_id = p_family_id and user_id = v_user and role <> 'viewer') then
    raise exception 'Viewers cannot contribute.' using errcode = '42501'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 160 or p_story is null or length(p_story) > 20000
    or p_occurred_on is null or p_location is null or length(p_location) > 200 or p_visibility is null
    or p_visibility not in ('family','private','selected') or p_people is null or cardinality(p_people) > 50
    or exists(select 1 from unnest(p_people) n where n is null or length(trim(n)) not between 1 and 100)
    or p_tags is null or cardinality(p_tags) > 20
    or exists(select 1 from unnest(p_tags) t where t is null or length(trim(t)) not between 1 and 50)
    or p_recipients is null or jsonb_typeof(p_recipients) <> 'array' then
    raise exception 'Memory fields are invalid or too long.' using errcode = '22023'; end if;
  if jsonb_array_length(p_recipients) > 100 or exists (
    select 1 from jsonb_array_elements(p_recipients) r where jsonb_typeof(r) <> 'object'
      or jsonb_typeof(r->'user_id') is distinct from 'string' or jsonb_typeof(r->'can_edit') is distinct from 'boolean'
  ) then raise exception 'Recipients are invalid.' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',(r->>'user_id')::uuid,'can_edit',(r->>'can_edit')::boolean)
    order by (r->>'user_id')::uuid),'[]'::jsonb) into v_recipients from jsonb_array_elements(p_recipients) r;
  if (select count(*) <> count(distinct r->>'user_id') from jsonb_array_elements(v_recipients) r)
    or (p_visibility <> 'selected' and jsonb_array_length(v_recipients) <> 0)
    or (p_visibility = 'selected' and jsonb_array_length(v_recipients) = 0)
    or exists(select 1 from jsonb_array_elements(v_recipients) r where not private.is_member(p_family_id,(r->>'user_id')::uuid)
      or ((r->>'can_edit')::boolean and exists(select 1 from public.family_members fm where fm.family_id = p_family_id
        and fm.user_id = (r->>'user_id')::uuid and fm.role = 'viewer'))) then
    raise exception 'Select distinct current family members; viewers cannot edit.' using errcode = '22023'; end if;
  if p_memory_id is null then
    insert into public.memories(family_id,author_id,title,story,occurred_on,location,visibility,tags)
      values(p_family_id,v_user,trim(p_title),p_story,p_occurred_on,trim(p_location),p_visibility,
        array(select distinct trim(t) from unnest(p_tags) t)) returning id into v_id;
  else
    v_memory := private.lock_memory(p_memory_id);
    if v_memory.family_id <> p_family_id or v_memory.archived_at is not null then
      raise exception 'Memory is unavailable for editing.' using errcode = '42501'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('user_id',r.user_id,'can_edit',r.can_edit) order by r.user_id),'[]'::jsonb)
      into v_existing from public.memory_recipients r where r.memory_id = p_memory_id;
    if v_memory.author_id <> v_user and (v_memory.visibility <> p_visibility or v_existing <> v_recipients) then
      raise exception 'Only the author can change the audience.' using errcode = '42501'; end if;
    update public.memories set title = trim(p_title),story = p_story,occurred_on = p_occurred_on,
      location = trim(p_location),visibility = p_visibility,tags = array(select distinct trim(t) from unnest(p_tags) t),updated_at = now()
      where id = p_memory_id;
    v_id := p_memory_id;
  end if;
  if p_memory_id is null or v_memory.author_id = v_user then
    delete from public.memory_recipients where memory_id = v_id;
    insert into public.memory_recipients(memory_id,user_id,can_edit)
      select v_id,(r->>'user_id')::uuid,(r->>'can_edit')::boolean from jsonb_array_elements(v_recipients) r;
  end if;
  delete from public.memory_people where memory_id = v_id;
  for v_person in select distinct trim(n) from unnest(p_people) n loop
    insert into public.people(family_id,name) values(p_family_id,v_person)
      on conflict (family_id,name) do update set name = excluded.name returning id into v_person_id;
    insert into public.memory_people(memory_id,person_id) values(v_id,v_person_id);
  end loop;
  return v_id;
end;
$$;
create function private.archive_memory(p_memory_id uuid,p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_memory public.memories;
begin
  v_memory := private.lock_memory(p_memory_id);
  if v_memory.author_id <> auth.uid() or p_archived is null then raise exception 'Only the author can archive a memory.' using errcode = '42501'; end if;
  update public.memories set archived_at = case when p_archived then now() else null end,updated_at = now() where id = p_memory_id;
end;
$$;

create function private.reserve_photo(p_memory_id uuid,p_content_type text,p_byte_size bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_memory public.memories; v_photo public.photos; v_id uuid := gen_random_uuid(); v_ext text;
begin
  v_memory := private.lock_memory(p_memory_id);
  if v_memory.archived_at is not null or p_content_type is null or p_content_type not in ('image/jpeg','image/png','image/webp')
    or p_byte_size is null or p_byte_size not between 1 and 8388608 then
    raise exception 'Choose JPEG, PNG or WebP photos of at most 8 MiB for an active memory.' using errcode = '22023'; end if;
  if (select count(*) from public.photos where memory_id = p_memory_id) >= 20 then
    raise exception 'A memory supports at most 20 photos, including pending uploads. Remove a photo before adding another.' using errcode = '22023';
  end if;
  v_ext := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  insert into public.photos(id,memory_id,uploader_id,storage_path,content_type,byte_size)
    values(v_id,p_memory_id,auth.uid(),v_memory.family_id::text || '/' || p_memory_id::text || '/' || v_id::text || '.' || v_ext,p_content_type,p_byte_size)
    returning * into v_photo;
  return to_jsonb(v_photo);
end;
$$;
create function private.complete_photo(p_photo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_photo public.photos; v_metadata jsonb;
begin
  select * into v_photo from public.photos where id = p_photo_id;
  perform private.lock_memory(v_photo.memory_id);
  select * into v_photo from public.photos where id = p_photo_id for update;
  if not found or v_photo.uploader_id <> auth.uid() then raise exception 'Photo is unavailable.' using errcode = '42501'; end if;
  select metadata into v_metadata from storage.objects where bucket_id = 'memory-photos' and name = v_photo.storage_path;
  if not found or v_metadata->>'mimetype' is distinct from v_photo.content_type
    or v_metadata->>'size' is distinct from v_photo.byte_size::text then
    raise exception 'Upload is missing or does not match the reserved photo. Retry or remove it.' using errcode = '22023'; end if;
  update public.photos set state = 'ready' where id = p_photo_id;
end;
$$;
create function private.remove_photo(p_photo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_photo public.photos;
begin
  select * into v_photo from public.photos where id = p_photo_id;
  perform private.lock_memory(v_photo.memory_id);
  select * into v_photo from public.photos where id = p_photo_id for update;
  if not found then raise exception 'Photo is unavailable.' using errcode = '42501'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'memory-photos' and name = v_photo.storage_path) then
    raise exception 'Remove the Storage object successfully before removing its photo record.' using errcode = '22023'; end if;
  delete from public.photos where id = p_photo_id;
end;
$$;
create function private.photo_read_allowed(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.photos p where p.storage_path = p_path and private.can_read_memory(p.memory_id)
    and (p.state = 'ready' or p.uploader_id = auth.uid()));
$$;
create function private.photo_write_allowed(p_path text,p_metadata jsonb,p_operation text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_photo public.photos; v_memory public.memories;
begin
  select * into v_photo from public.photos where storage_path = p_path;
  if not found or auth.uid() is null then return false; end if;
  v_memory := private.lock_memory(v_photo.memory_id);
  select * into v_photo from public.photos where storage_path = p_path for update;
  if not found or v_memory.archived_at is not null then return false; end if;
  if p_operation = 'insert' then
    -- Storage's pre-upload permission probe may not yet have final object metadata.
    return v_photo.state = 'pending' and v_photo.uploader_id = auth.uid()
      and (p_metadata->>'mimetype' is null or p_metadata->>'mimetype' = v_photo.content_type)
      and (p_metadata->>'size' is null or p_metadata->>'size' = v_photo.byte_size::text);
  end if;
  return p_operation = 'delete';
end;
$$;

-- Guards are authenticated RPCs: deletion never trusts a user id from a request body.
create function private.begin_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(true);
begin
  perform 1 from public.families f where exists(select 1 from public.family_members fm
    where fm.family_id = f.id and fm.user_id = v_user)
    or exists(select 1 from public.memories m where m.family_id = f.id and m.author_id = v_user)
    or exists(select 1 from public.photos p join public.memories m on m.id = p.memory_id
      where m.family_id = f.id and p.uploader_id = v_user) order by f.id for update;
  if exists(select 1 from public.families where owner_id = v_user) then
    raise exception 'Transfer ownership or delete each owned family first.' using errcode = '42501'; end if;
  insert into private.account_deletions(user_id) values(v_user) on conflict do nothing;
end;
$$;
create function private.begin_family_deletion(p_family_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_owner uuid;
begin
  select owner_id into v_owner from public.families where id = p_family_id for update;
  if not found or v_owner <> v_user then raise exception 'Only the owner can delete this family.' using errcode = '42501'; end if;
  insert into private.family_deletions(family_id,actor_id) values(p_family_id,v_user) on conflict do nothing;
end;
$$;
create function private.deletion_photo_paths(p_family_id uuid default null,p_limit integer default 100)
returns table(storage_path text)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(true);
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid cleanup batch size.' using errcode = '22023'; end if;
  if p_family_id is null then
    if not exists(select 1 from private.account_deletions where user_id = v_user) then
      raise exception 'Begin account deletion first.' using errcode = '42501'; end if;
  elsif not exists(select 1 from private.family_deletions where family_id = p_family_id and actor_id = v_user) then
    raise exception 'Begin owned family deletion first.' using errcode = '42501';
  end if;
  return query select p.storage_path from public.photos p join public.memories m on m.id = p.memory_id
    where ((p_family_id is not null and m.family_id = p_family_id)
      or (p_family_id is null and (p.uploader_id = v_user or m.author_id = v_user)))
      and exists(select 1 from storage.objects o where o.bucket_id = 'memory-photos' and o.name = p.storage_path)
    order by p.storage_path limit p_limit;
end;
$$;
create function private.finish_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(true); v_people uuid[];
begin
  perform 1 from public.families f where exists(select 1 from public.family_members fm
    where fm.family_id = f.id and fm.user_id = v_user)
    or exists(select 1 from public.memories m where m.family_id = f.id and m.author_id = v_user)
    or exists(select 1 from public.photos p join public.memories m on m.id = p.memory_id
      where m.family_id = f.id and p.uploader_id = v_user) order by f.id for update;
  if not exists(select 1 from private.account_deletions where user_id = v_user)
    or exists(select 1 from public.families where owner_id = v_user) then
    raise exception 'Begin deletion after resolving family ownership.' using errcode = '42501'; end if;
  if exists(select 1 from private.deletion_photo_paths(null,1)) then
    raise exception 'Photo cleanup is incomplete. Retry deletion.' using errcode = '22023'; end if;
  select array_agg(distinct mp.person_id) into v_people from public.memory_people mp join public.memories m on m.id = mp.memory_id
    where m.author_id = v_user;
  delete from public.photos where uploader_id = v_user;
  delete from public.memories where author_id = v_user;
  delete from public.people p where p.id = any(v_people) and not exists(select 1 from public.memory_people mp where mp.person_id = p.id);
  delete from public.memory_recipients where user_id = v_user;
  delete from public.invitations i where i.email = (select lower(email) from auth.users where id = v_user)
    or exists(select 1 from private.invitation_tokens t where t.invitation_id = i.id and t.invited_by = v_user);
  delete from public.family_members where user_id = v_user;
  -- Keep the marker/profile until Auth Admin deletion succeeds, so retries remain authenticated.
end;
$$;
create function private.finish_family_deletion(p_family_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_owner uuid;
begin
  select owner_id into v_owner from public.families where id = p_family_id for update;
  if not found then return; end if;
  if v_owner <> v_user or not exists(select 1 from private.family_deletions where family_id = p_family_id and actor_id = v_user) then
    raise exception 'Begin owned family deletion first.' using errcode = '42501'; end if;
  if exists(select 1 from private.deletion_photo_paths(p_family_id,1)) then
    raise exception 'Photo cleanup is incomplete. Retry deletion.' using errcode = '22023'; end if;
  delete from public.families where id = p_family_id;
end;
$$;

-- Public API functions are invokers; only the implementations above are privileged.
create function public.create_family(p_name text,p_timezone text) returns uuid language sql security invoker set search_path = ''
  as $$ select private.create_family(p_name,p_timezone); $$;
create function public.create_invitation(p_family_id uuid,p_email text,p_role text) returns text language sql security invoker set search_path = ''
  as $$ select private.create_invitation(p_family_id,p_email,p_role); $$;
create function public.accept_invitation(p_token text) returns uuid language sql security invoker set search_path = ''
  as $$ select private.accept_invitation(p_token); $$;
create function public.set_member_role(p_family_id uuid,p_user_id uuid,p_role text) returns void language sql security invoker set search_path = ''
  as $$ select private.set_member_role(p_family_id,p_user_id,p_role); $$;
create function public.remove_member(p_family_id uuid,p_user_id uuid) returns void language sql security invoker set search_path = ''
  as $$ select private.remove_member(p_family_id,p_user_id); $$;
create function public.transfer_ownership(p_family_id uuid,p_user_id uuid) returns void language sql security invoker set search_path = ''
  as $$ select private.transfer_ownership(p_family_id,p_user_id); $$;
create function public.save_memory(p_family_id uuid,p_title text,p_story text,p_occurred_on date,p_location text,p_visibility text,
  p_people text[],p_tags text[],p_recipients jsonb,p_memory_id uuid default null) returns uuid language sql security invoker set search_path = ''
  as $$ select private.save_memory(p_family_id,p_title,p_story,p_occurred_on,p_location,p_visibility,p_people,p_tags,p_recipients,p_memory_id); $$;
create function public.archive_memory(p_memory_id uuid,p_archived boolean) returns void language sql security invoker set search_path = ''
  as $$ select private.archive_memory(p_memory_id,p_archived); $$;
create function public.reserve_photo(p_memory_id uuid,p_content_type text,p_byte_size bigint) returns jsonb language sql security invoker set search_path = ''
  as $$ select private.reserve_photo(p_memory_id,p_content_type,p_byte_size); $$;
create function public.complete_photo(p_photo_id uuid) returns void language sql security invoker set search_path = ''
  as $$ select private.complete_photo(p_photo_id); $$;
create function public.remove_photo(p_photo_id uuid) returns void language sql security invoker set search_path = ''
  as $$ select private.remove_photo(p_photo_id); $$;
create function public.begin_account_deletion() returns void language sql security invoker set search_path = '' as $$ select private.begin_account_deletion(); $$;
create function public.finish_account_deletion() returns void language sql security invoker set search_path = '' as $$ select private.finish_account_deletion(); $$;
create function public.begin_family_deletion(p_family_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.begin_family_deletion(p_family_id); $$;
create function public.finish_family_deletion(p_family_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.finish_family_deletion(p_family_id); $$;
create function public.deletion_photo_paths(p_family_id uuid default null,p_limit integer default 100) returns table(storage_path text)
  language sql security invoker set search_path = '' as $$ select * from private.deletion_photo_paths(p_family_id,p_limit); $$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitations enable row level security;
alter table public.memories enable row level security;
alter table public.people enable row level security;
alter table public.memory_people enable row level security;
alter table public.memory_recipients enable row level security;
alter table public.photos enable row level security;
alter table private.invitation_tokens enable row level security;
alter table private.account_deletions enable row level security;
alter table private.family_deletions enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (
  private.verified_user(auth.uid()) and (id = auth.uid() or (private.user_active(auth.uid()) and exists(select 1 from public.family_members fm
    where fm.user_id = profiles.id and private.is_member(fm.family_id,auth.uid()))))
);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid() and private.user_active(auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() and private.user_active(auth.uid()))
  with check (id = auth.uid() and private.user_active(auth.uid()));
create policy families_read on public.families for select to authenticated using (
  private.is_member(id,auth.uid()) or private.can_retry_family_deletion(id)
);
create policy members_read on public.family_members for select to authenticated using (
  private.is_member(family_id,auth.uid()) or (user_id = auth.uid() and private.can_retry_family_deletion(family_id))
);
create policy invitations_read on public.invitations for select to authenticated using (private.is_manager(family_id));
create policy memories_read on public.memories for select to authenticated using (private.can_read_memory(id));
create policy people_read on public.people for select to authenticated using (
  private.is_member(family_id,auth.uid()) and exists(select 1 from public.memory_people mp where mp.person_id = people.id and private.can_read_memory(mp.memory_id))
);
create policy memory_people_read on public.memory_people for select to authenticated using (private.can_read_memory(memory_id));
create policy recipients_read on public.memory_recipients for select to authenticated using (private.can_read_memory(memory_id));
create policy photos_read on public.photos for select to authenticated using (private.can_read_memory(memory_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('memory-photos','memory-photos',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy welyto_photo_read on storage.objects for select to authenticated using (
  bucket_id = 'memory-photos' and private.photo_read_allowed(name)
  and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info',
    'object.info_authenticated','object.delete','object.delete_many'])
);
create policy welyto_photo_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'memory-photos' and storage.allow_only_operation('object.upload') and private.photo_write_allowed(name,metadata,'insert')
);
create policy welyto_photo_delete on storage.objects for delete to authenticated using (
  bucket_id = 'memory-photos' and storage.allow_any_operation(array['object.delete','object.delete_many'])
  and private.photo_write_allowed(name,metadata,'delete')
);
-- No UPDATE/upsert/copy/move/signing policy; only exact reserved object paths qualify.

revoke all on all tables in schema private from public,anon,authenticated;
revoke all on public.profiles,public.families,public.family_members,public.invitations,public.memories,public.people,
  public.memory_people,public.memory_recipients,public.photos from public,anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles,public.families,public.family_members,public.invitations,public.memories,public.people,
  public.memory_people,public.memory_recipients,public.photos to authenticated;
grant insert(id,display_name),update(display_name) on public.profiles to authenticated;
grant select,insert,delete on storage.objects to authenticated;
grant all on public.profiles,public.families,public.family_members,public.invitations,public.memories,public.people,
  public.memory_people,public.memory_recipients,public.photos to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on function public.create_family(text,text),public.create_invitation(uuid,text,text),public.accept_invitation(text),
  public.set_member_role(uuid,uuid,text),public.remove_member(uuid,uuid),public.transfer_ownership(uuid,uuid),
  public.save_memory(uuid,text,text,date,text,text,text[],text[],jsonb,uuid),public.archive_memory(uuid,boolean),
  public.reserve_photo(uuid,text,bigint),public.complete_photo(uuid),public.remove_photo(uuid),public.begin_account_deletion(),
  public.finish_account_deletion(),public.begin_family_deletion(uuid),public.finish_family_deletion(uuid),public.deletion_photo_paths(uuid,integer)
  from public,anon;
grant execute on function public.create_family(text,text),public.create_invitation(uuid,text,text),public.accept_invitation(text),
  public.set_member_role(uuid,uuid,text),public.remove_member(uuid,uuid),public.transfer_ownership(uuid,uuid),
  public.save_memory(uuid,text,text,date,text,text,text[],text[],jsonb,uuid),public.archive_memory(uuid,boolean),
  public.reserve_photo(uuid,text,bigint),public.complete_photo(uuid),public.remove_photo(uuid),public.begin_account_deletion(),
  public.finish_account_deletion(),public.begin_family_deletion(uuid),public.finish_family_deletion(uuid),public.deletion_photo_paths(uuid,integer)
  to authenticated;
grant execute on function private.verified_user(uuid),private.user_active(uuid),private.can_retry_family_deletion(uuid),
  private.is_member(uuid,uuid),private.is_manager(uuid),private.can_read_memory(uuid),
  private.photo_read_allowed(text),private.photo_write_allowed(text,jsonb,text),
  private.create_family(text,text),private.create_invitation(uuid,text,text),private.accept_invitation(text),
  private.set_member_role(uuid,uuid,text),private.remove_member(uuid,uuid),private.transfer_ownership(uuid,uuid),
  private.save_memory(uuid,text,text,date,text,text,text[],text[],jsonb,uuid),private.archive_memory(uuid,boolean),
  private.reserve_photo(uuid,text,bigint),private.complete_photo(uuid),private.remove_photo(uuid),private.begin_account_deletion(),
  private.finish_account_deletion(),private.begin_family_deletion(uuid),private.finish_family_deletion(uuid),private.deletion_photo_paths(uuid,integer)
  to authenticated;
commit;
