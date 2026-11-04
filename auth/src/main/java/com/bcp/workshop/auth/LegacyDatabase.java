package com.bcp.workshop.auth;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@ApplicationScoped
public class LegacyDatabase {
    @ConfigProperty(name = "auth.db.url", defaultValue = "jdbc:sqlite:./data/workshop.db")
    String dbUrl;

    @Inject
    PasswordHasher passwordHasher;

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(Path.of("data"));
            try (Connection connection = DriverManager.getConnection(dbUrl)) {
                connection.setAutoCommit(false);
                try {
                    createUsersTable(connection);
                    migrateLegacyPasswords(connection, passwordHasher);
                    seedUser(connection, "student", "Workshop123!", "Workshop Student", "STUDENT");
                    seedUser(connection, "trainer", "Trainer123!", "Workshop Trainer", "TRAINER");
                    connection.commit();
                } catch (Exception error) {
                    connection.rollback();
                    throw error;
                }
            }
        } catch (Exception error) {
            error.printStackTrace();
        }
    }

    public StoredUserRecord findByUsername(String username) {
        try (Connection connection = DriverManager.getConnection(dbUrl)) {
            return findByUsername(connection, username);
        } catch (SQLException error) {
            error.printStackTrace();
            return null;
        }
    }

    static StoredUserRecord findByUsername(Connection connection, String username) {
        String sql = "SELECT id, username, password_hash, display_name, role FROM legacy_users WHERE username=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    return null;
                }
                return new StoredUserRecord(
                        result.getLong("id"),
                        result.getString("username"),
                        result.getString("password_hash"),
                        result.getString("display_name"),
                        result.getString("role"));
            }
        } catch (SQLException error) {
            error.printStackTrace();
            return null;
        }
    }

    private void createUsersTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE IF NOT EXISTS legacy_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL)");
        }
    }

    static void migrateLegacyPasswords(Connection connection, PasswordHasher hasher) throws SQLException {
        Set<String> columns = getUserColumns(connection);
        if (!columns.contains("password")) {
            return;
        }
        if (!columns.contains("password_hash")) {
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate("ALTER TABLE legacy_users ADD COLUMN password_hash TEXT");
            }
        }

        List<LegacyPassword> legacyPasswords = readLegacyPasswords(connection);
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE legacy_users SET password_hash=? WHERE id=?")) {
            for (LegacyPassword legacyPassword : legacyPasswords) {
                if (hasher.isEncodedHash(legacyPassword.passwordHash())) {
                    continue;
                }
                String plainPassword = legacyPassword.password();
                if (plainPassword == null) {
                    throw new SQLException("Legacy user has no password to migrate");
                }
                String encodedHash = hasher.isEncodedHash(plainPassword)
                        ? plainPassword
                        : hasher.hash(plainPassword);
                update.setString(1, encodedHash);
                update.setLong(2, legacyPassword.id());
                update.executeUpdate();
            }
        }
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE legacy_users DROP COLUMN password");
        }
    }

    private static Set<String> getUserColumns(Connection connection) throws SQLException {
        Set<String> columns = new HashSet<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(legacy_users)")) {
            while (result.next()) {
                columns.add(result.getString("name"));
            }
        }
        return columns;
    }

    private static List<LegacyPassword> readLegacyPasswords(Connection connection) throws SQLException {
        List<LegacyPassword> passwords = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT id, password, password_hash FROM legacy_users")) {
            while (result.next()) {
                passwords.add(new LegacyPassword(
                        result.getLong("id"),
                        result.getString("password"),
                        result.getString("password_hash")));
            }
        }
        return passwords;
    }

    private void seedUser(
            Connection connection,
            String username,
            String password,
            String displayName,
            String role) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
                "SELECT 1 FROM legacy_users WHERE username=?")) {
            query.setString(1, username);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    return;
                }
            }
        }

        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO legacy_users(username, password_hash, display_name, role) VALUES (?, ?, ?, ?)")) {
            insert.setString(1, username);
            insert.setString(2, passwordHasher.hash(password));
            insert.setString(3, displayName);
            insert.setString(4, role);
            insert.executeUpdate();
        }
    }

    private record LegacyPassword(long id, String password, String passwordHash) {}
}
