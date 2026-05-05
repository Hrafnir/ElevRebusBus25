create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'teacher', 'viewer');
create type public.rebus_status as enum ('draft', 'published', 'archived');
create type public.task_type as enum ('text', 'multiple_choice', 'photo', 'video', 'teacher_approved');
create type public.progress_status as enum ('started', 'submitted', 'needs_retry', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'teacher',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.project_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  google_maps_api_key text,
  default_geofence_radius_meters integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rebuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  status public.rebus_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  title text not null,
  description text not null default '',
  type public.task_type not null default 'text',
  prompt text not null default '',
  answer text,
  points integer not null default 0,
  sort_order integer not null default 1,
  geofence_radius_meters integer not null default 30,
  location_label text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  display_name text not null,
  username text not null,
  password_hash text,
  team_name text,
  created_at timestamptz not null default now(),
  unique (rebus_id, username)
);

create table public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  answer text,
  status public.progress_status not null default 'submitted',
  correct boolean,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  type public.task_type not null,
  storage_bucket text not null default 'submissions',
  storage_path text not null,
  original_name text,
  content_type text,
  size_bytes bigint,
  note text not null default '',
  status public.progress_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create index idx_rebuses_organization on public.rebuses(organization_id);
create index idx_tasks_rebus on public.tasks(rebus_id, sort_order);
create index idx_students_rebus on public.students(rebus_id);
create index idx_progress_student_task on public.progress(student_id, task_id);
create index idx_locations_student_created on public.locations(student_id, created_at desc);
create index idx_submissions_student_created on public.submissions(student_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger project_settings_set_updated_at
before update on public.project_settings
for each row execute function public.set_updated_at();

create trigger rebuses_set_updated_at
before update on public.rebuses
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';

  insert into public.project_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

create trigger organizations_add_owner
after insert on public.organizations
for each row execute function public.add_organization_owner();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles public.organization_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.role = any(allowed_roles)
  );
$$;

create or replace function public.rebus_org_id(target_rebus_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.rebuses where id = target_rebus_id;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.project_settings enable row level security;
alter table public.rebuses enable row level security;
alter table public.tasks enable row level security;
alter table public.students enable row level security;
alter table public.participant_sessions enable row level security;
alter table public.progress enable row level security;
alter table public.locations enable row level security;
alter table public.submissions enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_members"
on public.organizations for select
to authenticated
using (public.is_org_member(id));

create policy "organizations_insert_authenticated"
on public.organizations for insert
to authenticated
with check (created_by = auth.uid());

create policy "organizations_update_admins"
on public.organizations for update
to authenticated
using (public.has_org_role(id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(id, array['owner','admin']::public.organization_role[]));

create policy "organization_members_select_members"
on public.organization_members for select
to authenticated
using (public.is_org_member(organization_id));

create policy "organization_members_manage_admins"
on public.organization_members for all
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "project_settings_select_members"
on public.project_settings for select
to authenticated
using (public.is_org_member(organization_id));

create policy "project_settings_manage_admins"
on public.project_settings for all
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "rebuses_select_members"
on public.rebuses for select
to authenticated
using (public.is_org_member(organization_id));

create policy "rebuses_manage_teachers"
on public.rebuses for all
to authenticated
using (public.has_org_role(organization_id, array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','teacher']::public.organization_role[]));

create policy "tasks_select_members"
on public.tasks for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

create policy "tasks_manage_teachers"
on public.tasks for all
to authenticated
using (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]));

create policy "students_select_members"
on public.students for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

create policy "students_manage_teachers"
on public.students for all
to authenticated
using (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]));

create policy "participant_sessions_select_members"
on public.participant_sessions for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = participant_sessions.student_id
      and public.is_org_member(public.rebus_org_id(s.rebus_id))
  )
);

create policy "progress_select_members"
on public.progress for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

create policy "locations_select_members"
on public.locations for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

create policy "submissions_select_members"
on public.submissions for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
