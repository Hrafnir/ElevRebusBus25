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
    'submissions', '[]'::jsonb
  )
  from student_row sr;
$$;

create or replace function public.student_login(student_username text, student_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student public.students%rowtype;
  raw_token text;
begin
  select *
  into matched_student
  from public.students
  where username = lower(trim(student_username))
    and password_hash = 'plain:' || student_password
  order by created_at desc
  limit 1;

  if matched_student.id is null then
    return null;
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');

  insert into public.participant_sessions (student_id, token_hash)
  values (matched_student.id, encode(digest(raw_token, 'sha256'), 'hex'));

  return public.student_session_payload(matched_student.id, raw_token);
end;
$$;

create or replace function public.student_get_session(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.participant_sessions%rowtype;
begin
  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
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

create or replace function public.student_record_location(raw_token text, latitude_value double precision, longitude_value double precision, accuracy_value double precision default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  inserted_location public.locations%rowtype;
begin
  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
  order by created_at desc
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  select * into matched_student from public.students where id = matched_session.student_id;

  insert into public.locations (student_id, rebus_id, latitude, longitude, accuracy)
  values (matched_student.id, matched_student.rebus_id, latitude_value, longitude_value, accuracy_value)
  returning * into inserted_location;

  update public.participant_sessions
  set last_seen_at = now()
  where id = matched_session.id;

  return to_jsonb(inserted_location);
end;
$$;

create or replace function public.student_record_progress(raw_token text, target_task_id uuid, answer_text text default '', selected_option_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  matched_task public.tasks%rowtype;
  correct_ids uuid[];
  sorted_selected_ids uuid[];
  is_correct boolean;
  awarded_points integer := 0;
  submitted_answer text := coalesce(answer_text, '');
  number_rules jsonb;
  numeric_answer double precision;
  correct_value double precision;
  deviation double precision;
  band jsonb;
  inserted_progress public.progress%rowtype;
begin
  select *
  into matched_session
  from public.participant_sessions
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
  order by created_at desc
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  select * into matched_student from public.students where id = matched_session.student_id;
  select * into matched_task from public.tasks where id = target_task_id and rebus_id = matched_student.rebus_id;

  if matched_task.id is null then
    return null;
  end if;

  if matched_task.type in ('multiple_choice', 'multi_select') then
    select coalesce(array_agg(id order by id), '{}') into correct_ids
    from public.task_options
    where task_id = matched_task.id and is_correct = true;

    select coalesce(array_agg(option_id order by option_id), '{}') into sorted_selected_ids
    from unnest(selected_option_ids) as option_id;

    is_correct := correct_ids = sorted_selected_ids;
    awarded_points := case when is_correct then matched_task.points else 0 end;
    submitted_answer := array_to_string(sorted_selected_ids, ',');
  elsif matched_task.type = 'number' and matched_task.config ? 'numberRules' then
    number_rules := matched_task.config -> 'numberRules';
    begin
      numeric_answer := submitted_answer::double precision;
      correct_value := (number_rules ->> 'correctValue')::double precision;
      deviation := abs(numeric_answer - correct_value);
      is_correct := deviation = 0;
      awarded_points := 0;

      for band in
        select value
        from jsonb_array_elements(coalesce(number_rules -> 'bands', '[]'::jsonb)) value
        order by (value ->> 'maxDeviation')::double precision asc
      loop
        if deviation <= (band ->> 'maxDeviation')::double precision then
          awarded_points := (band ->> 'points')::integer;
          exit;
        end if;
      end loop;
    exception when others then
      is_correct := false;
      awarded_points := 0;
    end;
  elsif matched_task.answer is not null and length(trim(matched_task.answer)) > 0 then
    is_correct := lower(trim(submitted_answer)) = lower(trim(matched_task.answer));
    awarded_points := case when is_correct then matched_task.points else 0 end;
  else
    is_correct := null;
    awarded_points := 0;
  end if;

  insert into public.progress (student_id, rebus_id, task_id, answer, status, correct, points_awarded)
  values (
    matched_student.id,
    matched_student.rebus_id,
    matched_task.id,
    submitted_answer,
    case when is_correct = false then 'needs_retry'::public.progress_status else 'submitted'::public.progress_status end,
    is_correct,
    awarded_points
  )
  returning * into inserted_progress;

  update public.participant_sessions
  set last_seen_at = now()
  where id = matched_session.id;

  return jsonb_build_object(
    'id', inserted_progress.id,
    'studentId', inserted_progress.student_id,
    'rebusId', inserted_progress.rebus_id,
    'taskId', inserted_progress.task_id,
    'answer', inserted_progress.answer,
    'status', inserted_progress.status,
    'correct', inserted_progress.correct,
    'pointsAwarded', inserted_progress.points_awarded,
    'createdAt', inserted_progress.created_at
  );
end;
$$;

grant execute on function public.student_login(text, text) to anon, authenticated;
grant execute on function public.student_get_session(text) to anon, authenticated;
grant execute on function public.student_record_location(text, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.student_record_progress(text, uuid, text, uuid[]) to anon, authenticated;
