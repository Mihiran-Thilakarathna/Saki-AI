package com.sakiai.backend.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequestDto(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 72, message = "Password must be 8-72 characters") String password,
        @Pattern(regexp = "si-LK|en-US", message = "preferredLanguage must be si-LK or en-US") String preferredLanguage
) {
}
