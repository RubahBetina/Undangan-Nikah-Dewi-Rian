-- ============================================================================
-- Atelier Fleur — Supabase PostgreSQL & Storage Migration Script
-- Jalankan script ini di Supabase Dashboard -> SQL Editor
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Wedding Settings (single config row id = 1)
create table if not exists public.wedding_settings (
  id integer primary key default 1,
  couple_headline text not null default 'Amara & Dimas',
  bride_full_name text not null,
  bride_parents text not null,
  bride_bio text not null default '',
  groom_full_name text not null,
  groom_parents text not null,
  groom_bio text not null default '',
  wedding_date_iso text not null,
  display_date_text text not null,
  city_location text not null,
  opening_quote text not null,
  opening_verse_source text not null default '',
  akad_title text not null default 'Akad Nikah',
  akad_time text not null,
  akad_venue text not null,
  akad_address text not null,
  resepsi_title text not null default 'Resepsi Taman',
  resepsi_time text not null,
  resepsi_venue text not null,
  resepsi_address text not null,
  maps_url text not null default '',
  dress_code text not null default '',
  couple_photo_url text not null default '',
  venue_photo_url text not null default '',
  sky_color_hex text not null default '#FBF8F6',
  story_milestones jsonb not null default '[]'::jsonb,
  scene_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Media Assets Library
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('floral','foliage','frame','couple','venue','backdrop')),
  url text not null,
  storage_path text,
  has_alpha boolean not null default false,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. 3D Mental Canvas Layered Elements
create table if not exists public.canvas_elements (
  id text primary key,
  asset_id text not null,
  label text not null,
  url text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  z double precision not null default 0,
  scale double precision not null default 3,
  rot_x double precision not null default 0,
  rot_y double precision not null default 0,
  rot_z double precision not null default 0,
  opacity double precision not null default 1,
  remove_white_bg boolean not null default true,
  center_window boolean not null default false,
  sway_amplitude double precision not null default 0.02,
  sway_speed double precision not null default 0.8,
  float_amplitude double precision not null default 0.04,
  chapter_index integer not null default 0,
  sort_order integer not null default 0,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 4. 3D Camera Path Stops (Mental Canvas Scroll Keyframes)
create table if not exists public.camera_stops (
  id text primary key,
  chapter_index integer not null,
  title text not null,
  subtitle text not null default '',
  scroll_at double precision not null,
  cam_x double precision not null,
  cam_y double precision not null,
  cam_z double precision not null,
  look_x double precision not null,
  look_y double precision not null,
  look_z double precision not null
);

-- 5. Guest RSVPs
create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  attendance text not null check (attendance in ('hadir','tidak_hadir','ragu')),
  guest_count integer not null default 1 check (guest_count >= 1 and guest_count <= 10),
  session_choice text not null default 'akad_resepsi',
  message text not null default '',
  created_at timestamptz not null default now()
);

-- 6. Guestbook Wishes
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
alter table public.wedding_settings enable row level security;
alter table public.assets enable row level security;
alter table public.canvas_elements enable row level security;
alter table public.camera_stops enable row level security;
alter table public.rsvps enable row level security;
alter table public.wishes enable row level security;

-- Public Read Access for Guest Invitation
drop policy if exists "Public read wedding_settings" on public.wedding_settings;
create policy "Public read wedding_settings" on public.wedding_settings for select using (true);
drop policy if exists "Public read assets" on public.assets;
create policy "Public read assets" on public.assets for select using (true);
drop policy if exists "Public read canvas_elements" on public.canvas_elements;
create policy "Public read canvas_elements" on public.canvas_elements for select using (true);
drop policy if exists "Public read camera_stops" on public.camera_stops;
create policy "Public read camera_stops" on public.camera_stops for select using (true);
drop policy if exists "Public read wishes" on public.wishes;
create policy "Public read wishes" on public.wishes for select using (true);

-- Public Insert Access for Guests submitting RSVP & Wishes
drop policy if exists "Public insert rsvps" on public.rsvps;
create policy "Public insert rsvps" on public.rsvps for insert with check (true);
drop policy if exists "Public insert wishes" on public.wishes;
create policy "Public insert wishes" on public.wishes for insert with check (true);

-- Authenticated Admin Full Management Access
drop policy if exists "Admin all wedding_settings" on public.wedding_settings;
create policy "Admin all wedding_settings" on public.wedding_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Admin all assets" on public.assets;
create policy "Admin all assets" on public.assets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Admin all canvas_elements" on public.canvas_elements;
create policy "Admin all canvas_elements" on public.canvas_elements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Admin all camera_stops" on public.camera_stops;
create policy "Admin all camera_stops" on public.camera_stops
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Admin manage rsvps" on public.rsvps;
create policy "Admin manage rsvps" on public.rsvps
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Admin manage wishes" on public.wishes;
create policy "Admin manage wishes" on public.wishes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- Supabase Storage Bucket: wedding-assets
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('wedding-assets', 'wedding-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public view wedding-assets" on storage.objects;
create policy "Public view wedding-assets"
  on storage.objects for select
  using (bucket_id = 'wedding-assets');

drop policy if exists "Authenticated upload wedding-assets" on storage.objects;
create policy "Authenticated upload wedding-assets"
  on storage.objects for insert
  with check (bucket_id = 'wedding-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete wedding-assets" on storage.objects;
create policy "Authenticated delete wedding-assets"
  on storage.objects for delete
  using (bucket_id = 'wedding-assets' and auth.role() = 'authenticated');
