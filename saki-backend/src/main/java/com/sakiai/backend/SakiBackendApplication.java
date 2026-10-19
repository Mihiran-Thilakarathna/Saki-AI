package com.sakiai.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// Saki authenticates with its own JWTs; skip Boot's default in-memory user (and its logged password).
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class SakiBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(SakiBackendApplication.class, args);
    }
}
