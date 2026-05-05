do $$
begin
  create type public.message_sender_type as enum ('admin', 'student');
exception when duplicate_object then null;
end $$;

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  sender_type public.message_sender_type not null,
  body text not null,
  read_by_admin_at timestamptz,
  read_by_student_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_task_overrides (
  student_id uuid not null references public.students(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  is_skipped boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (student_id, task_id)
);

create index if not exists idx_group_messages_student_created on public.group_messages(student_id, created_at desc);
create index if not exists idx_group_messages_rebus_created on public.group_messages(rebus_id, created_at desc);
create index if not exists idx_student_task_overrides_student on public.student_task_overrides(student_id, task_id);

drop trigger if exists student_task_overrides_set_updated_at on public.student_task_overrides;
create trigger student_task_overrides_set_updated_at
before update on public.student_task_overrides
for each row execute function public.set_updated_at();

alter table public.group_messages enable row level security;
alter table public.student_task_overrides enable row level security;

drop policy if exists "group_messages_select_members" on public.group_messages;
create policy "group_messages_select_members"
on public.group_messages for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

drop policy if exists "group_messages_manage_teachers" on public.group_messages;
create policy "group_messages_manage_teachers"
on public.group_messages for all
to authenticated
using (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]));

drop policy if exists "student_task_overrides_select_members" on public.student_task_overrides;
create policy "student_task_overrides_select_members"
on public.student_task_overrides for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

drop policy if exists "student_task_overrides_manage_teachers" on public.student_task_overrides;
create policy "student_task_overrides_manage_teachers"
on public.student_task_overrides for all
to authenticated
using (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]));

create or replace function public.student_session_payload(target_student_id uuid, raw_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with student_row as (
    select s.id, s.rebus_id, s.display_name, s.username, s.team_name,
           r.id as rebus_id_value, r.title as rebus_title, r.description as rebus_description, r.status as rebus_status
    from public.students s
    join public.rebuses r on r.id = s.rebus_id
    where s.id = target_student_id
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
      'status', sr.rebus_status
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
        'body', gm.body,
        'readByStudentAt', gm.read_by_student_at,
        'readByAdminAt', gm.read_by_admin_at,
        'createdAt', gm.created_at
      ) order by gm.created_at)
      from public.group_messages gm
      where gm.student_id = sr.id
    ), '[]'::jsonb),
    'submissions', '[]'::jsonb
  )
  from student_row sr;
$$;

create or replace function public.student_send_message(raw_token text, message_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  inserted_message public.group_messages%rowtype;
begin
  if length(trim(coalesce(message_body, ''))) = 0 then
    raise exception 'Meldingen er tom.';
  end if;

  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  order by created_at desc
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  select * into matched_student from public.students where id = matched_session.student_id;

  insert into public.group_messages (student_id, rebus_id, sender_type, body, read_by_student_at)
  values (matched_student.id, matched_student.rebus_id, 'student', trim(message_body), now())
  returning * into inserted_message;

  update public.participant_sessions
  set last_seen_at = now()
  where id = matched_session.id;

  return to_jsonb(inserted_message);
end;
$$;

create or replace function public.student_mark_messages_read(raw_token text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
  changed_count integer;
begin
  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  order by created_at desc
  limit 1;

  if matched_session.id is null then
    return 0;
  end if;

  update public.group_messages
  set read_by_student_at = coalesce(read_by_student_at, now())
  where student_id = matched_session.student_id
    and sender_type = 'admin'
    and read_by_student_at is null;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

grant execute on function public.student_send_message(text, text) to anon, authenticated;
grant execute on function public.student_mark_messages_read(text) to anon, authenticated;
