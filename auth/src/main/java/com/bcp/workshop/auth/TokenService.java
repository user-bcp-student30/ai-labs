package com.bcp.workshop.auth;

import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;

@ApplicationScoped
public class TokenService {
    private static final int TOKEN_LIFETIME_SECONDS = 3600;

    public IssuedToken issue(String username, String role) {
        long issuedAt = Instant.now().getEpochSecond();
        long expiresAt = issuedAt + TOKEN_LIFETIME_SECONDS;
        String token = Jwt.claims()
                .subject(username)
                .claim("role", role)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .sign();
        return new IssuedToken(token, TOKEN_LIFETIME_SECONDS);
    }

    public record IssuedToken(String value, int expiresIn) {}
}