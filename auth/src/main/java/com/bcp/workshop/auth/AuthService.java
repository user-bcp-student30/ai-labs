package com.bcp.workshop.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class AuthService {
    @Inject
    LegacyDatabase database;

    @Inject
    PasswordHasher passwordHasher;

    public UserRecord authenticate(String username, String password) {
        StoredUserRecord storedUser = database.findByUsername(username);
        if (storedUser == null || !passwordHasher.verify(password, storedUser.passwordHash())) {
            return null;
        }
        return new UserRecord(
                storedUser.id(),
                storedUser.username(),
                storedUser.displayName(),
                storedUser.role());
    }
}
