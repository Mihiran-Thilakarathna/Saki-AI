-- Saki's spoken answers (MP3), kept so they can be played again after a reload or on another device.
-- Deleted together with their message (and so with the chat).
CREATE TABLE message_audio (
    message_id UUID        PRIMARY KEY REFERENCES conversation_messages (id) ON DELETE CASCADE,
    mime_type  VARCHAR(40) NOT NULL,
    audio      BYTEA       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
