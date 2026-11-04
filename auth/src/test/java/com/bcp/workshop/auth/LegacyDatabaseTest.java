package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LegacyDatabaseTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void findsUsernameContainingSqlPunctuationAsLiteral() throws Exception {
        Class.forName("org.sqlite.JDBC");
        String databaseUrl = "jdbc:sqlite:" + temporaryDirectory.resolve("auth-test.db");
        try (Connection connection = DriverManager.getConnection(databaseUrl);
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE legacy_users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL)");
            statement.executeUpdate("INSERT INTO legacy_users VALUES (1, 'o''brien', 'encoded-hash', 'Test User', 'STUDENT')");

            StoredUserRecord user = LegacyDatabase.findByUsername(connection, "o'brien");

            assertNotNull(user);
            assertEquals("o'brien", user.username());
            assertEquals("Test User", user.displayName());
            assertNull(LegacyDatabase.findByUsername(connection, "unknown"));
        }
    }

    @Test
    void migratesLegacyPasswordsOnceAndRemovesPlaintextColumn() throws Exception {
        Class.forName("org.sqlite.JDBC");
        String databaseUrl = "jdbc:sqlite:" + temporaryDirectory.resolve("legacy-auth.db");
        PasswordHasher passwordHasher = new PasswordHasher();
        try (Connection connection = DriverManager.getConnection(databaseUrl);
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE legacy_users (id INTEGER PRIMARY KEY, username TEXT, password TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL)");
            statement.executeUpdate("INSERT INTO legacy_users VALUES (1, 'student', 'test-password', 'Test User', 'STUDENT')");

            connection.setAutoCommit(false);
            LegacyDatabase.migrateLegacyPasswords(connection, passwordHasher);
            String firstHash = readPasswordHash(connection);
            LegacyDatabase.migrateLegacyPasswords(connection, passwordHasher);
            String secondHash = readPasswordHash(connection);

            assertTrue(passwordHasher.verify("test-password", firstHash));
            assertEquals(firstHash, secondHash);
            assertFalse(userColumns(connection).contains("password"));
        }
    }

    @Test
    void preservesHashesWhenResumingAnInterruptedMigration() throws Exception {
        Class.forName("org.sqlite.JDBC");
        String databaseUrl = "jdbc:sqlite:" + temporaryDirectory.resolve("partial-migration.db");
        PasswordHasher passwordHasher = new PasswordHasher();
        String existingHash = passwordHasher.hash("test-password");
        try (Connection connection = DriverManager.getConnection(databaseUrl);
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE legacy_users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, password_hash TEXT, display_name TEXT NOT NULL, role TEXT NOT NULL)");
        }

        try (Connection connection = DriverManager.getConnection(databaseUrl);
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO legacy_users VALUES (?, ?, ?, ?, ?, ?)")) {
            insert.setLong(1, 1);
            insert.setString(2, "student");
            insert.setString(3, "legacy-password");
            insert.setString(4, existingHash);
            insert.setString(5, "Test User");
            insert.setString(6, "STUDENT");
            insert.executeUpdate();
            insert.setLong(1, 2);
            insert.setString(2, "trainer");
            insert.setString(3, existingHash);
            insert.setString(4, null);
            insert.setString(5, "Test Trainer");
            insert.setString(6, "TRAINER");
            insert.executeUpdate();
        }

        try (Connection connection = DriverManager.getConnection(databaseUrl)) {
            connection.setAutoCommit(false);
            LegacyDatabase.migrateLegacyPasswords(connection, passwordHasher);

            assertEquals(existingHash, readPasswordHash(connection, 1));
            assertEquals(existingHash, readPasswordHash(connection, 2));
            assertFalse(userColumns(connection).contains("password"));
        }
    }

    private static String readPasswordHash(Connection connection) throws Exception {
        return readPasswordHash(connection, 1);
    }

    private static String readPasswordHash(Connection connection, long userId) throws Exception {
        try (PreparedStatement query = connection.prepareStatement(
                "SELECT password_hash FROM legacy_users WHERE id=?")) {
            query.setLong(1, userId);
            try (ResultSet result = query.executeQuery()) {
                result.next();
                return result.getString("password_hash");
            }
        }
    }

    private static Set<String> userColumns(Connection connection) throws Exception {
        Set<String> columns = new HashSet<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(legacy_users)")) {
            while (result.next()) {
                columns.add(result.getString("name"));
            }
        }
        return columns;
    }
}
