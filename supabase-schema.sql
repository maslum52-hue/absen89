-- Skema Supabase untuk aplikasi absensi SMA Negeri 1 Halmahera Timur.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- Kata sandi TIDAK disimpan di tabel aplikasi; akun autentikasi dikelola Supabase Auth.

create extension if not exists pgcrypto;

do $$ begin
  create type public.school_role as enum ('administrator', 'guru_piket');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_gender as enum ('laki_laki', 'perempuan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('hadir', 'terlambat', 'izin', 'sakit', 'alpa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_session_status as enum ('aktif', 'selesai', 'dibatalkan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_source as enum ('qr', 'manual');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profil/peran aplikasi terhubung ke auth.users milik Supabase.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.school_role not null default 'guru_piket',
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_school_role()
returns public.school_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.user_profiles p
  where p.user_id = auth.uid() and p.is_active = true
  limit 1;
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.current_school_role() = 'administrator', false); $$;

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_school_role() is not null; $$;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_number text unique,
  full_name text not null,
  email text,
  phone text,
  subject text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique,
  grade_level text not null check (grade_level in ('X', 'XI', 'XII')),
  major text not null,
  homeroom_teacher_id uuid references public.teachers(id) on delete set null,
  room_name text,
  capacity integer not null default 36 check (capacity > 0),
  academic_year text not null default '2026/2027',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nisn text unique,
  full_name text not null,
  class_id uuid references public.classes(id) on delete set null,
  gender public.student_gender,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  address text,
  enrollment_date date not null default current_date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists students_full_name_idx on public.students using btree (full_name);

create table if not exists public.piket_schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu')),
  duty_area text not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.school_settings (
  id smallint primary key default 1 check (id = 1),
  school_name text not null default 'SMA Negeri 1 Halmahera Timur',
  attendance_start time not null default '06:30',
  on_time_until time not null default '07:00',
  late_tolerance_minutes integer not null default 15 check (late_tolerance_minutes >= 0),
  saturday_is_holiday boolean not null default false,
  qr_attendance_enabled boolean not null default true,
  location_latitude numeric(10,7) check (location_latitude between -90 and 90),
  location_longitude numeric(10,7) check (location_longitude between -180 and 180),
  attendance_radius_meters integer not null default 100 check (attendance_radius_meters between 10 and 5000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((location_latitude is null) = (location_longitude is null))
);

insert into public.school_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null unique,
  session_date date not null default current_date,
  title text not null default 'Absensi Siswa',
  status public.attendance_session_status not null default 'aktif',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create unique index if not exists attendance_one_active_session_per_day_idx
  on public.attendance_sessions(session_date) where status = 'aktif';

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.attendance_sessions(id) on delete set null,
  student_id uuid not null references public.students(id) on delete restrict,
  attendance_date date not null default current_date,
  status public.attendance_status not null,
  source public.attendance_source not null default 'qr',
  scanned_at timestamptz not null default now(),
  location_latitude numeric(10,7) check (location_latitude between -90 and 90),
  location_longitude numeric(10,7) check (location_longitude between -180 and 180),
  distance_from_school_meters numeric(9,2) check (distance_from_school_meters >= 0),
  note text,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date),
  check ((location_latitude is null) = (location_longitude is null))
);

create index if not exists attendance_records_date_idx on public.attendance_records(attendance_date desc);
create index if not exists attendance_records_student_date_idx on public.attendance_records(student_id, attendance_date desc);
create index if not exists attendance_records_session_idx on public.attendance_records(session_id);

