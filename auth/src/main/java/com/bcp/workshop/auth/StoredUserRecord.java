package com.bcp.workshop.auth;

public record StoredUserRecord(long id, String username, String passwordHash, String displayName, String role) {}
