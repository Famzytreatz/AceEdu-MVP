alter table public.enrollments
  add column if not exists guardian_name varchar(160);

alter table public.parent_accounts
  add column if not exists initial_password_expires_at timestamptz;

create or replace function public.ensure_school_parent_for_student(
  target_school_id bigint,
  target_student_id bigint,
  parent_name text,
  parent_phone text,
  parent_password_hash text,
  setup_code_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_parent_id bigint;
  parent_is_active boolean;
  parent_must_change_password boolean;
  current_setup_code_expiry timestamptz;
  is_new_parent boolean := false;
  send_setup_code boolean := false;
  linked_student_count integer;
begin
  if nullif(trim(parent_name), '') is null or length(trim(parent_name)) > 160 then
    raise exception 'Enter a valid guardian name.' using errcode = '22023';
  end if;
  if parent_phone is null or parent_phone !~ '^\+?[0-9]{7,20}$' then
    raise exception 'Enter a valid guardian phone number.' using errcode = '22023';
  end if;
  if parent_password_hash is null or length(parent_password_hash) < 20 then
    raise exception 'A valid one-time setup credential is required.' using errcode = '22023';
  end if;
  if setup_code_expires_at is null
    or setup_code_expires_at <= now()
    or setup_code_expires_at > now() + interval '48 hours' then
    raise exception 'The setup code expiry is invalid.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.enrollments
    where id = target_student_id
      and school_id = target_school_id
      and role = 'student'
  ) then
    raise exception 'Student record not found for this school.' using errcode = 'P0002';
  end if;

  insert into public.parent_accounts (
    school_id, full_name, phone, password_hash, must_change_password,
    initial_password_expires_at
  ) values (
    target_school_id, trim(parent_name), parent_phone, parent_password_hash,
    true, setup_code_expires_at
  )
  on conflict (school_id, phone) do nothing
  returning id into new_parent_id;

  if new_parent_id is not null then
    is_new_parent := true;
    send_setup_code := true;
  else
    select id, is_active, must_change_password, initial_password_expires_at
      into new_parent_id, parent_is_active, parent_must_change_password,
        current_setup_code_expiry
    from public.parent_accounts
    where school_id = target_school_id and phone = parent_phone
    for update;

    if not found or not parent_is_active then
      raise exception 'The matching parent account is disabled.' using errcode = 'P0002';
    end if;

    if parent_must_change_password
      and (current_setup_code_expiry is null or current_setup_code_expiry <= now()) then
      update public.parent_accounts
      set password_hash = parent_password_hash,
          initial_password_expires_at = setup_code_expires_at
      where id = new_parent_id and school_id = target_school_id;
      send_setup_code := true;
    end if;
  end if;

  insert into public.parent_student_links (
    school_id, parent_id, student_id, relationship
  ) values (
    target_school_id, new_parent_id, target_student_id, 'guardian'
  )
  on conflict (school_id, parent_id, student_id) do nothing;

  select count(*) into linked_student_count
  from public.parent_student_links
  where school_id = target_school_id and parent_id = new_parent_id;

  return jsonb_build_object(
    'parentId', new_parent_id,
    'parentName', (
      select full_name from public.parent_accounts
      where id = new_parent_id and school_id = target_school_id
    ),
    'created', is_new_parent,
    'sendSetupCode', send_setup_code,
    'studentCount', linked_student_count,
    'isFamily', linked_student_count > 1
  );
end;
$$;

revoke all on function public.ensure_school_parent_for_student(
  bigint, bigint, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.ensure_school_parent_for_student(
  bigint, bigint, text, text, text, timestamptz
) to service_role;

create or replace function public.set_school_parent_students(
  target_school_id bigint,
  target_parent_id bigint,
  linked_student_ids jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  requested_count integer;
  valid_count integer;
begin
  if linked_student_ids is null or jsonb_typeof(linked_student_ids) <> 'array'
    or jsonb_array_length(linked_student_ids) < 1
    or jsonb_array_length(linked_student_ids) > 20 then
    raise exception 'Link one to 20 students.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.parent_accounts
    where id = target_parent_id and school_id = target_school_id
      and is_active
  ) then
    raise exception 'Parent account not found for this school.'
      using errcode = 'P0002';
  end if;

  select count(*), count(distinct student.value::bigint)
    into requested_count, valid_count
  from jsonb_array_elements_text(linked_student_ids) as student(value);
  if requested_count <> valid_count then
    raise exception 'Student links must be unique.' using errcode = '22023';
  end if;

  select count(*) into valid_count
  from public.enrollments e
  join jsonb_array_elements_text(linked_student_ids) as student(value)
    on e.id = student.value::bigint
  where e.school_id = target_school_id
    and e.role = 'student'
    and e.status in ('Active', 'Pending');
  if valid_count <> requested_count then
    raise exception 'Every linked student must belong to this school.'
      using errcode = '22023';
  end if;

  delete from public.parent_student_links
  where school_id = target_school_id and parent_id = target_parent_id;
  insert into public.parent_student_links (
    school_id, parent_id, student_id, relationship
  )
  select target_school_id, target_parent_id, student.value::bigint, 'guardian'
  from jsonb_array_elements_text(linked_student_ids) as student(value);

  return requested_count;
end;
$$;
