create table public.rebus_stops (
  id uuid primary key default gen_random_uuid(),
  rebus_id uuid not null references public.rebuses(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 1,
  location_label text,
  latitude double precision,
  longitude double precision,
  geofence_radius_meters integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists stop_id uuid references public.rebus_stops(id) on delete set null;

create index idx_rebus_stops_rebus on public.rebus_stops(rebus_id, sort_order);
create index idx_tasks_stop on public.tasks(stop_id, sort_order);

create trigger rebus_stops_set_updated_at
before update on public.rebus_stops
for each row execute function public.set_updated_at();

alter table public.rebus_stops enable row level security;

create policy "rebus_stops_select_members"
on public.rebus_stops for select
to authenticated
using (public.is_org_member(public.rebus_org_id(rebus_id)));

create policy "rebus_stops_manage_teachers"
on public.rebus_stops for all
to authenticated
using (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]))
with check (public.has_org_role(public.rebus_org_id(rebus_id), array['owner','admin','teacher']::public.organization_role[]));
