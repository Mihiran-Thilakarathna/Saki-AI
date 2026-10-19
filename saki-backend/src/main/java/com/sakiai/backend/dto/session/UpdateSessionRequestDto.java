package com.sakiai.backend.dto.session;

import jakarta.validation.constraints.Size;

/**
 * Partial update; null fields are left unchanged. Used by the Web IDE to rename a
 * session or to persist the editor buffer after the user edits code manually.
 */
public record UpdateSessionRequestDto(
        @Size(min = 1, max = 160) String title,
        @Size(max = 40) String activeLanguage,
        @Size(max = 200_000) String currentCodeContext
) {
}
