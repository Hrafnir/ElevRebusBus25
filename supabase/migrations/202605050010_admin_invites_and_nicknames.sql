alter table public.profiles
  add column if not exists nickname text;

alter table public.group_messages
  add column if not exists sender_admin_id uuid references public.profiles(id),
  add column if not exists sender_label text;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_role not null default 'teacher',
  invited_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists public.rebus_admins (
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (rebus_id, user_id)
);

create table if not exists public.rebus_invitations (
  id uuid primary key default gen_random_uuid(),
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (rebus_id, email)
);

create index if not exists idx_organization_invitations_email on public.organization_invitations(lower(email));
create index if not exists idx_rebus_invitations_email on public.rebus_invitations(lower(email));
create index if not exists idx_rebus_admins_user on public.rebus_admins(user_id);

alter table public.organization_invitations enable row level security;
alter table public.rebus_admins enable row level security;
alter table public.rebus_invitations enable row level security;

create or replace function public.is_rebus_admin(target_rebus_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.rebus_admins ra
    where ra.rebus_id = target_rebus_id
      and ra.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_rebus(target_rebus_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_org_member(public.rebus_org_id(target_rebus_id))
    or public.is_rebus_admin(target_rebus_id);
$$;

create or replace function public.can_manage_rebus(target_rebus_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_org_role(public.rebus_org_id(target_rebus_id), array['owner','admin','teacher']::public.organization_role[])
    or public.is_rebus_admin(target_rebus_id);
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

  insert into public.rebus_admins (rebus_id, user_id, invited_by)
  select ri.rebus_id, profile_row.id, ri.invited_by
  from public.rebus_invitations ri
  where lower(ri.email) = lower(profile_row.email)
    and ri.accepted_at is null
  on conflict (rebus_id, user_id) do nothing;
  get diagnostics rebus_count = row_count;

  update public.rebus_invitations
  set accepted_at = now()
  where lower(email) = lower(profile_row.email)
    and accepted_at is null;

  return jsonb_build_object('organizationInvites', org_count, 'rebusInvites', rebus_count);
end;
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (select 1 from public.organization_members om where om.user_id = profiles.id and public.is_org_member(om.organization_id))
  or exists (select 1 from public.rebus_admins ra where ra.user_id = profiles.id and public.can_access_rebus(ra.rebus_id))
);

drop policy if exists "organization_invitations_select_admins" on public.organization_invitations;
create policy "organization_invitations_select_admins"
on public.organization_invitations for select
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

drop policy if exists "organization_invitations_insert_admins" on public.organization_invitations;
create policy "organization_invitations_insert_admins"
on public.organization_invitations for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);

drop policy if exists "organization_invitations_update_admins" on public.organization_invitations;
create policy "organization_invitations_update_admins"
on public.organization_invitations for update
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

drop policy if exists "rebus_admins_select_access" on public.rebus_admins;
create policy "rebus_admins_select_access"
on public.rebus_admins for select
to authenticated
using (public.can_access_rebus(rebus_id));

drop policy if exists "rebus_admins_manage" on public.rebus_admins;
create policy "rebus_admins_manage"
on public.rebus_admins for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "rebus_invitations_select_access" on public.rebus_invitations;
create policy "rebus_invitations_select_access"
on public.rebus_invitations for select
to authenticated
using (public.can_manage_rebus(rebus_id));

drop policy if exists "rebus_invitations_insert_access" on public.rebus_invitations;
create policy "rebus_invitations_insert_access"
on public.rebus_invitations for insert
to authenticated
with check (invited_by = auth.uid() and public.can_manage_rebus(rebus_id));

drop policy if exists "rebus_invitations_update_access" on public.rebus_invitations;
create policy "rebus_invitations_update_access"
on public.rebus_invitations for update
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "organizations_select_members" on public.organizations;
create policy "organizations_select_members"
on public.organizations for select
to authenticated
using (
  public.is_org_member(id)
  or exists (
    select 1
    from public.rebuses r
    where r.organization_id = organizations.id
      and public.is_rebus_admin(r.id)
  )
);

drop policy if exists "project_settings_select_members" on public.project_settings;
create policy "project_settings_select_members"
on public.project_settings for select
to authenticated
using (
  public.is_org_member(organization_id)
  or exists (
    select 1
    from public.rebuses r
    where r.organization_id = project_settings.organization_id
      and public.is_rebus_admin(r.id)
  )
);

drop policy if exists "rebuses_select_members" on public.rebuses;
drop policy if exists "rebuses_manage_teachers" on public.rebuses;
create policy "rebuses_select_access"
on public.rebuses for select
to authenticated
using (public.can_access_rebus(id));

create policy "rebuses_insert_org_teachers"
on public.rebuses for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','teacher']::public.organization_role[]));

create policy "rebuses_update_managers"
on public.rebuses for update
to authenticated
using (public.can_manage_rebus(id))
with check (public.can_manage_rebus(id));

create policy "rebuses_delete_org_teachers"
on public.rebuses for delete
to authenticated
using (public.has_org_role(organization_id, array['owner','admin','teacher']::public.organization_role[]));

drop policy if exists "tasks_select_members" on public.tasks;
drop policy if exists "tasks_manage_teachers" on public.tasks;
create policy "tasks_select_access"
on public.tasks for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "tasks_manage_access"
on public.tasks for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "students_select_members" on public.students;
drop policy if exists "students_manage_teachers" on public.students;
create policy "students_select_access"
on public.students for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "students_manage_access"
on public.students for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "participant_sessions_select_members" on public.participant_sessions;
create policy "participant_sessions_select_access"
on public.participant_sessions for select
to authenticated
using (exists (select 1 from public.students s where s.id = participant_sessions.student_id and public.can_access_rebus(s.rebus_id)));

drop policy if exists "progress_select_members" on public.progress;
create policy "progress_select_access"
on public.progress for select
to authenticated
using (public.can_access_rebus(rebus_id));

drop policy if exists "locations_select_members" on public.locations;
create policy "locations_select_access"
on public.locations for select
to authenticated
using (public.can_access_rebus(rebus_id));

drop policy if exists "submissions_select_members" on public.submissions;
create policy "submissions_select_access"
on public.submissions for select
to authenticated
using (public.can_access_rebus(rebus_id));

drop policy if exists "rebus_stops_select_members" on public.rebus_stops;
drop policy if exists "rebus_stops_manage_teachers" on public.rebus_stops;
create policy "rebus_stops_select_access"
on public.rebus_stops for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "rebus_stops_manage_access"
on public.rebus_stops for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "task_assets_select_members" on public.task_assets;
drop policy if exists "task_assets_manage_teachers" on public.task_assets;
create policy "task_assets_select_access"
on public.task_assets for select
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_assets.task_id and public.can_access_rebus(t.rebus_id)));
create policy "task_assets_manage_access"
on public.task_assets for all
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_assets.task_id and public.can_manage_rebus(t.rebus_id)))
with check (exists (select 1 from public.tasks t where t.id = task_assets.task_id and public.can_manage_rebus(t.rebus_id)));

