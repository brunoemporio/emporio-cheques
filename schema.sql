create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  supplier text not null,
  bank text not null,
  number text not null,
  amount numeric(12, 2) not null default 0,
  due_date date not null,
  sent_date date not null,
  status text not null default 'Enviado',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checks_sent_date_idx on public.checks (sent_date);
create index if not exists checks_due_date_idx on public.checks (due_date);
create index if not exists checks_supplier_idx on public.checks (supplier);

alter table public.checks disable row level security;
