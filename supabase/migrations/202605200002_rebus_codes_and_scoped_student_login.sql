alter table public.rebuses
  add column if not exists rebus_code text;

alter table public.rebus_admins
  add column if not exists role public.organization_role not null default 'admin';

alter table public.rebus_invitations
  add column if not exists role public.organization_role not null default 'admin';

with generated_codes as (
  select
    r.id,
    left(upper(regexp_replace(
      regexp_replace(coalesce(o.name, 'ORG'), '[^[:alnum:]]+', '-', 'g') || '-' ||
      regexp_replace(coalesce(r.title, 'REBUS'), '[^[:alnum:]]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    )), 24) as base_code
  from public.rebuses r
  join public.organizations o on o.id = r.organization_id
  where r.rebus_code is null or length(trim(r.rebus_code)) = 0
),
numbered_codes as (
  select
    id,
    base_code,
    row_number() over (partition by base_code order by id) as duplicate_number
  from generated_codes
)
update public.rebuses r
set rebus_code = case
  when nc.duplicate_number = 1 then nc.base_code
  else left(nc.base_code, 20) || '-' || nc.duplicate_number
end
from numbered_codes nc
where nc.id = r.id;

update public.rebuses
set rebus_code = left(upper(regexp_replace(rebus_code, '[^[:alnum:]]+', '-', 'g')), 32)
where rebus_code is not null;

alter table public.rebuses
  alter column rebus_code set not null;

create unique index if not exists idx_rebuses_org_rebus_code
on public.rebuses (organization_id, upper(rebus_code));

create or replace function public.student_public_organizations()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
  from public.organizations o
  where exists (
    select 1
    from public.rebuses r
    where r.organization_id = o.id
      and r.status = 'published'::public.rebus_status
  );
$$;

create or replace function public.can_manage_rebus(target_rebus_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_org_role(public.rebus_org_id(target_rebus_id), array['owner','admin','teacher']::public.organization_role[])
    or exists (
      select 1
      from public.rebus_admins ra
      where ra.rebus_id = target_rebus_id
        and ra.user_id = auth.uid()
        and ra.role in ('admin', 'teacher')
    );
$$;

create or replace function public.accept_my_invitations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  org_count integer := 0;
  rebus_count integer := 0;
begin
  select * into profile_row from public.profiles where id = auth.uid();
  if profile_row.id is null then
    return jsonb_build_object('organizationInvites', 0, 'rebusInvites', 0);
  end if;

  insert into public.organization_members (organization_id, user_id, role, invited_by)
  select oi.organization_id, profile_row.id, oi.role, oi.invited_by
  from public.organization_invitations oi
  where lower(oi.email) = lower(profile_row.email)
    and oi.accepted_at is null
  on conflict (organization_id, user_id) do update set role = excluded.role;
  get diagnostics org_count = row_count;

  update public.organization_invitations
  set accepted_at = now()
  where lower(email) = lower(profile_row.email)
    and accepted_at is null;

  insert into public.rebus_admins (rebus_id, user_id, invited_by, role)
  select ri.rebus_id, profile_row.id, ri.invited_by, ri.role
  from public.rebus_invitations ri
  where lower(ri.email) = lower(profile_row.email)
    and ri.accepted_at is null
  on conflict (rebus_id, user_id) do update set role = excluded.role;
  get diagnostics rebus_count = row_count;

  update public.rebus_invitations
  set accepted_at = now()
  where lower(email) = lower(profile_row.email)
    and accepted_at is null;

  return jsonb_build_object('organizationInvites', org_count, 'rebusInvites', rebus_count);
end;
$$;

create or replace function public.student_session_payload(target_student_id uuid, raw_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with student_row as (
    select s.id, s.rebus_id, s.display_name, s.username, s.team_name,
           r.id as rebus_id_value,
           r.title as rebus_title,
           r.description as rebus_description,
           r.status as rebus_status,
           r.rebus_code,
           r.show_live_score as rebus_show_live_score,
           o.id as organization_id,
           o.name as organization_name,
           ps.google_maps_api_key as organization_google_maps_api_key
    from public.students s
    join public.rebuses r on r.id = s.rebus_id
    join public.organizations o on o.id = r.organization_id
    left join public.project_settings ps on ps.organization_id = r.organization_id
    where s.id = target_student_id
      and r.status = 'published'::public.rebus_status
  ),
  task_rows as (
    select t.*
    from public.tasks t
    join student_row sr on sr.rebus_id = t.rebus_id
    where not exists (
      select 1
      from public.student_task_overrides sto
      where sto.student_id = sr.id
        and sto.task_id = t.id
        and sto.is_skipped = true
    )
  ),
  progress_rows as (
    select p.*
    from public.progress p
    join student_row sr on sr.id = p.student_id
    order by p.created_at asc
  )
  select jsonb_build_object(
    'token', raw_token,
    'student', jsonb_build_object(
      'id', sr.id,
      'displayName', sr.display_name,
      'username', sr.username,
      'rebusId', sr.rebus_id,
      'teamName', sr.team_name
    ),
    'rebus', jsonb_build_object(
      'id', sr.rebus_id_value,
      'title', sr.rebus_title,
      'description', sr.rebus_description,
      'status', sr.rebus_status,
      'rebusCode', sr.rebus_code,
      'showLiveScore', sr.rebus_show_live_score,
      'googleMapsApiKey', coalesce(sr.organization_google_maps_api_key, ''),
      'organization', jsonb_build_object('id', sr.organization_id, 'name', sr.organization_name)
    ),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'rebusId', t.rebus_id,
        'stopId', t.stop_id,
        'title', t.title,
        'description', t.description,
        'type', t.type,
        'prompt', t.prompt,
        'points', t.points,
        'order', t.sort_order,
        'maxAttempts', t.max_attempts,
        'geofenceRadiusMeters', t.geofence_radius_meters,
        'config', coalesce(t.config, '{}'::jsonb),
        'location', case
          when t.latitude is not null and t.longitude is not null then jsonb_build_object('lat', t.latitude, 'lng', t.longitude, 'label', coalesce(t.location_label, ''))
          else null
        end,
        'stop', case
          when rs.id is not null then jsonb_build_object(
            'id', rs.id,
            'title', rs.title,
            'location', case
              when rs.latitude is not null and rs.longitude is not null then jsonb_build_object('lat', rs.latitude, 'lng', rs.longitude, 'label', coalesce(rs.location_label, ''))
              else null
            end
          )
          else null
        end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.sort_order)
          from public.task_options o
          where o.task_id = t.id
        ), '[]'::jsonb),
        'assets', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'title', a.title, 'url', a.url) order by a.sort_order)
          from public.task_assets a
          where a.task_id = t.id
        ), '[]'::jsonb),
        'hints', coalesce((
          select jsonb_agg(jsonb_build_object('id', h.id, 'body', h.body) order by h.sort_order)
          from public.task_hints h
          where h.task_id = t.id
        ), '[]'::jsonb)
      ) order by t.sort_order)
      from task_rows t
      left join public.rebus_stops rs on rs.id = t.stop_id
    ), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'studentId', p.student_id,
        'rebusId', p.rebus_id,
        'taskId', p.task_id,
        'answer', p.answer,
        'status', p.status,
        'correct', p.correct,
        'pointsAwarded', p.points_awarded,
        'createdAt', p.created_at
      ) order by p.created_at)
      from progress_rows p
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gm.id,
        'studentId', gm.student_id,
        'senderType', gm.sender_type,
        'senderLabel', coalesce(gm.sender_label, case when gm.sender_type = 'admin' then 'Lærer' else 'Gruppe' end),
        'body', gm.body,
        'readByStudentAt', gm.read_by_student_at,
        'readByAdminAt', gm.read_by_admin_at,
        'createdAt', gm.created_at
      ) order by gm.created_at)
      from public.group_messages gm
      where gm.student_id = sr.id
    ), '[]'::jsonb),
    'scoreAdjustments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gsa.id,
        'studentId', gsa.student_id,
        'points', gsa.points,
        'reason', gsa.reason,
        'createdAt', gsa.created_at
      ) order by gsa.created_at)
      from public.group_score_adjustments gsa
      where gsa.student_id = sr.id
    ), '[]'::jsonb),
    'submissions', '[]'::jsonb
  )
  from student_row sr;
