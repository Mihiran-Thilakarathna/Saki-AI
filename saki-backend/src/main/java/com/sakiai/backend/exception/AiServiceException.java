package com.sakiai.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Raised when the Gemini brain is unavailable, misconfigured, blocked the request,
 * or returned something that does not satisfy the Saki JSON contract.
 */
public class AiServiceException extends ApiException {

    public AiServiceException(HttpStatus status, String errorCode, String message) {
        super(status, errorCode, message);
    }

    public AiServiceException(HttpStatus status, String errorCode, String message, Throwable cause) {
        super(status, errorCode, message, cause);
    }

    public static AiServiceException notConfigured() {
        return new AiServiceException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                "Saki's AI brain is not configured. Set GEMINI_API_KEY on the backend.");
    }

    public static AiServiceException upstream(String message, Throwable cause) {
        return new AiServiceException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_ERROR", message, cause);
    }

    public static AiServiceException invalidResponse(String message, Throwable cause) {
        return new AiServiceException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", message, cause);
    }

    public static AiServiceException blocked(String reason) {
        return new AiServiceException(HttpStatus.UNPROCESSABLE_ENTITY, "AI_BLOCKED",
                "Saki could not answer this request (" + reason + "). Please rephrase and try again.");
    }
}
