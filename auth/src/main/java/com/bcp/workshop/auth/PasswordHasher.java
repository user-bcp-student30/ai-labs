package com.bcp.workshop.auth;

import jakarta.enterprise.context.ApplicationScoped;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.Objects;

@ApplicationScoped
public class PasswordHasher {
    private static final String HASH_SCHEME = "pbkdf2-sha256";
    private static final int ITERATION_COUNT = 600_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int HASH_LENGTH_BITS = 256;
    private static final int HASH_LENGTH_BYTES = HASH_LENGTH_BITS / Byte.SIZE;

    private final SecureRandom secureRandom = new SecureRandom();

    public String hash(String password) {
        Objects.requireNonNull(password, "password");
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        secureRandom.nextBytes(salt);
        byte[] derivedKey = deriveKey(password, salt);
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        return String.join("$",
                HASH_SCHEME,
                Integer.toString(ITERATION_COUNT),
                encoder.encodeToString(salt),
                encoder.encodeToString(derivedKey));
    }

    public boolean verify(String password, String encodedHash) {
        PasswordHash passwordHash = parse(encodedHash);
        if (password == null || passwordHash == null) {
            return false;
        }
        return MessageDigest.isEqual(passwordHash.derivedKey(), deriveKey(password, passwordHash.salt()));
    }

    public boolean isEncodedHash(String encodedHash) {
        return parse(encodedHash) != null;
    }

    private byte[] deriveKey(String password, byte[] salt) {
        char[] passwordCharacters = password.toCharArray();
        PBEKeySpec keySpec = new PBEKeySpec(passwordCharacters, salt, ITERATION_COUNT, HASH_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(keySpec)
                    .getEncoded();
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("PBKDF2WithHmacSHA256 is unavailable", error);
        } finally {
            keySpec.clearPassword();
            Arrays.fill(passwordCharacters, '\0');
        }
    }

    private PasswordHash parse(String encodedHash) {
        if (encodedHash == null) {
            return null;
        }
        String[] parts = encodedHash.split("\\$", -1);
        if (parts.length != 4 || !HASH_SCHEME.equals(parts[0])) {
            return null;
        }
        try {
            if (Integer.parseInt(parts[1]) != ITERATION_COUNT) {
                return null;
            }
            Base64.Decoder decoder = Base64.getUrlDecoder();
            byte[] salt = decoder.decode(parts[2]);
            byte[] derivedKey = decoder.decode(parts[3]);
            if (salt.length != SALT_LENGTH_BYTES || derivedKey.length != HASH_LENGTH_BYTES) {
                return null;
            }
            return new PasswordHash(salt, derivedKey);
        } catch (IllegalArgumentException error) {
            return null;
        }
    }

    private record PasswordHash(byte[] salt, byte[] derivedKey) {}
}
