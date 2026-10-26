-- Profile photos for riders and drivers. Shown only to the other side of a shared trip.
create table avatars (
  user_id uuid primary key references users(id) on delete cascade,
  mime text not null check (mime in ('image/jpeg','image/png')),
  bytes bytea not null,
  updated_at timestamptz not null default now()
);
