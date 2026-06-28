-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create rooms table
create table if not exists public.rooms (
    id text primary key,
    host_id text not null,
    status text not null default 'waiting',
    players jsonb not null default '[]'::jsonb,
    game_state jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for rooms
alter table public.rooms enable row level security;

-- Create policies for rooms
create policy "Allow public read access to rooms" on public.rooms
    for select using (true);

create policy "Allow public insert access to rooms" on public.rooms
    for insert with check (true);

create policy "Allow public update access to rooms" on public.rooms
    for update using (true);

create policy "Allow public delete access to rooms" on public.rooms
    for delete using (true);

-- Create leaderboard table
create table if not exists public.leaderboard (
    id uuid primary key default gen_random_uuid(),
    user_id text unique, -- matches the auth.uid() or player UUID
    username text not null unique,
    wins integer not null default 0,
    games_played integer not null default 0,
    score integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for leaderboard
alter table public.leaderboard enable row level security;

-- Create policies for leaderboard
create policy "Allow public read access to leaderboard" on public.leaderboard
    for select using (true);

create policy "Allow users to insert their own stats" on public.leaderboard
    for insert with check (true);

create policy "Allow users to update their own stats" on public.leaderboard
    for update using (true);
