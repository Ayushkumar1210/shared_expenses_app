# Architectural Decision Log: Shared Expenses App

This document tracks the core design decisions made during the development of this application, their alternatives, and rationale.

## 1. Historical Membership Timeline Structure

*   **Decision**: Store group user mappings in a `Membership` table with explicit `joinedAt` and nullable `leftAt` timestamps, indexed on `[userId, groupId, joinedAt]`.
*   **Alternatives**:
    *   *Alternative A*: Simple join table without timestamps (assuming members are constant).
    *   *Alternative B*: An array of active member IDs stored directly on each `Expense` record.
*   **Chosen Option**: `Membership` log table with timestamps.
*   **Reason**: Flatmate profiles change over time (Dev joined for a trip, Meera moved out, Sam joined mid-April). A timeline log allows balance calculations to dynamically assess who was a member on the date of any transaction.

## 2. Staged CSV Import Workflow

*   **Decision**: Split the CSV import process into two endpoints: upload/stage (`POST /import`) and confirmation/commit (`POST /import/:id/confirm`), caching the staged records in `ImportJob.rawDataJson`.
*   **Alternatives**:
    *   *Alternative A*: Upload, run checks, and write valid rows directly to production tables in a single step (silent drops for invalid rows).
    *   *Alternative B*: Reject the entire CSV if a single anomaly is found.
*   **Chosen Option**: Two-stage validation import with raw staging.
*   **Reason**: Complies with the "never silently modify data" rule. Users must see a full audit report detailing anomalies, normalize names/dates, exclude errors, and manually approve before changes write to active databases.

## 3. Dedicated Settlement Table

*   **Decision**: Store debt repayments in a dedicated `Settlement` table rather than marking them as expenses with flags.
*   **Alternatives**:
    *   *Alternative A*: Reuse the `Expense` model and add an `isSettlement` boolean flag.
*   **Chosen Option**: Dedicated `Settlement` table.
*   **Reason**: Repayments represent direct cash transfers between two users to cancel debt, which does not count toward the group's total spent. Keeping settlements separated prevents math contamination and simplifies auditing.

## 4. Currency and Exchange Rate Management

*   **Decision**: Store both the original currency input and normalized INR values on each row. Configurable exchange rates are saved in an `ExchangeRate` table.
*   **Alternatives**:
    *   *Alternative A*: Fetch real-time exchange rates dynamically from an external currency API.
    *   *Alternative B*: Hardcode the conversion rate (83.00) in helper files.
*   **Chosen Option**: Database-driven exchange rates with default values.
*   **Reason**: Dynamic rates fluctuate and can alter historical balance reports unpredictably. A stored database configuration provides stability and user configurability.
