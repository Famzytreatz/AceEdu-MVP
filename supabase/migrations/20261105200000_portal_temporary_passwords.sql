alter table public.enrollments
  add column if not exists must_change_password boolean not null default false,
  add column if not exists initial_password_expires_at timestamptz;
