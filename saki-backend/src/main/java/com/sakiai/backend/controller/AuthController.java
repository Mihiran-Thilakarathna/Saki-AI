package com.sakiai.backend.controller;

import com.sakiai.backend.dto.auth.AuthProvidersDto;
import com.sakiai.backend.dto.auth.AuthResponseDto;
import com.sakiai.backend.dto.auth.GoogleLoginRequestDto;
import com.sakiai.backend.dto.auth.LoginRequestDto;
import com.sakiai.backend.dto.auth.RegisterRequestDto;
import com.sakiai.backend.dto.auth.UserProfileDto;
import com.sakiai.backend.security.SakiUserPrincipal;
import com.sakiai.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponseDto register(@Valid @RequestBody RegisterRequestDto request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponseDto login(@Valid @RequestBody LoginRequestDto request) {
        return authService.login(request);
    }

    @PostMapping("/google")
    public AuthResponseDto google(@Valid @RequestBody GoogleLoginRequestDto request) {
        return authService.loginWithGoogle(request);
    }

    @GetMapping("/providers")
    public AuthProvidersDto providers() {
        return authService.providers();
    }

    @GetMapping("/me")
    public UserProfileDto me(@AuthenticationPrincipal SakiUserPrincipal principal) {
        return authService.profile(principal.id());
    }
}
