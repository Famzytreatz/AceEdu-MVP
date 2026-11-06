alter table public.school_class_students
  add column if not exists is_active boolean not null default true;

update public.school_class_students roster
set is_active = (
  not exists (
    select 1
    from public.school_classes school_class
    join public.academic_years academic_year
      on academic_year.id = school_class.academic_year_id
      and academic_year.school_id = school_class.school_id
    where school_class.id = roster.class_id
      and school_class.school_id = roster.school_id
      and academic_year.is_current
  )
  or exists (
    select 1
    from public.school_classes school_class
    join public.academic_years academic_year
      on academic_year.id = school_class.academic_year_id
      and academic_year.school_id = school_class.school_id
    join public.enrollments enrollment
      on enrollment.id = roster.student_id
      and enrollment.school_id = roster.school_id
    where school_class.id = roster.class_id
      and school_class.school_id = roster.school_id
      and academic_year.is_current
      and enrollment.class_id = roster.class_id
      and enrollment.role = 'student'
      and enrollment.status = 'Active'
  )
);

create or replace function public.assign_school_class(
  target_school_id bigint,
  target_class_id bigint,
  target_student_ids bigint[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_year_id bigint;
  target_is_current boolean;
  updated_count integer;
begin
  if cardinality(target_student_ids) > 500 then
    raise exception 'Assign no more than 500 students at a time.'
      using errcode = '22023';
  end if;

  select c.academic_year_id, y.is_current
  into target_year_id, target_is_current
  from public.school_classes c
  join public.academic_years y
    on y.id = c.academic_year_id and y.school_id = c.school_id
  where c.id = target_class_id and c.school_id = target_school_id;

  if not found then
    raise exception 'Class not found for this school.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(target_student_ids) as requested(id)
    left join public.enrollments e
      on e.id = requested.id
      and e.school_id = target_school_id
      and e.role = 'student'
    where e.id is null
      or (
        e.status <> 'Active'
        and not exists (
          select 1
          from public.school_class_students roster
          where roster.school_id = target_school_id
            and roster.class_id = target_class_id
            and roster.student_id = requested.id
        )
      )
  ) then
    raise exception 'Selected students must be active in this school.'
      using errcode = '22023';
  end if;

  update public.school_class_students roster
  set is_active = false
  from public.school_classes other_class
  where roster.school_id = target_school_id
    and roster.student_id = any(target_student_ids)
    and roster.class_id = other_class.id
    and other_class.school_id = target_school_id
    and other_class.academic_year_id = target_year_id
    and roster.class_id <> target_class_id
    and roster.is_active;

  update public.school_class_students
  set is_active = false
  where school_id = target_school_id
    and class_id = target_class_id
    and not (student_id = any(target_student_ids))
    and is_active;

  insert into public.school_class_students (
    school_id, class_id, student_id, is_active
  )
  select target_school_id, target_class_id, requested.id, true
  from unnest(target_student_ids) as requested(id)
  on conflict (school_id, class_id, student_id)
  do update set is_active = true;

  if target_is_current then
    update public.enrollments
    set class_id = null,
        designation = '',
        updated_at = now()
    where school_id = target_school_id
      and role = 'student'
      and class_id = target_class_id
      and not (id = any(target_student_ids));

    update public.enrollments
    set class_id = target_class_id,
        designation = (
          select name from public.school_classes
          where id = target_class_id and school_id = target_school_id
        ),
        updated_at = now()
    where school_id = target_school_id
      and role = 'student'
      and status = 'Active'
      and id = any(target_student_ids);
    get diagnostics updated_count = row_count;
  else
    get diagnostics updated_count = row_count;
  end if;

  return updated_count;
end;
$$;

revoke all on function public.assign_school_class(bigint, bigint, bigint[])
  from public, anon, authenticated;
grant execute on function public.assign_school_class(bigint, bigint, bigint[])
  to service_role;
