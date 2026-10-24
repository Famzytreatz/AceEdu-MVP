create or replace function public.get_school_dashboard_analytics(target_school_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with school_records as materialized (
    select id, full_name, role, designation, status, created_at, updated_at
    from public.enrollments
    where school_id = target_school_id
  ),
  month_series as (
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_students as (
    select date_trunc('month', created_at)::date as month_start, count(*) as total
    from school_records
    where role = 'student'
      and created_at >= date_trunc('month', current_date) - interval '5 months'
    group by 1
  ),
  class_distribution as (
    select min(trim(designation)) as class_name, count(*) as total
    from school_records
    where role = 'student' and nullif(trim(designation), '') is not null
    group by lower(trim(designation))
  ),
  recent_activity as (
    select
      full_name,
      role,
      designation,
      status,
      created_at,
      updated_at,
      case
        when updated_at > created_at and status = 'Active' then 'verified'
        else 'registered'
      end as activity_type,
      greatest(created_at, updated_at) as occurred_at
    from school_records
    order by greatest(created_at, updated_at) desc, id desc
    limit 6
  )
  select jsonb_build_object(
    'metrics', (
      select jsonb_build_object(
        'students', count(*) filter (where role = 'student'),
        'teachingStaff', count(*) filter (where role = 'teacher'),
        'administrativeStaff', count(*) filter (where role in ('sub-admin', 'school-admin')),
        'activeClasses', count(distinct nullif(lower(trim(designation)), ''))
          filter (where role = 'student')
      )
      from school_records
    ),
    'studentTrend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(month_series.month_start, 'Mon'),
          'total', coalesce(monthly_students.total, 0)
        )
        order by month_series.month_start
      )
      from month_series
      left join monthly_students using (month_start)
    ), '[]'::jsonb),
    'classDistribution', coalesce((
      select jsonb_agg(
        jsonb_build_object('className', class_name, 'total', total)
        order by total desc, class_name
      )
      from class_distribution
    ), '[]'::jsonb),
    'recentActivity', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fullName', full_name,
          'role', role,
          'designation', designation,
          'type', activity_type,
          'occurredAt', occurred_at
        )
        order by occurred_at desc
      )
      from recent_activity
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_school_dashboard_analytics(bigint) from public, anon, authenticated;
grant execute on function public.get_school_dashboard_analytics(bigint) to service_role;
