package com.sakiai.backend.security;

import java.security.Principal;
import java.util.UUID;

/**
 * Authenticated identity reconstructed from a verified JWT. Inject into
 * controllers with {@code @AuthenticationPrincipal SakiUserPrincipal user}.
 * {@link #getName()} returns the user id so STOMP user destinations are keyed by id.
 */
public record SakiUserPrincipal(UUID id, String email, String fullName) implements Principal {

    @Override
    public String getName() {
        return id.toString();
    }
}
