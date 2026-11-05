# Spec Delta

## Purpose

Define the observable login behavior for valid and invalid credentials, including protection against attempts to bypass authentication with crafted credential values.

## ADDED Requirements

### Requirement: Valid workshop credentials preserve the login response
The login endpoint SHALL continue to authenticate the workshop student credentials and return the established successful response.

#### Scenario: Student login succeeds
- **WHEN** a client submits `student` and `Workshop123!` to `POST /auth/login`
- **THEN** the endpoint returns HTTP 200 with `user.username` equal to `student`, a non-null `token`, `expiresIn` equal to 3600, `user.displayName` equal to `Workshop Student`, `user.role` equal to `STUDENT`, and `debug` equal to `authenticated-with-legacy-flow`

### Requirement: Invalid credentials do not authenticate
The login endpoint SHALL reject credentials that do not authenticate a user and SHALL NOT issue a token for the rejected request.

#### Scenario: Incorrect password is rejected
- **WHEN** a client submits `student` with an incorrect password to `POST /auth/login`
- **THEN** the endpoint returns HTTP 401 with the existing invalid-credentials message and no token

### Requirement: Crafted credential values cannot bypass authentication
Credential values that resemble SQL conditions SHALL be treated as credential input and SHALL NOT grant access or produce an authentication token.

#### Scenario: Injection-like username is rejected
- **WHEN** a client submits `' OR '1'='1` as the username to `POST /auth/login`
- **THEN** the endpoint returns HTTP 401 and the response has no `token`

#### Scenario: Injection-like password is rejected
- **WHEN** a client submits `' OR '1'='1` as the password to `POST /auth/login`
- **THEN** the endpoint returns HTTP 401 and the response has no `token`

### Requirement: Required login fields remain enforced
The login endpoint SHALL continue to reject a null request or missing and blank credential fields.

#### Scenario: Null request is rejected
- **WHEN** a client submits a null request body to `POST /auth/login`
- **THEN** the endpoint returns HTTP 400

#### Scenario: Blank username or password is rejected
- **WHEN** a client submits a blank username or a blank password to `POST /auth/login`
- **THEN** the endpoint returns HTTP 400 with the message identifying the required field