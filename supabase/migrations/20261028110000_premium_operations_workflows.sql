create or replace function public.save_school_attendance(
  target_school_id bigint,
  target_class_id bigint,
  target_term_id bigint,
  target_date date,
  attendance_entries jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  class_year_id bigint;
  term_year_id bigint;
  term_starts_on date;
  term_ends_on date;
  session_id bigint;
  entry_count integer;
  roster_count integer;
begin
  if attendance_entries is null or jsonb_typeof(attendance_entries) <> 'array' then
    raise exception 'Attendance entries must be an array.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(attendance_entries) < 1
    or jsonb_array_length(attendance_entries) > 500 then
    raise exception 'Provide attendance for 1 to 500 students.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(attendance_entries) as entry(student_id bigint, status text, note text)
    where entry.student_id is null
      or entry.status is null
      or entry.status not in ('present', 'absent', 'late', 'excused')
      or length(coalesce(entry.note, '')) > 300
  ) then
    raise exception 'Attendance contains an invalid student, status, or note.'
      using errcode = '22023';
  end if;

  select count(*), count(distinct entry.student_id)
    into entry_count, roster_count
  from jsonb_to_recordset(attendance_entries) as entry(student_id bigint);
  if entry_count <> roster_count then
    raise exception 'Attendance entries must contain unique student IDs.'
      using errcode = '22023';
  end if;

  select c.academic_year_id, t.academic_year_id, t.starts_on, t.ends_on
    into class_year_id, term_year_id, term_starts_on, term_ends_on
  from public.school_classes c
  join public.academic_terms t
    on t.id = target_term_id
    and t.school_id = target_school_id
  where c.id = target_class_id
    and c.school_id = target_school_id;

  if not found or class_year_id <> term_year_id then
    raise exception 'Class or term not found for this school.'
      using errcode = 'P0002';
  end if;
  if target_date is null or target_date < term_starts_on or target_date > term_ends_on then
    raise exception 'Attendance date must be within the selected academic term.'
      using errcode = '22023';
  end if;

  select count(*) into roster_count
  from public.enrollments e
  where e.school_id = target_school_id
    and e.class_id = target_class_id
    and e.role = 'student'
    and e.status = 'Active';
  if roster_count <> entry_count then
    raise exception 'Attendance must include every active student in this class.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(attendance_entries) as entry(student_id bigint)
    left join public.enrollments e
      on e.id = entry.student_id
      and e.school_id = target_school_id
      and e.class_id = target_class_id
      and e.role = 'student'
      and e.status = 'Active'
    where e.id is null
  ) then
    raise exception 'Attendance can only be recorded for active students in this class.'
      using errcode = '22023';
  end if;

  insert into public.attendance_sessions (
    school_id, class_id, academic_term_id, session_date
  ) values (
    target_school_id, target_class_id, target_term_id, target_date
  )
  on conflict (school_id, class_id, session_date)
  do update set academic_term_id = excluded.academic_term_id
  returning id into session_id;

  insert into public.attendance_records (
    school_id, attendance_session_id, student_id, status, note
  )
  select
    target_school_id,
    session_id,
    entry.student_id,
    entry.status,
    nullif(trim(entry.note), '')
  from jsonb_to_recordset(attendance_entries) as entry(
    student_id bigint,
    status text,
    note text
  )
  on conflict (school_id, attendance_session_id, student_id)
  do update set status = excluded.status, note = excluded.note;

  return jsonb_build_object('sessionId', session_id, 'savedCount', entry_count);
end;
$$;

create or replace function public.save_school_assessment_results(
  target_school_id bigint,
  target_assessment_id bigint,
  assessment_results jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  assessment_class_id bigint;
  assessment_maximum_score numeric(7,2);
  result_count integer;
  unique_result_count integer;
begin
  select a.class_id, a.maximum_score
    into assessment_class_id, assessment_maximum_score
  from public.academic_assessments a
  where a.id = target_assessment_id
    and a.school_id = target_school_id;
  if not found then
    raise exception 'Assessment not found for this school.'
      using errcode = 'P0002';
  end if;

  if assessment_results is null or jsonb_typeof(assessment_results) <> 'array' then
    raise exception 'Assessment results must be an array.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(assessment_results) < 1
    or jsonb_array_length(assessment_results) > 500 then
    raise exception 'Provide results for 1 to 500 students.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assessment_results) as result(student_id bigint, score numeric, feedback text)
    where result.student_id is null
      or result.score is null
      or result.score < 0
      or result.score > assessment_maximum_score
      or result.score <> round(result.score, 2)
      or length(coalesce(result.feedback, '')) > 1000
  ) then
    raise exception 'One or more assessment results are invalid.'
      using errcode = '22023';
  end if;

  select count(*), count(distinct result.student_id)
    into result_count, unique_result_count
  from jsonb_to_recordset(assessment_results) as result(student_id bigint);
  if result_count <> unique_result_count then
    raise exception 'Assessment results must contain unique student IDs.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assessment_results) as result(student_id bigint)
    left join public.enrollments e
      on e.id = result.student_id
      and e.school_id = target_school_id
      and e.class_id = assessment_class_id
      and e.role = 'student'
      and e.status = 'Active'
    where e.id is null
  ) then
    raise exception 'Results can only be saved for active students in this class.'
      using errcode = '22023';
  end if;

  insert into public.assessment_results (
    school_id, assessment_id, student_id, score, feedback
  )
  select
    target_school_id,
    target_assessment_id,
    result.student_id,
    result.score,
    nullif(trim(result.feedback), '')
  from jsonb_to_recordset(assessment_results) as result(
    student_id bigint,
    score numeric,
    feedback text
  )
  on conflict (school_id, assessment_id, student_id)
  do update set
    score = excluded.score,
    feedback = excluded.feedback,
    updated_at = now();

  return result_count;
end;
$$;

revoke all on function public.save_school_attendance(bigint, bigint, bigint, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_school_attendance(bigint, bigint, bigint, date, jsonb)
  to service_role;

revoke all on function public.save_school_assessment_results(bigint, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_school_assessment_results(bigint, bigint, jsonb)
  to service_role;
