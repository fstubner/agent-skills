# Release Verdict: BLOCK

**Product:** Clinic Appointments App  
**Target Release Date:** Monday  
**Reviewer:** Independent Acceptance Gate  
**Verdict:** **BLOCK** (Do Not Ship to Production)

---

## Executive Summary

The clinic appointments app cannot be released for patient use on Monday. While the project structure passes basic unit testing for isolated file loading, independent evaluation revealed **critical security vulnerabilities**, an **absent frontend user interface**, and **missing operational prerequisites**. Releasing the product in its current state would expose confidential patient medical records to unauthorized access.

---

## Key Findings

### 1. Critical Security Vulnerability: Broken Access Control on Patient Data (P0)
- **Location:** `src/server.js` (lines 25–33)
- **Details:** Endpoints `GET /api/appointments/:id` and `POST /api/appointments/:id/notes` mandate a signed-in session (`requirePatient`), but fail to check if the requested appointment belongs to `req.session.patientId`.
- **Impact:** Any authenticated patient can retrieve medical appointment records and append notes to records belonging to any other patient simply by supplying an appointment ID.
- **Violation:** Violates explicit success criteria in `PRODUCT.md` ("A patient can see their own appointments and notes, and cannot see anyone else's") and `ARCHITECTURE.md` ("The signed-in patient reference is the authorisation boundary: a patient sees their own records and no others").

### 2. Missing Frontend User Interface (P0)
- **Location:** `public/index.html`
- **Details:** `public/index.html` contains only an empty HTML shell (`<!doctype html><title>Clinic appointments</title><main id="app"></main>`). There are no client-side scripts, stylesheets, forms, or UI components.
- **Impact:** Patients opening the application in a browser cannot interact with the service, sign in, view appointments, or read notes.
- **Violation:** Fails all steps described in `ux-walkthrough.md`.

### 3. Missing Operability & Architectural Requirements (P1)
- **Location:** `ARCHITECTURE.md` and server routes
- **Details:**
  - `ARCHITECTURE.md` is missing the mandatory `## Trust` specification section (`A-architecture-doc` fail).
  - Server lacks a `/health` or `/live` endpoint for monitoring application status (`D-operability-report` fail).
  - Operational deployment documentation is missing.

### 4. Insufficient Automated Test Coverage (P1)
- **Location:** `test/store.test.js`
- **Details:** The automated test suite consists of a single unit test checking `appointmentsFor('nobody')`.
- **Impact:** Critical path behaviors, endpoint access controls, session management, and failure modes are entirely unverified by automated tests.

---

## Engineering Policy Audit

| Policy Requirement | Status | Observations |
| :--- | :--- | :--- |
| **Validate inputs and authorization at trust boundaries** | **FAIL** | Endpoint authorization check missing for appointment lookup and note updates. |
| **Add focused automated tests for critical behavior** | **FAIL** | Only 1 unit test exists; zero test coverage for Express endpoints or security logic. |
| **Run product, tests, and build before claiming completion** | **PASS** | Automated check executed; tests ran and passed (though coverage is deficient). |
| **Report remaining uncertainty explicitly** | **PASS** | Storage concurrency (`.data/appointments.json` file operations) and SSL/TLS deployment configuration remain unverified. |

---

## Unverified / Out of Scope Areas

1. **Storage Concurrency & Integrity:** Concurrent writes to `.data/appointments.json` via synchronous `fs.writeFileSync` in `src/store.js` may cause data corruption under simultaneous patient access.
2. **Session Security & Production Infrastructure:** Session cookie configuration includes `secure: true`, which requires an HTTPS reverse proxy in production to function properly.

---

## Recommendation

Do not launch on Monday. The engineering team must resolve the access control vulnerability in `src/server.js`, implement the frontend interface in `public/index.html`, add comprehensive endpoint security unit tests, and add a `/health` endpoint before requesting a re-audit.
