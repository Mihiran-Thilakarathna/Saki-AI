CREATE TABLE users (
    id                 UUID PRIMARY KEY,
    full_name          VARCHAR(120) NOT NULL,
    email              VARCHAR(255) NOT NULL,
    password_hash      VARCHAR(100) NOT NULL,
    preferred_language VARCHAR(10)  NOT NULL DEFAULT 'si-LK',
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE coding_sessions (
    id                   UUID PRIMARY KEY,
    user_id              UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title                VARCHAR(160) NOT NULL,
    active_language      VARCHAR(40),
    current_code_context TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_coding_sessions_user_updated ON coding_sessions (user_id, updated_at DESC);

CREATE TABLE conversation_messages (
    id                   UUID PRIMARY KEY,
    session_id           UUID        NOT NULL REFERENCES coding_sessions (id) ON DELETE CASCADE,
    sender_role          VARCHAR(10) NOT NULL CHECK (sender_role IN ('USER', 'SAKI')),
    user_transcript      TEXT,
    detected_language    VARCHAR(10),
    spoken_response      TEXT,
    code_snippet         TEXT,
    programming_language VARCHAR(40),
    file_name            VARCHAR(255),
    explanation_markdown TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_messages_session_created ON conversation_messages (session_id, created_at);
