CREATE TABLE IF NOT EXISTS items (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 amount BIGINT NOT NULL CHECK (amount > 0 AND amount <= 100000000000),
 kind VARCHAR(7) NOT NULL CHECK (kind IN ('income', 'expense')),
 category VARCHAR(30) NOT NULL,
 occurred_on DATE NOT NULL CHECK (occurred_on BETWEEN '2000-01-01' AND '2100-12-31')
);
CREATE INDEX items_date_idx ON items (occurred_on DESC, id DESC);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id=1), amount BIGINT NOT NULL CHECK(amount>0));
INSERT INTO settings VALUES (1,6000000);
-- Relative dates keep the demo useful whenever the stack is first started.
INSERT INTO items(name,amount,kind,category,occurred_on) VALUES
 ('Зарплата',9500000,'income','Зарплата',date_trunc('month',CURRENT_DATE)::date),
 ('Продукты на неделю',426000,'expense','Продукты',CURRENT_DATE),
 ('Кофе и круассан',58000,'expense','Кафе',CURRENT_DATE),
 ('Подписка на музыку',29900,'expense','Развлечения',CURRENT_DATE-1),
 ('Поездка на такси',74000,'expense','Транспорт',CURRENT_DATE-1),
 ('Новая толстовка',549000,'expense','Покупки',CURRENT_DATE-2),
 ('Ужин с друзьями',320000,'expense','Кафе',CURRENT_DATE-3),
 ('Заказ из супермаркета',287000,'expense','Продукты',CURRENT_DATE-4),
 ('Интернет',85000,'expense','Дом',CURRENT_DATE-5),
 ('Аптека',125000,'expense','Здоровье',CURRENT_DATE-6),
 ('Проект на фрилансе',1800000,'income','Подработка',CURRENT_DATE-7),
 ('Билеты в кино',160000,'expense','Развлечения',CURRENT_DATE-8),
 ('Аренда квартиры',2800000,'expense','Дом',date_trunc('month',CURRENT_DATE)::date),
 ('Продукты',360000,'expense','Продукты',(date_trunc('month',CURRENT_DATE)-interval '3 days')::date),
 ('Зарплата',9500000,'income','Зарплата',(date_trunc('month',CURRENT_DATE)-interval '1 month')::date);
