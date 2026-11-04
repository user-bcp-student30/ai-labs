package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
@TestProfile(JwtTestProfile.class)
class AuthResourceTest {
    @Test
    void logsInWithWorkshopUser() {
        given()
                .contentType("application/json")
                .body("{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}")
                .when().post("/auth/login")
                .then()
                .statusCode(200)
                .body("expiresIn", is(3600))
                .body("user.username", is("student"))
                .body("user.displayName", is("Workshop Student"))
                .body("user.role", is("STUDENT"))
                .body("debug", is("authenticated-with-legacy-flow"))
                .body("token", notNullValue());
    }

        @Test
        void emitsSignedTokenWithIdentityRoleAndOneHourLifetime() throws Exception {
                String token = loginAndGetToken();
                String[] segments = token.split("\\.");
                assertEquals(3, segments.length);

                JsonNode header = new ObjectMapper().readTree(Base64.getUrlDecoder().decode(segments[0]));
                JsonNode claims = new ObjectMapper().readTree(Base64.getUrlDecoder().decode(segments[1]));
                assertEquals("RS256", header.get("alg").asText());
                assertEquals("student", claims.get("sub").asText());
                assertEquals("STUDENT", claims.get("role").asText());
                assertEquals(3600, claims.get("exp").asLong() - claims.get("iat").asLong());
                assertTrue(verifiesSignature(token));
        }

        @Test
        void rejectsModifiedTokenSignature() throws Exception {
                String[] segments = loginAndGetToken().split("\\.");
                byte[] signature = Base64.getUrlDecoder().decode(segments[2]);
                signature[0] ^= 1;
                segments[2] = Base64.getUrlEncoder().withoutPadding().encodeToString(signature);

                assertFalse(verifiesSignature(String.join(".", segments)));
        }

    @Test
    void rejectsIncorrectPassword() {
        given()
                .contentType("application/json")
                .body("{\"username\":\"student\",\"password\":\"incorrect\"}")
                .when().post("/auth/login")
                .then()
                .statusCode(401)
                .body("message", is("Invalid user student or password"));
    }

    @Test
    void rejectsNullOrBlankLoginFields() {
        given()
                .contentType("application/json")
                .body("null")
                .when().post("/auth/login")
                .then()
                .statusCode(400);

        given()
                .contentType("application/json")
                .body("{\"username\":\" \",\"password\":\"Workshop123!\"}")
                .when().post("/auth/login")
                .then()
                .statusCode(400)
                .body("message", is("Username is required"));

        given()
                .contentType("application/json")
                .body("{\"username\":\"student\",\"password\":\" \"}")
                .when().post("/auth/login")
                .then()
                .statusCode(400)
                .body("message", is("Password is required"));
    }

        private static String loginAndGetToken() {
                return given()
                                .contentType("application/json")
                                .body("{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}")
                                .when().post("/auth/login")
                                .then()
                                .statusCode(200)
                                .extract()
                                .path("token");
        }

        private static boolean verifiesSignature(String token) throws Exception {
                String[] segments = token.split("\\.");
                Signature verifier = Signature.getInstance("SHA256withRSA");
                verifier.initVerify(JwtTestProfile.publicKey());
                verifier.update((segments[0] + "." + segments[1]).getBytes(StandardCharsets.US_ASCII));
                return verifier.verify(Base64.getUrlDecoder().decode(segments[2]));
        }
}
