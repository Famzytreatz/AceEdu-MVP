alter table public.schools
  add column if not exists slug varchar(63),
  add column if not exists logo_url text;

create or replace function public.school_slug_from_name(school_name text, school_id bigint)
returns varchar(63)
language plpgsql
immutable
set search_path = public
as $$
declare
  base_slug text;
  id_suffix text;
begin
  base_slug := btrim(
    regexp_replace(lower(coalesce(school_name, '')), '[^a-z0-9]+', '-', 'g'),
    '-'
  );
  if base_slug = '' then
    base_slug := 'school';
  end if;

  id_suffix := '-' || school_id::text;
  return left(base_slug, 63 - length(id_suffix)) || id_suffix;
end;
$$;

update public.schools
set slug = public.school_slug_from_name(school_name, id)
where slug is null or slug = '';

alter table public.schools
  alter column slug set not null;

create unique index if not exists schools_slug_unique
  on public.schools (slug);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_slug_format'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_slug_format
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 63);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_logo_url_https'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_logo_url_https
      check (
        logo_url is null
        or (char_length(logo_url) <= 2048 and logo_url ~ '^https://[^[:space:]]+$')
      );
  end if;
end;
$$;

create or replace function public.schools_assign_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.slug := public.school_slug_from_name(new.school_name, new.id);
  return new;
end;
$$;

drop trigger if exists schools_assign_slug on public.schools;
create trigger schools_assign_slug
  before insert on public.schools
  for each row execute function public.schools_assign_slug();