drop policy if exists "task_options_select_members" on public.task_options;
drop policy if exists "task_options_manage_teachers" on public.task_options;
create policy "task_options_select_access"
on public.task_options for select
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_options.task_id and public.can_access_rebus(t.rebus_id)));
create policy "task_options_manage_access"
on public.task_options for all
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_options.task_id and public.can_manage_rebus(t.rebus_id)))
with check (exists (select 1 from public.tasks t where t.id = task_options.task_id and public.can_manage_rebus(t.rebus_id)));

drop policy if exists "task_hints_select_members" on public.task_hints;
drop policy if exists "task_hints_manage_teachers" on public.task_hints;
create policy "task_hints_select_access"
on public.task_hints for select
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_hints.task_id and public.can_access_rebus(t.rebus_id)));
create policy "task_hints_manage_access"
on public.task_hints for all
to authenticated
using (exists (select 1 from public.tasks t where t.id = task_hints.task_id and public.can_manage_rebus(t.rebus_id)))
with check (exists (select 1 from public.tasks t where t.id = task_hints.task_id and public.can_manage_rebus(t.rebus_id)));

drop policy if exists "group_messages_select_members" on public.group_messages;
drop policy if exists "group_messages_manage_teachers" on public.group_messages;
create policy "group_messages_select_access"
on public.group_messages for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "group_messages_manage_access"
on public.group_messages for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "student_task_overrides_select_members" on public.student_task_overrides;
drop policy if exists "student_task_overrides_manage_teachers" on public.student_task_overrides;
create policy "student_task_overrides_select_access"
on public.student_task_overrides for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "student_task_overrides_manage_access"
on public.student_task_overrides for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

drop policy if exists "group_score_adjustments_select_members" on public.group_score_adjustments;
drop policy if exists "group_score_adjustments_manage_teachers" on public.group_score_adjustments;
create policy "group_score_adjustments_select_access"
on public.group_score_adjustments for select
to authenticated
using (public.can_access_rebus(rebus_id));
create policy "group_score_adjustments_manage_access"
on public.group_score_adjustments for all
to authenticated
using (public.can_manage_rebus(rebus_id))
with check (public.can_manage_rebus(rebus_id));

grant execute on function public.accept_my_invitations() to authenticated;
