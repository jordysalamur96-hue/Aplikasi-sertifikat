create extension if not exists "pgcrypto";

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  nomor text not null,
  nama text not null,
  kecamatan text not null,
  kelurahan text not null,
  lokasi text not null,
  luas text not null,
  tahun integer not null,
  status text not null default 'Hak Pakai',
  keterangan text,
  pdf_name text,
  pdf_mime_type text,
  pdf_size bigint,
  google_drive_file_id text,
  google_drive_view_url text,
  google_drive_download_url text,
  has_pdf boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists certificates_nomor_idx on public.certificates (nomor);
create index if not exists certificates_kecamatan_idx on public.certificates (kecamatan);
create index if not exists certificates_status_idx on public.certificates (status);
create index if not exists certificates_tahun_idx on public.certificates (tahun);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_certificates_updated_at on public.certificates;
create trigger set_certificates_updated_at
before update on public.certificates
for each row
execute function public.set_updated_at();

alter table public.certificates enable row level security;

drop policy if exists "Authenticated users can read certificates" on public.certificates;
create policy "Authenticated users can read certificates"
on public.certificates
for select
to authenticated
using (true);

-- Writes are performed by Netlify Functions using SUPABASE_SERVICE_ROLE_KEY.
