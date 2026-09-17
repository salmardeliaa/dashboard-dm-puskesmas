-- Jalankan seluruh SQL ini di Supabase > SQL Editor.
-- DEMO DATA: data di bawah hanya contoh, jangan gunakan NIK/nama pasien asli.

create extension if not exists pgcrypto;

create table if not exists public.patients_dm (
  id uuid primary key default gen_random_uuid(),
  patient_code text unique,
  nama text not null,
  puskesmas text not null,
  umur integer,
  gdp numeric,
  gds numeric,
  hba1c numeric,
  td text,
  obat text,
  last_visit date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.make_patient_code()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.patient_code is null or new.patient_code = '' then
    new.patient_code := 'DM-' || upper(substr(replace(new.id::text,'-',''),1,8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patient_code on public.patients_dm;
create trigger trg_patient_code
before insert on public.patients_dm
for each row execute function public.make_patient_code();

alter table public.patients_dm enable row level security;

drop policy if exists "authenticated can read patients" on public.patients_dm;
create policy "authenticated can read patients"
on public.patients_dm for select
to authenticated
using (true);

drop policy if exists "authenticated can insert patients" on public.patients_dm;
create policy "authenticated can insert patients"
on public.patients_dm for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "authenticated can update patients" on public.patients_dm;
create policy "authenticated can update patients"
on public.patients_dm for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can delete patients" on public.patients_dm;
create policy "authenticated can delete patients"
on public.patients_dm for delete
to authenticated
using (true);

insert into public.patients_dm
(nama,puskesmas,umur,gdp,gds,hba1c,td,obat,last_visit)
values
('Pasien 001','Puskesmas A',58,118,165,6.8,'130/80','Metformin','2026-09-01'),
('Pasien 002','Puskesmas A',62,185,240,9.2,'150/90','Metformin + Glimepiride','2026-08-20'),
('Pasien 003','Puskesmas B',51,125,175,7.1,'135/85','Metformin','2026-08-25'),
('Pasien 004','Puskesmas B',67,105,150,6.5,'125/75','Metformin','2026-09-02'),
('Pasien 005','Puskesmas C',45,210,290,10.1,'145/95','Metformin','2026-08-28'),
('Pasien 006','Puskesmas C',70,115,160,6.9,'130/80','Metformin','2026-06-01'),
('Pasien 007','Puskesmas A',55,130,190,7.5,'140/85','Metformin','2026-09-01'),
('Pasien 008','Puskesmas B',60,110,155,6.7,'125/80','Metformin','2026-09-01')
on conflict do nothing;