-- 注文の多い利用者を 5 人出す
select u.name, count(*) as orders
from orders o
join users u on u.id = o.user_id
group by u.name
order by orders desc
limit 5;
