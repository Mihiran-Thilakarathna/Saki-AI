package com.sakiai.backend.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base class for errors that map directly to an HTTP status and a stable,
 * machine-readable error code the Web and Flutter clients can switch on.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public ApiException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public ApiException(HttpStatus status, String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.errorCode = errorCode;
    }
}
