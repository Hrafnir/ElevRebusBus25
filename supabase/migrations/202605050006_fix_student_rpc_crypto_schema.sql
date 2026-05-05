create or replace function public.student_login(student_username text, student_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.participant_sessions (student_id, token_hash)
  values (matched_student.id, encode(extensions.digest(raw_token, 'sha256'), 'hex'));

  return public.student_session_payload(matched_student.id, raw_token);
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

create or replace function public.student_record_location(raw_token text, latitude_value double precision, longitude_value double precision, accuracy_value double precision default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  inserted_location public.locations%rowtype;
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
set search_path = public, extensions
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
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
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
