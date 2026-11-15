create table sessions (
  id text primary key,
  user_name text not null,
  created_at timestamptz not null default now()
);
insert into sessions (id, user_name) values ('s-1', 'alice'), ('s-2', 'bob');
