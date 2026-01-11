CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('video', 'photo')),
    title TEXT NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    thumbnail_url TEXT,
    cached BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_downloads_url ON downloads(url);
CREATE INDEX idx_downloads_cached ON downloads(cached);
CREATE INDEX idx_downloads_created_at ON downloads(created_at DESC);

CREATE TABLE IF NOT EXISTS bot_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    downloads_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bot_users_telegram_id ON bot_users(telegram_id);

CREATE TABLE IF NOT EXISTS user_downloads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES bot_users(id),
    download_id INTEGER REFERENCES downloads(id),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_downloads_user_id ON user_downloads(user_id);
CREATE INDEX idx_user_downloads_download_id ON user_downloads(download_id);