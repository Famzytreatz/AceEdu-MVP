alter table public.schools
  add column if not exists public_school_id varchar(32);

create or replace function public.school_public_id_from_uuid(source_uuid uuid)
returns varchar(32)
language sql
immutable
set search_path = public
as $$
  select translate(
    replace(lower(source_uuid::text), '-', ''),
    'abcdef',
    '012345'
  )::varchar(32);
$$;

create unique index if not exists schools_public_school_id_unique
  on public.schools (public_school_id);

do $$
declare
  school_row record;
  candidate_id varchar(32);
begin
  for school_row in
    select id
    from public.schools
    where public_school_id is null
    order by id
  loop
    loop
      candidate_id := public.school_public_id_from_uuid(gen_random_uuid());
      exit when not exists (
        select 1
        from public.schools
        where public_school_id = candidate_id
      );
    end loop;

    update public.schools
    set public_school_id = candidate_id
    where id = school_row.id;
  end loop;
end;
$$;

alter table public.schools
  alter column public_school_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_public_school_id_format'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_public_school_id_format
      check (public_school_id ~ '^[0-9]{32}$');
  end if;
end;
$$;

drop trigger if exists schools_assign_slug on public.schools;
drop function if exists public.school_slug_from_name(text, bigint);

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
  id_suffix text;
begin
  base_slug := btrim(
    regexp_replace(lower(coalesce(school_name, '')), '[^a-z0-9]+', '-', 'g'),
    '-'
  );
  if base_slug = '' then
    base_slug := 'school';
  end if;

  id_suffix := '-' || school_public_id;
  return left(base_slug, 63 - length(id_suffix)) || id_suffix;
end;
$$;

update public.schools
set slug = public.school_slug_from_name(school_name, public_school_id);

create or replace function public.schools_assign_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  loop
    new.public_school_id := public.school_public_id_from_uuid(gen_random_uuid());
    exit when not exists (
      select 1
      from public.schools
      where public_school_id = new.public_school_id
    );
  end loop;

  new.slug := public.school_slug_from_name(new.school_name, new.public_school_id);
  return new;
end;
$$;

create trigger schools_assign_identity
  before insert on public.schools
  for each row execute function public.schools_assign_identity();
