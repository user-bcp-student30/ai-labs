package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHasherTest {
    private final PasswordHasher passwordHasher = new PasswordHasher();

    @Test
    void hashesWithIndividualSaltAndVerifiesCredentials() {
        String firstHash = passwordHasher.hash("test-password");
        String secondHash = passwordHasher.hash("test-password");

        assertNotEquals(firstHash, secondHash);
        assertFalse(firstHash.contains("test-password"));
        assertTrue(passwordHasher.verify("test-password", firstHash));
        assertFalse(passwordHasher.verify("wrong-password", firstHash));
    }

    @Test
    void rejectsMalformedOrUnsupportedHashes() {
        assertFalse(passwordHasher.verify("test-password", "not-a-hash"));
        assertFalse(passwordHasher.verify("test-password", "pbkdf2-sha256$1$invalid$invalid"));
        assertFalse(passwordHasher.verify("test-password", "pbkdf2-sha256$bad-iterations$YQ$YQ"));
        assertFalse(passwordHasher.verify("test-password", "pbkdf2-sha256$600000$!$!"));
        assertFalse(passwordHasher.verify("test-password", "pbkdf2-sha256$600000$YQ$YQ"));
        assertFalse(passwordHasher.verify("test-password", null));
    }
}
