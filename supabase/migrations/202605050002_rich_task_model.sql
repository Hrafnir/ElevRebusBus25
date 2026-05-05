alter type public.task_type add value if not exists 'multi_select';
alter type public.task_type add value if not exists 'ordering';
alter type public.task_type add value if not exists 'matching';
alter type public.task_type add value if not exists 'qr_code';
alter type public.task_type add value if not exists 'audio';

create type public.task_asset_type as enum ('image', 'audio', 'video', 'link', 'document');

alter table public.tasks
  add column if not exists max_attempts integer,
  add column if not exists requires_location boolean not null default true,
  add column if not exists unlock_mode text not null default 'geofence',
  add column if not exists config jsonb not null default '{}'::jsonb;

create table public.task_assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  type public.task_asset_type not null,
  title text,
  url text,
  storage_bucket text,
  storage_path text,
  content_type text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.task_options (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  feedback text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.task_hints (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  penalty_points integer not null default 0,
  unlock_after_attempts integer,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index idx_task_assets_task on public.task_assets(task_id, sort_order);
create index idx_task_options_task on public.task_options(task_id, sort_order);
create index idx_task_hints_task on public.task_hints(task_id, sort_order);

alter table public.task_assets enable row level security;
alter table public.task_options enable row level security;
alter table public.task_hints enable row level security;

create policy "task_assets_select_members"
on public.task_assets for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assets.task_id
      and public.is_org_member(public.rebus_org_id(t.rebus_id))
  )
);

create policy "task_assets_manage_teachers"
on public.task_assets for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assets.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assets.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
);

create policy "task_options_select_members"
on public.task_options for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_options.task_id
      and public.is_org_member(public.rebus_org_id(t.rebus_id))
  )
);

create policy "task_options_manage_teachers"
on public.task_options for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_options.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_options.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
);

create policy "task_hints_select_members"
on public.task_hints for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_hints.task_id
      and public.is_org_member(public.rebus_org_id(t.rebus_id))
  )
);

create policy "task_hints_manage_teachers"
on public.task_hints for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_hints.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_hints.task_id
      and public.has_org_role(public.rebus_org_id(t.rebus_id), array['owner','admin','teacher']::public.organization_role[])
  )
);
