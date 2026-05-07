create or replace function public.student_session_payload(target_student_id uuid, raw_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with student_row as (
    select s.id, s.rebus_id, s.display_name, s.username, s.team_name,
           r.id as rebus_id_value, r.title as rebus_title, r.description as rebus_description, r.status as rebus_status, r.show_live_score as rebus_show_live_score
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
      'status', sr.rebus_status,
      'showLiveScore', sr.rebus_show_live_score
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
