-- Tabela para armazenar tokens OAuth de integrações externas
create table if not exists public.integrations (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null unique,          -- ex: 'bling'
  access_token text not null,
  refresh_token text,
  token_type   text default 'Bearer',
  expires_at   timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Índice para lookup rápido por provider
create index if not exists integrations_provider_idx on public.integrations (provider);

-- RLS: somente service_role pode acessar (tokens são sensíveis)
alter table public.integrations enable row level security;

-- Nenhuma política pública — acesso apenas via createAdminClient() (service_role key)
