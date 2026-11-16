-- Protect published registration form versions from being overwritten.
-- To change a published form, the application must create a new draft version.

create or replace function public.guard_school_registration_form_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published or retired registration form versions cannot be deleted.';
    end if;
    return old;
  end if;

  if old.status = 'retired' then
    raise exception 'Retired registration form versions are immutable.';
  end if;

  if old.status = 'published' then
    if
      new.id is distinct from old.id
      or new.school_id is distinct from old.school_id
      or new.form_id is distinct from old.form_id
      or new.version_number is distinct from old.version_number
      or new.schema_version is distinct from old.schema_version
      or new.form_definition is distinct from old.form_definition
      or new.published_at is distinct from old.published_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Published registration form definitions cannot be edited. Create a new draft version.';
    end if;

    if new.status not in ('published', 'retired') then
      raise exception 'A published registration form version cannot be reverted to draft.';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    raise exception 'A published registration form version must have a publication timestamp.';
  end if;

  return new;
end;
$function$;

create trigger school_registration_form_version_immutability
before update or delete on public.school_registration_form_versions
for each row execute function public.guard_school_registration_form_version();
