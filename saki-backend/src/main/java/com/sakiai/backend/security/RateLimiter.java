package com.sakiai.backend.security;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory fixed-window counters keyed by e.g. "auth:203.0.113.7" or "ai-day:&lt;userId&gt;".
 * One backend instance is enough for Saki's scale; counters reset on restart, which only
 * ever makes the limit more lenient. Memory is bounded by pruning expired windows.
 */
public class RateLimiter {

    private static final int PRUNE_THRESHOLD = 10_000;

    private record Window(long startMillis, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Counts one request for {@code key}. Returns 0 when it is allowed, otherwise the
     * number of seconds until the window resets (for the Retry-After header).
     */
    public long tryAcquire(String key, int limit, Duration window) {
        long now = clock.millis();
        long windowMillis = window.toMillis();
        if (windows.size() > PRUNE_THRESHOLD) {
            windows.values().removeIf(w -> now - w.startMillis() >= windowMillis * 24);
        }
        Window updated = windows.compute(key, (k, current) -> {
            if (current == null || now - current.startMillis() >= windowMillis) {
                return new Window(now, 1);
            }
            return new Window(current.startMillis(), current.count() + 1);
        });
        if (updated.count() <= limit) {
            return 0;
        }
        long remaining = windowMillis - (now - updated.startMillis());
        return Math.max(1, (remaining + 999) / 1000);
    }
}
