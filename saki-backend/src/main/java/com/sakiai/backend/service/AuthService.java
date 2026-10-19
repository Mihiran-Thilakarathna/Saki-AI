package com.sakiai.backend.service;

import com.sakiai.backend.domain.SakiLanguage;
import com.sakiai.backend.domain.User;
import com.sakiai.backend.dto.auth.AuthProvidersDto;
import com.sakiai.backend.dto.auth.AuthResponseDto;
import com.sakiai.backend.dto.auth.GoogleLoginRequestDto;
import com.sakiai.backend.dto.auth.LoginRequestDto;
import com.sakiai.backend.dto.auth.RegisterRequestDto;
import com.sakiai.backend.dto.auth.UserProfileDto;
import com.sakiai.backend.exception.ConflictException;
import com.sakiai.backend.exception.ResourceNotFoundException;
import com.sakiai.backend.repository.UserRepository;
import com.sakiai.backend.security.GoogleIdTokenVerifier;
import com.sakiai.backend.security.GoogleIdTokenVerifier.GoogleIdentity;
import com.sakiai.backend.security.JwtService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    /** Hash of a random secret, used only to equalize login timing for unknown emails. */
    private String dummyPasswordHash;

    @PostConstruct
    void initDummyHash() {
        dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponseDto register(RegisterRequestDto request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("EMAIL_IN_USE", "An account with this email already exists");
        }
        User user = User.builder()
                .fullName(request.fullName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .preferredLanguage(request.preferredLanguage() == null
                        ? SakiLanguage.SINHALA
                        : request.preferredLanguage())
                .build();
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            // Lost a race with a concurrent registration for the same email.
            throw new ConflictException("EMAIL_IN_USE", "An account with this email already exists");
        }
        log.info("Registered new Saki user {}", user.getId());
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthResponseDto login(LoginRequestDto request) {
        Optional<User> user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.email()));
        if (user.isEmpty()) {
            // Spend comparable time to a real check so response timing does not reveal registered emails.
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            throw new BadCredentialsException("Invalid credentials");
        }
        String hash = user.get().getPasswordHash();
        if (hash == null) {
            // Google-only account: same timing and same error as a wrong password.
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            throw new BadCredentialsException("Invalid credentials");
        }
        if (!passwordEncoder.matches(request.password(), hash)) {
            throw new BadCredentialsException("Invalid credentials");
        }
        return issueToken(user.get());
    }

    /**
     * Signs in with a verified Google ID token. Matches the Google account first, then a
     * Saki account with the same (Google-verified) email, which gets linked; otherwise a
     * new password-less account is created.
     */
    @Transactional
    public AuthResponseDto loginWithGoogle(GoogleLoginRequestDto request) {
        GoogleIdentity google = googleIdTokenVerifier.verify(request.idToken());
        String email = normalizeEmail(google.email());

        User user = userRepository.findByGoogleSubject(google.subject())
                .or(() -> userRepository.findByEmailIgnoreCase(email).map(existing -> {
                    if (existing.getGoogleSubject() != null) {
                        // The email now belongs to a different Google account than the one linked.
                        throw new ConflictException("GOOGLE_ACCOUNT_MISMATCH",
                                "This email is linked to a different Google account");
                    }
                    existing.setGoogleSubject(google.subject());
                    log.info("Linked Google sign-in to existing Saki user {}", existing.getId());
                    return existing;
                }))
                .orElseGet(() -> createGoogleUser(google, email, request.preferredLanguage()));
        return issueToken(user);
    }

    public AuthProvidersDto providers() {
        boolean enabled = googleIdTokenVerifier.isEnabled();
        return new AuthProvidersDto(enabled, enabled ? googleIdTokenVerifier.clientId() : null);
    }

    private User createGoogleUser(GoogleIdentity google, String email, String preferredLanguage) {
        String name = google.name() == null || google.name().isBlank()
                ? email.substring(0, email.indexOf('@'))
                : google.name().trim();
        User user = User.builder()
                .fullName(name.length() > 120 ? name.substring(0, 120) : name)
                .email(email)
                .googleSubject(google.subject())
                .preferredLanguage(preferredLanguage == null ? SakiLanguage.SINHALA : preferredLanguage)
                .build();
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("EMAIL_IN_USE", "An account with this email already exists");
        }
        log.info("Registered new Saki user {} with Google", user.getId());
        return user;
    }

    @Transactional(readOnly = true)
    public UserProfileDto profile(UUID userId) {
        return userRepository.findById(userId)
                .map(UserProfileDto::from)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private AuthResponseDto issueToken(User user) {
        return AuthResponseDto.bearer(jwtService.generateToken(user), jwtService.expiresInSeconds(),
                UserProfileDto.from(user));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
