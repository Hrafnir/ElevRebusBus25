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
  );
$$;
