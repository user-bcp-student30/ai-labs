package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.Map;

public class JwtTestProfile implements QuarkusTestProfile {
    private static final KeyPair KEY_PAIR = generateKeyPair();
    private static final Path PRIVATE_KEY_FILE = writePrivateKey(KEY_PAIR);

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("smallrye.jwt.sign.key.location", PRIVATE_KEY_FILE.toString());
    }

    static java.security.PublicKey publicKey() {
        return KEY_PAIR.getPublic();
    }

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private static Path writePrivateKey(KeyPair keyPair) {
        try {
            Path keyFile = Files.createTempFile("auth-test-signing-key", ".pem");
            String encodedKey = Base64.getMimeEncoder(64, new byte[]{'\n'})
                    .encodeToString(keyPair.getPrivate().getEncoded());
            Files.writeString(keyFile, "-----BEGIN PRIVATE KEY-----\n" + encodedKey + "\n-----END PRIVATE KEY-----\n");
            keyFile.toFile().deleteOnExit();
            return keyFile;
        } catch (IOException error) {
            throw new ExceptionInInitializerError(error);
        }
    }
}