package com.sakiai.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** A Google ID token from Google Identity Services (web) or google_sign_in (Flutter). */
public record GoogleLoginRequestDto(
        @NotBlank @Size(max = 4096) String idToken,
        /* Used only when this sign-in creates a new account. */
        @Pattern(regexp = "si-LK|en-US", message = "preferredLanguage must be si-LK or en-US") String preferredLanguage
) {
}
