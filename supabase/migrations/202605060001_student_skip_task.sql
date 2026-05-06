create or replace function public.student_skip_task(raw_token text, target_task_id uuid, confirmation_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  matched_task public.tasks%rowtype;
  inserted_progress public.progress%rowtype;
begin
  if lower(trim(coalesce(confirmation_text, ''))) <> 'hopp' then
    raise exception 'Skriv HOPP for å gi opp oppgaven.';
  end if;

  select *
  into matched_session
  from public.participant_sessions ps
  where ps.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  order by ps.created_at desc
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  select * into matched_student
  from public.students s
  where s.id = matched_session.student_id;

  select * into matched_task
  from public.tasks t
  where t.id = target_task_id
    and t.rebus_id = matched_student.rebus_id;

  if matched_task.id is null then
    return null;
  end if;

  insert into public.progress (student_id, rebus_id, task_id, answer, status, correct, points_awarded)
  values (
    matched_student.id,
    matched_student.rebus_id,
    matched_task.id,
    '[GITT_OPP] Laget ga opp oppgaven.',
    'submitted'::public.progress_status,
    null,
    0
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
    'skipped', true,
    'createdAt', inserted_progress.created_at
  );
end;
$$;

grant execute on function public.student_skip_task(text, uuid, text) to anon, authenticated;
