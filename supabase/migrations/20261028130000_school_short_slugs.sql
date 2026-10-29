create table if not exists public.school_slug_aliases (
  slug varchar(63) primary key,
  school_id bigint not null references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint school_slug_aliases_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 63)
);

alter table public.school_slug_aliases enable row level security;

create or replace function public.school_slug_from_name(
  school_name text,
  school_public_id varchar(32)
)
returns varchar(63)
language plpgsql
immutable
set search_path = public
as $$
declare
  base_slug text;
  slug_suffix text;
begin
  base_slug := btrim(
    regexp_replace(lower(coalesce(school_name, '')), '[^a-z0-9]+', '-', 'g'),
    '-'
  );
  if base_slug = '' then
    base_slug := 'school';
  end if;

  slug_suffix := '-' || left(md5(school_public_id), 16);
  return left(base_slug, 63 - length(slug_suffix)) || slug_suffix;
end;
$$;

insert into public.school_slug_aliases (slug, school_id)
select previous.slug, previous.id
from public.schools as previous
where previous.slug is not null
  and not exists (
    select 1
    from public.schools as target
    where target.id <> previous.id
      and target.slug = public.school_slug_from_name(
        target.school_name,
        target.public_school_id
      )
  )
on conflict (slug) do nothing;

update public.schools
set slug = public.school_slug_from_name(school_name, public_school_id);
