-- Cover composite foreign keys for registration tables.
-- These indexes support school-scoped joins and deletes/updates on referenced records.

create index reg_versions_form_school_idx
  on public.school_registration_form_versions (form_id, school_id);

create index reg_submissions_form_school_idx
  on public.school_registration_submissions (form_id, school_id);

create index reg_submissions_version_school_form_idx
  on public.school_registration_submissions (form_version_id, school_id, form_id);

create index reg_submissions_student_school_idx
  on public.school_registration_submissions (student_id, school_id)
  where student_id is not null;

create index reg_submissions_creator_school_idx
  on public.school_registration_submissions (created_by_enrollment_id, school_id)
  where created_by_enrollment_id is not null;

create index reg_submissions_reviewer_school_idx
  on public.school_registration_submissions (reviewed_by_enrollment_id, school_id)
  where reviewed_by_enrollment_id is not null;

create index reg_events_submission_school_idx
  on public.school_registration_submission_events (submission_id, school_id);

create index reg_events_actor_school_idx
  on public.school_registration_submission_events (actor_enrollment_id, school_id)
  where actor_enrollment_id is not null;

create index student_custom_values_student_school_idx
  on public.school_student_custom_field_values (student_id, school_id);

create index student_custom_values_field_school_idx
  on public.school_student_custom_field_values (custom_field_id, school_id);

create index student_custom_values_submission_school_idx
  on public.school_student_custom_field_values (source_submission_id, school_id)
  where source_submission_id is not null;

create index student_custom_values_version_school_idx
  on public.school_student_custom_field_values (captured_in_form_version_id, school_id)
  where captured_in_form_version_id is not null;

create index student_custom_values_editor_school_idx
  on public.school_student_custom_field_values (updated_by_enrollment_id, school_id)
  where updated_by_enrollment_id is not null;
