package com.sakiai.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.config.RateLimitProperties;
import com.sakiai.backend.exception.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Set;

/**
 * Rejects abusive traffic before it reaches controllers:
 * <ul>
 *   <li>brute force / sign-up spam: auth endpoints are limited per client IP</li>
 *   <li>AI quota draining: questions are limited per user per minute and per day</li>
 *   <li>storage spam: session writes are limited per user</li>
 *   <li>memory exhaustion: oversized JSON bodies are refused (413)</li>
 * </ul>
 * Runs after JWT authentication so per-user limits use the verified user id, never a
 * client-supplied value. The client IP comes from the reverse proxy via Tomcat's
 * RemoteIpValve ({@code server.forward-headers-strategy=native}), so it cannot be spoofed.
 */
@Slf4j
@Component
public class AbuseProtectionFilter extends OncePerRequestFilter {

    private static final String API = "/api/v1/";
    private static final Set<String> AUTH_PATHS =
            Set.of("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/google");
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final RateLimitProperties limits;
    private final ObjectMapper objectMapper;
    private final RateLimiter limiter;

    @Autowired
    public AbuseProtectionFilter(RateLimitProperties limits, ObjectMapper objectMapper) {
        this(limits, objectMapper, new RateLimiter(Clock.systemUTC()));
    }

    AbuseProtectionFilter(RateLimitProperties limits, ObjectMapper objectMapper, RateLimiter limiter) {
        this.limits = limits;
        this.objectMapper = objectMapper;
        this.limiter = limiter;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith(API);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        boolean multipart = request.getContentType() != null
                && request.getContentType().toLowerCase().startsWith(MediaType.MULTIPART_FORM_DATA_VALUE);
        if (!multipart && request.getContentLengthLong() > limits.maxJsonBodyBytes()) {
            reject(response, HttpStatus.PAYLOAD_TOO_LARGE, "REQUEST_TOO_LARGE", "The request is too large.", 0);
            return;
        }

        if (limits.enabled()) {
            long retryAfter = check(request);
            if (retryAfter > 0) {
                log.warn("Rate limit hit for {} {} from {}", request.getMethod(), request.getRequestURI(),
                        request.getRemoteAddr());
                reject(response, HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                        "Too many requests. Please wait a moment and try again.", retryAfter);
                return;
            }
        }

        // Chunked bodies have no Content-Length: enforce the limit while reading.
        HttpServletRequest guarded = multipart ? request : new SizeLimitedRequest(request, limits.maxJsonBodyBytes());
        chain.doFilter(guarded, response);
    }

    private long check(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if ("POST".equals(method) && AUTH_PATHS.contains(path)) {
            return limiter.tryAcquire("auth:" + request.getRemoteAddr(), limits.authPerMinute(), Duration.ofMinutes(1));
        }
        String user = currentUserId();
        if (user == null || !WRITE_METHODS.contains(method)) {
            return 0;
        }
        if (path.startsWith("/api/v1/saki/")) {
            long minute = limiter.tryAcquire("ai-min:" + user, limits.aiPerMinute(), Duration.ofMinutes(1));
            if (minute > 0) {
                return minute;
            }
            return limiter.tryAcquire("ai-day:" + user, limits.aiPerDay(), Duration.ofDays(1));
        }
        if (path.startsWith("/api/v1/sessions")) {
            return limiter.tryAcquire("write:" + user, limits.writesPerMinute(), Duration.ofMinutes(1));
        }
        return 0;
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof SakiUserPrincipal principal
                ? principal.id().toString()
                : null;
    }

    private void reject(HttpServletResponse response, HttpStatus status, String code, String message,
                        long retryAfterSeconds) throws IOException {
        ProblemDetail detail = GlobalExceptionHandler.problem(status, code, message);
        response.setStatus(status.value());
        if (retryAfterSeconds > 0) {
            response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        }
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), detail);
    }

    /** Fails the read once more than {@code maxBytes} have been consumed. */
    private static final class SizeLimitedRequest extends HttpServletRequestWrapper {
        private final long maxBytes;
        private ServletInputStream stream;

        SizeLimitedRequest(HttpServletRequest request, long maxBytes) {
            super(request);
            this.maxBytes = maxBytes;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (stream == null) {
                ServletInputStream delegate = super.getInputStream();
                stream = new ServletInputStream() {
                    private long read;

                    @Override
                    public int read() throws IOException {
                        int b = delegate.read();
                        if (b >= 0) {
                            count(1);
                        }
                        return b;
                    }

                    @Override
                    public int read(byte[] buffer, int offset, int length) throws IOException {
                        int n = delegate.read(buffer, offset, length);
                        if (n > 0) {
                            count(n);
                        }
                        return n;
                    }

                    private void count(int n) throws IOException {
                        read += n;
                        if (read > maxBytes) {
                            throw new IOException("Request body exceeds " + maxBytes + " bytes");
                        }
                    }

                    @Override
                    public boolean isFinished() {
                        return delegate.isFinished();
                    }

                    @Override
                    public boolean isReady() {
                        return delegate.isReady();
                    }

                    @Override
                    public void setReadListener(ReadListener listener) {
                        delegate.setReadListener(listener);
                    }
                };
            }
            return stream;
        }
    }
}
