-- Public schema tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL
);

-- Seed public.users
INSERT INTO users (username, email) VALUES
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com'),
    ('charlie', 'charlie@example.com')
ON CONFLICT DO NOTHING;

-- Seed public.orders
INSERT INTO orders (user_id, status, total) VALUES
    (1, 'completed', 37.49),
    (1, 'pending', 89.00),
    (2, 'completed', 24.50),
    (3, 'shipped', 17.50)
ON CONFLICT DO NOTHING;

-- Seed public.order_items
INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES
    (1, 'Widget A', 2, 12.99),
    (1, 'Thingamajig XL', 2, 5.75),
    (2, 'Gizmo Pro', 1, 89.00),
    (3, 'Widget B', 1, 24.50),
    (4, 'Thingamajig XL', 1, 5.75),
    (4, 'Widget A', 1, 12.99)
ON CONFLICT DO NOTHING;

-- Schema for app data
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS analytics;

-- inventory.products
CREATE TABLE inventory.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- inventory.suppliers
CREATE TABLE inventory.suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    country VARCHAR(100)
);

-- inventory.product_suppliers (join table)
CREATE TABLE inventory.product_suppliers (
    product_id INT REFERENCES inventory.products(id),
    supplier_id INT REFERENCES inventory.suppliers(id),
    PRIMARY KEY (product_id, supplier_id)
);

-- analytics.events
CREATE TABLE analytics.events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- analytics.daily_stats
CREATE TABLE analytics.daily_stats (
    stat_date DATE PRIMARY KEY,
    page_views INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,
    signups INT NOT NULL DEFAULT 0
);

-- Seed inventory.suppliers
INSERT INTO inventory.suppliers (name, contact_email, country) VALUES
    ('Acme Parts Co.', 'sales@acmeparts.com', 'US'),
    ('GlobalTech Supply', 'info@globaltech.eu', 'DE'),
    ('Sakura Electronics', 'orders@sakura-el.jp', 'JP')
ON CONFLICT DO NOTHING;

-- Seed inventory.products
INSERT INTO inventory.products (name, sku, price, stock) VALUES
    ('Widget A',       'WGT-001', 12.99,  150),
    ('Widget B',       'WGT-002', 24.50,   73),
    ('Gizmo Pro',      'GZM-001', 89.00,   20),
    ('Thingamajig XL', 'THG-001',  5.75, 1200),
    ('Doohickey Mini', 'DHK-001', 34.00,   42)
ON CONFLICT DO NOTHING;

-- Seed inventory.product_suppliers
INSERT INTO inventory.product_suppliers (product_id, supplier_id) VALUES
    (1, 1), (1, 2),
    (2, 1),
    (3, 3),
    (4, 2), (4, 3),
    (5, 1)
ON CONFLICT DO NOTHING;

-- Seed analytics.events
INSERT INTO analytics.events (event_type, payload, occurred_at) VALUES
    ('page_view',  '{"path": "/", "referrer": "google.com"}',        '2025-02-01 08:12:00'),
    ('signup',     '{"plan": "free"}',                                '2025-02-01 09:34:00'),
    ('purchase',   '{"product_id": 1, "qty": 2, "total": 25.98}',    '2025-02-01 11:05:00'),
    ('page_view',  '{"path": "/pricing", "referrer": "twitter.com"}', '2025-02-02 14:22:00'),
    ('signup',     '{"plan": "pro"}',                                 '2025-02-02 16:45:00'),
    ('page_view',  '{"path": "/docs", "referrer": null}',            '2025-02-03 07:00:00')
ON CONFLICT DO NOTHING;

-- Seed analytics.daily_stats
INSERT INTO analytics.daily_stats (stat_date, page_views, unique_visitors, signups) VALUES
    ('2025-02-01', 1024, 870,  12),
    ('2025-02-02',  890, 720,   8),
    ('2025-02-03', 1150, 980,  15),
    ('2025-02-04',  760, 610,   5),
    ('2025-02-05', 1300, 1100, 22)
ON CONFLICT DO NOTHING;