create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('siswa','kelas','guru')),
  file_name text not null,
  imported_rows integer not null default 0 check (imported_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  error_details jsonb not null default '[]'::jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Perbarui updated_at secara otomatis.
do $$
declare t text;
begin
  foreach t in array array['user_profiles','teachers','classes','students','piket_schedules','attendance_sessions','attendance_records'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Aktifkan Row Level Security pada semua tabel.
alter table public.user_profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.piket_schedules enable row level security;
alter table public.school_settings enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.data_imports enable row level security;

-- Kebijakan dapat dijalankan ulang dengan aman.
drop policy if exists "profiles read self or admin" on public.user_profiles;
create policy "profiles read self or admin" on public.user_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_school_admin());
drop policy if exists "profiles admin manage" on public.user_profiles;
create policy "profiles admin manage" on public.user_profiles for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "teachers staff read" on public.teachers;
create policy "teachers staff read" on public.teachers for select to authenticated using (public.is_school_staff());
drop policy if exists "teachers admin manage" on public.teachers;
create policy "teachers admin manage" on public.teachers for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "classes staff read" on public.classes;
create policy "classes staff read" on public.classes for select to authenticated using (public.is_school_staff());
drop policy if exists "classes admin manage" on public.classes;
create policy "classes admin manage" on public.classes for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "students staff read" on public.students;
create policy "students staff read" on public.students for select to authenticated using (public.is_school_staff());
drop policy if exists "students admin manage" on public.students;
create policy "students admin manage" on public.students for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "piket schedules staff read" on public.piket_schedules;
create policy "piket schedules staff read" on public.piket_schedules for select to authenticated using (public.is_school_staff());
drop policy if exists "piket schedules admin manage" on public.piket_schedules;
create policy "piket schedules admin manage" on public.piket_schedules for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "settings staff read" on public.school_settings;
create policy "settings staff read" on public.school_settings for select to authenticated using (public.is_school_staff());
drop policy if exists "settings admin manage" on public.school_settings;
create policy "settings admin manage" on public.school_settings for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

drop policy if exists "sessions staff read" on public.attendance_sessions;
create policy "sessions staff read" on public.attendance_sessions for select to authenticated using (public.is_school_staff());
drop policy if exists "sessions staff manage" on public.attendance_sessions;
create policy "sessions staff manage" on public.attendance_sessions for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());

drop policy if exists "attendance staff read" on public.attendance_records;
create policy "attendance staff read" on public.attendance_records for select to authenticated using (public.is_school_staff());
drop policy if exists "attendance staff add or update" on public.attendance_records;
create policy "attendance staff add or update" on public.attendance_records for insert to authenticated
  with check (public.is_school_staff());
drop policy if exists "attendance staff update" on public.attendance_records;
create policy "attendance staff update" on public.attendance_records for update to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());
drop policy if exists "attendance admin delete" on public.attendance_records;
create policy "attendance admin delete" on public.attendance_records for delete to authenticated
  using (public.is_school_admin());

drop policy if exists "imports staff read own or admin" on public.data_imports;
create policy "imports staff read own or admin" on public.data_imports for select to authenticated
  using (imported_by = auth.uid() or public.is_school_admin());
drop policy if exists "imports admin manage" on public.data_imports;
create policy "imports admin manage" on public.data_imports for all to authenticated
  using (public.is_school_admin()) with check (public.is_school_admin());

grant usage on schema public to authenticated;
revoke all on public.user_profiles, public.teachers, public.classes, public.students,
  public.piket_schedules, public.school_settings, public.attendance_sessions,
  public.attendance_records, public.data_imports from anon;
grant select, insert, update, delete on public.user_profiles, public.teachers, public.classes,
  public.students, public.piket_schedules, public.school_settings, public.attendance_sessions,
  public.attendance_records, public.data_imports to authenticated;
revoke all on function public.current_school_role() from public, anon;
revoke all on function public.is_school_admin() from public, anon;
revoke all on function public.is_school_staff() from public, anon;
grant execute on function public.current_school_role() to authenticated;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.is_school_staff() to authenticated;

-- Bootstrap administrator:
-- 1. Buat akun melalui Supabase Dashboard > Authentication > Users.
-- 2. Salin UUID pengguna tersebut, lalu jalankan perintah berikut dengan UUID itu:
-- insert into public.user_profiles (user_id, full_name, role, email)
-- values ('UUID-AUTH-USER', 'Administrator', 'administrator', 'admin@sman1.sch.id');

-- Laporan dapat dibuat dari attendance_records JOIN students JOIN classes.
-- Gunakan anon key pada frontend hanya bersama RLS; jangan pernah menaruh service_role key di browser.
