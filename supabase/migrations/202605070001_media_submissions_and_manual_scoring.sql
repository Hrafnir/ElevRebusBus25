insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/ogg'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "submissions_bucket_student_upload" on storage.objects;
create policy "submissions_bucket_student_upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'submissions');

drop policy if exists "submissions_bucket_admin_read" on storage.objects;
create policy "submissions_bucket_admin_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1
    from public.submissions s
    where s.storage_bucket = storage.objects.bucket_id
      and s.storage_path = storage.objects.name
      and public.can_access_rebus(s.rebus_id)
  )
);

drop policy if exists "progress_manage_access" on public.progress;
create policy "progress_manage_access"
on public.progress for update
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

create or replace function public.student_record_submission(
  raw_token text,
  target_task_id uuid,
  storage_path_value text,
  original_name_value text,
  content_type_value text,
  size_bytes_value bigint,
  note_value text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_session public.participant_sessions%rowtype;
  matched_student public.students%rowtype;
  matched_task public.tasks%rowtype;
  inserted_submission public.submissions%rowtype;
  inserted_progress public.progress%rowtype;
  submitted_answer text;
begin
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
    and t.rebus_id = matched_student.rebus_id
    and t.type in ('photo', 'video', 'audio', 'teacher_approved');

  if matched_task.id is null then
    return null;
  end if;

  insert into public.submissions (
    student_id,
    rebus_id,
    task_id,
    type,
    storage_bucket,
    storage_path,
    original_name,
    content_type,
    size_bytes,
    note,
    status
  )
  values (
    matched_student.id,
    matched_student.rebus_id,
    matched_task.id,
    matched_task.type,
    'submissions',
    storage_path_value,
    original_name_value,
    content_type_value,
    size_bytes_value,
    coalesce(note_value, ''),
    'submitted'::public.progress_status
  )
  returning * into inserted_submission;

  submitted_answer := '[MEDIA_LEVERT] ' || coalesce(original_name_value, 'Innlevering');
  if length(trim(coalesce(note_value, ''))) > 0 then
    submitted_answer := submitted_answer || ' - ' || trim(note_value);
  end if;

  insert into public.progress (student_id, rebus_id, task_id, answer, status, correct, points_awarded)
  values (
    matched_student.id,
    matched_student.rebus_id,
    matched_task.id,
    submitted_answer,
    'submitted'::public.progress_status,
    null,
    0
  )
  returning * into inserted_progress;

  update public.participant_sessions
  set last_seen_at = now()
  where id = matched_session.id;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'id', inserted_submission.id,
      'studentId', inserted_submission.student_id,
      'rebusId', inserted_submission.rebus_id,
      'taskId', inserted_submission.task_id,
      'type', inserted_submission.type,
      'storageBucket', inserted_submission.storage_bucket,
      'storagePath', inserted_submission.storage_path,
      'originalName', inserted_submission.original_name,
      'contentType', inserted_submission.content_type,
      'sizeBytes', inserted_submission.size_bytes,
      'note', inserted_submission.note,
      'status', inserted_submission.status,
      'createdAt', inserted_submission.created_at
    ),
    'progress', jsonb_build_object(
      'id', inserted_progress.id,
      'studentId', inserted_progress.student_id,
      'rebusId', inserted_progress.rebus_id,
      'taskId', inserted_progress.task_id,
      'answer', inserted_progress.answer,
      'status', inserted_progress.status,
      'correct', inserted_progress.correct,
      'pointsAwarded', inserted_progress.points_awarded,
      'createdAt', inserted_progress.created_at
    )
  );
end;
$$;

grant execute on function public.student_record_submission(text, uuid, text, text, text, bigint, text) to anon, authenticated;
