create or replace function public.publish_school_registration_form(
  target_school_id bigint,
  target_form_id bigint,
  target_version_id bigint
)
returns table (
  published_form_id bigint,
  published_version_id bigint,
  published_version_number integer,
  published_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  target_version public.school_registration_form_versions%rowtype;
  field_definition jsonb;
  custom_key text;
  custom_label text;
  custom_type text;
  custom_classification text;
begin
  select *
    into target_version
    from public.school_registration_form_versions
   where school_id = target_school_id
     and form_id = target_form_id
     and id = target_version_id
   for update;

  if not found then
    raise exception 'Registration form draft not found.' using errcode = 'P0002';
  end if;

  if target_version.status <> 'draft' then
    raise exception 'Only a draft registration form version can be published.' using errcode = '22023';
  end if;

  if jsonb_typeof(target_version.form_definition -> 'sections') <> 'array'
     or jsonb_typeof(target_version.form_definition -> 'fields') <> 'array' then
    raise exception 'The registration form definition is incomplete.' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from jsonb_array_elements(target_version.form_definition -> 'fields') as field(value)
     where field.value ->> 'fieldKey' = 'full_name'
       and field.value ->> 'storage' = 'standard'
       and (field.value ->> 'required')::boolean is true
  ) then
    raise exception 'The required standard student full-name field is missing.' using errcode = '22023';
  end if;

  for field_definition in
    select value
      from jsonb_array_elements(target_version.form_definition -> 'fields')
  loop
    if field_definition ->> 'storage' = 'custom' then
      custom_key := field_definition ->> 'fieldKey';
      custom_label := field_definition ->> 'label';
      custom_type := field_definition ->> 'type';
      custom_classification := coalesce(field_definition ->> 'dataClassification', 'standard');

      if custom_key is null
         or custom_key !~ '^[a-z][a-z0-9_]{0,99}$'
         or custom_label is null
         or length(custom_label) > 160
         or custom_type not in (
           'text', 'textarea', 'email', 'phone', 'date', 'number',
           'boolean', 'select', 'multiselect', 'radio', 'checkbox', 'file'
         )
         or custom_classification not in ('standard', 'sensitive', 'restricted') then
        raise exception 'A custom registration field has invalid metadata.' using errcode = '22023';
      end if;

      insert into public.school_student_custom_fields (
        school_id,
        field_key,
        field_label,
        field_type,
        description,
        options,
        validation_rules,
        data_classification,
        is_active
      ) values (
        target_school_id,
        custom_key,
        custom_label,
        custom_type,
        nullif(field_definition ->> 'description', ''),
        coalesce(field_definition -> 'options', '[]'::jsonb),
        coalesce(field_definition -> 'validationRules', '{}'::jsonb),
        custom_classification,
        true
      )
      on conflict (school_id, field_key) do update
        set field_label = excluded.field_label,
            field_type = excluded.field_type,
            description = excluded.description,
            options = excluded.options,
            validation_rules = excluded.validation_rules,
            data_classification = excluded.data_classification,
            is_active = true,
            updated_at = now();
    end if;
  end loop;

  update public.school_registration_form_versions
     set status = 'retired',
         updated_at = now()
   where school_id = target_school_id
     and form_id = target_form_id
     and status = 'published';

  update public.school_registration_form_versions
     set status = 'published',
         published_at = now(),
         updated_at = now()
   where school_id = target_school_id
     and form_id = target_form_id
     and id = target_version_id;

  update public.school_registration_forms
     set is_active = true,
         updated_at = now()
   where school_id = target_school_id
     and id = target_form_id;

  return query
  select target_version.form_id,
         target_version.id,
         target_version.version_number,
         current_version.published_at
    from public.school_registration_form_versions as current_version
   where current_version.school_id = target_school_id
     and current_version.form_id = target_form_id
     and current_version.id = target_version_id;
end;
$function$;

revoke all on function public.publish_school_registration_form(bigint, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_school_registration_form(bigint, bigint, bigint)
  to service_role;