$$;

create or replace function public.student_login(
  target_organization_id uuid,
  rebus_code_value text,
  student_username text,
  student_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_student public.students%rowtype;
  raw_token text;
begin
  select s.*
  into matched_student
  from public.students s
  join public.rebuses r on r.id = s.rebus_id
  where r.organization_id = target_organization_id
    and upper(r.rebus_code) = upper(trim(rebus_code_value))
    and r.status = 'published'::public.rebus_status
    and s.username = lower(trim(student_username))
    and s.password_hash = 'plain:' || student_password
  limit 1;

  if matched_student.id is null then
    return null;
  end if;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.participant_sessions (student_id, token_hash)
  values (matched_student.id, encode(extensions.digest(raw_token, 'sha256'), 'hex'));

  return public.student_session_payload(matched_student.id, raw_token);
end;
$$;

create or replace function public.student_login(student_username text, student_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return null;
end;
$$;

create or replace function public.student_get_session(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
begin
  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  order by created_at desc
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  update public.participant_sessions
  set last_seen_at = now()
  where id = matched_session.id;

  return public.student_session_payload(matched_session.student_id, raw_token);
end;
$$;

grant execute on function public.student_public_organizations() to anon, authenticated;
grant execute on function public.student_login(uuid, text, text, text) to anon, authenticated;
