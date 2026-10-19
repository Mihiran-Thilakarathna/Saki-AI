-- Sign in with Google: Google-only accounts have no password, and are matched by Google's stable subject id.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_subject VARCHAR(64);
ALTER TABLE users ADD CONSTRAINT uk_users_google_subject UNIQUE (google_subject);
