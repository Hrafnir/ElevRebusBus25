alter type public.task_type add value if not exists 'find_destination';

alter table public.rebuses
add column if not exists show_live_score boolean not null default true;
