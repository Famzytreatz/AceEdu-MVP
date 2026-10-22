alter table public.enrollments
  add column if not exists assigned_classes text,
  add column if not exists subjects text,
  add column if not exists passport text,
  add column if not exists dob text,
  add column if not exists guardian_phone text,
  add column if not exists address text,
  add column if not exists state_of_origin text,
  add column if not exists phone text,
  add column if not exists password_hash text;
