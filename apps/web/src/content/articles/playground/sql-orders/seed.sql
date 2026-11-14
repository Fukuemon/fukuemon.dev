create table users (id int primary key, name text not null);
create table orders (id int primary key, user_id int not null references users (id));
insert into users select i, 'user-' || i from generate_series(1, 100) as i;
insert into orders select i, 1 + (i * 37) % 100 from generate_series(1, 2000) as i;
analyze;
