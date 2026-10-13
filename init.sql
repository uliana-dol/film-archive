CREATE DATABASE IF NOT EXISTS appdb;
USE appdb;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_tracker (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    watch_status VARCHAR(50) DEFAULT 'Plan to Watch',
    season_vibe VARCHAR(50) DEFAULT 'None',
    rating INT DEFAULT NULL,
    genre VARCHAR(100),
    release_year VARCHAR(10),
    country VARCHAR(100),
    duration VARCHAR(50),
    actors TEXT,
    plot TEXT,
    poster_url LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
