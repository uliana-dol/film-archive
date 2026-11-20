require('dotenv').config();
const pool=require('./config/db');
(async()=>{
  await pool.query(`CREATE TABLE IF NOT EXISTS media_jobs (
    job_id CHAR(36) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    state ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
    media_id INT DEFAULT NULL,
    error_text VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_jobs_user (user_id),
    CONSTRAINT fk_media_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS idempotency_records (
    user_id INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json TEXT DEFAULT NULL,
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id,idempotency_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  console.log('Migration complete');
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1);});
