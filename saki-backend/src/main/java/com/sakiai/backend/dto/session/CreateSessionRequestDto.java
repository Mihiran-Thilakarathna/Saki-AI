package com.sakiai.backend.dto.session;

import jakarta.validation.constraints.Size;

public record CreateSessionRequestDto(
        @Size(max = 160) String title,
        @Size(max = 40) String activeLanguage
) {
}
