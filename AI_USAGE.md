# AI Tool Usage Log: Shared Expenses App

This document details the AI tools and prompts used during project development, along with three key examples where AI output was incorrect and corrected.

## AI Tools & Prompts

*   **AI Tool**: Google Gemini (under Antigravity IDE)
*   **Key Prompts**:
    *   *System Architecture*: "Design a shared expenses application with Vite/React frontend, Node/Express backend, and Prisma/PostgreSQL database..."
    *   *Anomaly Checking*: "Implement an Express service that parses uploaded CSV rows and validates 15 distinct anomaly rules..."
    *   *Debt Simplification*: "Implement a balance calculator in TypeScript that simplifies debts and generates full explainability audit trails..."

---

## Incorrect Output Examples & Resolutions

### 1. Equal Split Floating Point Rounding Error
*   **Incorrect AI Behavior**: The generated splitting algorithm computed shares using simple division:
    ```typescript
    const shareAmount = amount / shares.length;
    ```
*   **How it was caught**: During manual tests with ₹100 split among 3 people (Aisha, Rohan, Priya), each member was assigned ₹33.33. The sum of shares ($33.33 \times 3 = 99.99$) did not equal the total expense amount (₹100.00), leaving a ₹0.01 deficit.
*   **Correction**: Modified `splitCalculator.ts` to implement **penny rounding** adjustments. The algorithm calculates equal shares, keeps track of cumulative assigned values, and assigns the remaining difference to the last participant:
    ```typescript
    const equalShare = round2(amount / shares.length);
    let totalAssigned = 0;
    shares.forEach((s, idx) => {
      const personShare = idx === shares.length - 1 ? round2(amount - totalAssigned) : equalShare;
      totalAssigned += personShare;
      // ...
    });
    ```

### 2. Timezone-Dependent Date Parsing
*   **Incorrect AI Behavior**: The date parser used the native JavaScript `new Date(string)` constructor.
*   **How it was caught**: CSV rows with date formats like `2026-03-15` parsed into different calendar dates depending on whether the test runner ran in local time or UTC (e.g. converting `2026-03-15` to March 14th 8:00 PM in Western timezones).
*   **Correction**: Wrote a timezone-agnostic custom date parsing utility in `anomalyDetector.ts` that explicitly extracts numeric date components and instantiates them via `Date.UTC()`.

### 3. Missing Membership history checks in manual creations
*   **Incorrect AI Behavior**: The AI generated manual expense creation endpoints (`POST /expenses`) that only checked if the payer existed in the group, ignoring whether they were a member *on the specific transaction date*.
*   **How it was caught**: Running tests where Meera was added to an expense in April (after she moved out in March) completed successfully.
*   **Correction**: Enhanced the backend validation layers in both `expenseController.ts` and `settlementController.ts` to query memberships and verify that the transaction date falls strictly between each member's `joinedAt` and `leftAt` boundaries.
