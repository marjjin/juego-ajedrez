-- Ajedrez 3D: tabla chess_rooms (salas) para partidas online.
-- Pegá este archivo completo en Supabase > SQL Editor y ejecutalo una vez.

create table if not exists public.chess_rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  white_id      text,
  white_name    text,
  black_id      text,
  black_name    text,
  moves         jsonb not null default '[]'::jsonb,
  fen           text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  status        text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  winner        text check (winner in ('w', 'b', 'draw')),
  reason        text,
  draw_offer_by text,
  rematch_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists chess_rooms_status_updated_idx on public.chess_rooms (status, updated_at desc);

-- updated_at automático
create or replace function public.chess_rooms_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chess_rooms_touch_updated_at on public.chess_rooms;
create trigger chess_rooms_touch_updated_at
  before update on public.chess_rooms
  for each row execute function public.chess_rooms_touch_updated_at();

-- Permisos: el juego no usa cuentas, solo un nombre de usuario,
-- así que el rol anónimo puede leer, crear y actualizar salas.
alter table public.chess_rooms enable row level security;

grant select, insert, update, delete on public.chess_rooms to anon, authenticated;

drop policy if exists chess_rooms_select on public.chess_rooms;
create policy chess_rooms_select on public.chess_rooms for select to anon, authenticated using (true);

drop policy if exists chess_rooms_insert on public.chess_rooms;
create policy chess_rooms_insert on public.chess_rooms for insert to anon, authenticated with check (true);

drop policy if exists chess_rooms_update on public.chess_rooms;
create policy chess_rooms_update on public.chess_rooms for update to anon, authenticated using (true) with check (true);

drop policy if exists chess_rooms_delete on public.chess_rooms;
create policy chess_rooms_delete on public.chess_rooms for delete to anon, authenticated using (status = 'waiting');

-- Tiempo real: avisar a los clientes cuando cambia una sala
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chess_rooms'
  ) then
    alter publication supabase_realtime add table public.chess_rooms;
  end if;
end;
$$;
