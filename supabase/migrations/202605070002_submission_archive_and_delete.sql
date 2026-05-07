drop policy if exists "submissions_bucket_admin_delete" on storage.objects;
create policy "submissions_bucket_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1
    from public.submissions s
    where s.storage_bucket = storage.objects.bucket_id
      and s.storage_path = storage.objects.name
      and public.can_manage_rebus(s.rebus_id)
  )
);

drop policy if exists "submissions_delete_access" on public.submissions;
create policy "submissions_delete_access"
on public.submissions for delete
to authenticated
using (public.can_manage_rebus(rebus_id));
