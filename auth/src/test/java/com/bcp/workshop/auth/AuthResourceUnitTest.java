package com.bcp.workshop.auth;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthResourceUnitTest {
    @Test
    void returnsServerErrorWhenAuthenticationThrows() {
        AuthResource resource = resourceThrowing(new IllegalStateException("authentication failure"));

        Response response = resource.login(loginRequest());

        assertEquals(500, response.getStatus());
    }

    @Test
    void returnsServerErrorWhenExceptionHasNoMessage() {
        AuthResource resource = resourceThrowing(new IllegalStateException());

        Response response = resource.login(loginRequest());

        assertEquals(500, response.getStatus());
    }

    private static AuthResource resourceThrowing(RuntimeException exception) {
        AuthResource resource = new AuthResource();
        resource.authService = new AuthService() {
            @Override
            public UserRecord authenticate(String username, String password) {
                throw exception;
            }
        };
        return resource;
    }

    private static LoginRequest loginRequest() {
        LoginRequest request = new LoginRequest();
        request.username = "student";
        request.password = "test-password";
        return request;
    }
}
