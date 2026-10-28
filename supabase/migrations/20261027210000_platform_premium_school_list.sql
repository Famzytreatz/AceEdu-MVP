create or replace function public.list_active_premium_schools()
returns table (
  public_school_id varchar(32),
  school_name varchar(160),
  country varchar(80),
  state varchar(100),
  city varchar(100),
  access_type text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.public_school_id,
    s.school_name,
    s.country,
    s.state,
    s.city,
    case
      when e.plan = 'premium' then 'plan'
      else 'trial'
    end as access_type,
    i.trial_started_at,
    i.trial_ends_at
  from public.school_entitlements e
  join public.schools s on s.id = e.school_id
  left join public.school_trial_identities i
    on i.id = e.registration_identity_id
  where e.plan = 'premium'
     or (
       i.trial_started_at is not null
       and i.trial_ends_at is not null
       and i.trial_started_at <= now()
       and now() < i.trial_ends_at
     )
  order by coalesce(i.trial_ends_at, e.updated_at) asc, s.school_name asc;
$$;

revoke all on function public.list_active_premium_schools()
  from public, anon, authenticated;
grant execute on function public.list_active_premium_schools()
  to service_role;
