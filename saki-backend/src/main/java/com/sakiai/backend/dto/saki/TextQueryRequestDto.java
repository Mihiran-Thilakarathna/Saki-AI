package com.sakiai.backend.dto.saki;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record TextQueryRequestDto(
        @NotNull UUID sessionId,
        @NotBlank @Size(max = 4000) String query,
        @Size(max = 200_000) String currentEditorCode,
        @Size(max = 40) String programmingLanguage,
        @Size(max = 64) String clientId
) {
}
