alter table public.schools
  add column if not exists short_name varchar(3);

alter table public.schools
  drop constraint if exists schools_short_name_format;

alter table public.schools
  add constraint schools_short_name_format
  check (short_name is null or short_name ~ '^[A-Z]{3}$');

create unique index if not exists schools_short_name_unique
  on public.schools (upper(short_name))
  where short_name is not null;

alter table public.enrollments
  alter column access_pin type varchar(9);

alter table public.enrollments
  drop constraint if exists enrollments_access_pin_check;

alter table public.enrollments
  add constraint enrollments_access_pin_format
  check (access_pin ~ '^[0-9]{6}$' or access_pin ~ '^[A-Z]{3}-[0-9]{5}$');
