# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-04-09

### Added

-   Added dedicated guardian detail/edit page (`/family/guardian/:guardianId`).
-   Added guardian service (`app/services/guardian.server.ts`).
-   Added dedicated Guardian API endpoints:
    -   `GET /api/v1/families/{familyId}/guardians` (List guardians for family)
    -   `POST /api/v1/families/{familyId}/guardians` (Create guardian for family)
    -   `GET /api/v1/guardians/{guardianId}` (Get specific guardian)
    -   `PUT /api/v1/guardians/{guardianId}` (Update specific guardian)
    -   `DELETE /api/v1/guardians/{guardianId}` (Delete specific guardian)
-   Added server-side validation for required fields in web registration and student edit forms.
-   Added dedicated `tsconfig.json` for `mcp_server` build.

### Changed

-   **Refactored Registration:** Simplified web registration (`/register`) to a single page, removing Guardian #2 and student entry sections.
-   **Refactored API Registration:** Removed `guardian2` and `students` arguments from the `/api/v1/auth/register` endpoint and the corresponding MCP server tool.
-   **Refactored Guardian Management:**
    -   Removed guardian editing from the family account settings page (`/family/account`).
    -   Removed automatic fetching of guardians from family detail service and API endpoints (`/family/me`, `/api/v1/families/:familyId`). Clients must now use dedicated guardian endpoints.
-   Updated labels on registration page for clarity (Primary Guardian, Emergency Contact).
-   Made Emergency Contact field optional on registration page.
-   Applied consistent `.input-custom-styles` class to `Input` and `Textarea` components across various forms.

### Fixed

-   Resolved numerous TypeScript errors related to unused variables/imports, duplicate declarations, property access on potentially non-existent objects, and Supabase query typing.
-   Fixed `process is not defined` errors in `mcp_server` build output by importing `process` in source files.
-   Fixed `__importDefault is not defined` error in `mcp_server` build output by adding a dedicated `tsconfig.json`.
-   Fixed invalid JSON error in `mcp_server/tsconfig.json`.
-   Fixed incorrect property access (`responseBody.error`) in `mcp_server/src/apiClient.ts`.
-   Removed invalid `email_redirect_to` option from Supabase admin `createUser` call.

### Removed

-   Multi-step logic and UI from the web registration form.
-   Guardian #2 section and related logic from web registration form, API, and MCP server.
-   Student section and related logic from web registration form, API, and MCP server.
-   Guardian editing forms and logic from the family account settings page.
-   "Add Guardian" button from family portal index page (pending creation of add guardian route).

---

*Previous entries moved below*

## [2025-04-06]

### Added

-   Implemented embedded payment form using Stripe Elements (`/pay/:paymentId`).
-   Created API endpoint (`/api/create-payment-intent`) to generate Stripe Payment Intents.
-   Added client-side navigation from payment initiation (`/family/payment`) to the payment form page.
-   Added auto-refresh mechanism using `useRevalidator` on the payment success page (`/payment/success`) to handle pending webhook updates.
-   Added display of purchased quantity for individual sessions on the payment success page.
-   Added Stripe receipt link display on the payment success page.
-   Added user-friendly product descriptions on the payment page.
-   Added `stripe_payment_intent_id`, `created_at`, `updated_at` columns to `payments` table schema.
-   Added `one_on_one_sessions` and `one_on_one_session_usage` tables and related logic for tracking individual session purchases and usage.
-   Added `ClientOnly` wrappers in `Navbar` to mitigate hydration issues.
-   Added custom 404 page using a splat route (`app/routes/$.tsx`).
-   Added `useFetcher` pattern for payment initiation form submission to improve reliability.
-   Added "Retry Payment" / "Complete Payment" link to Payment History page for `failed` / `pending` payments.
-   Added `warning` variant to `Alert` component.
-   Added `sync-pending-payments` Supabase Edge Function to reconcile old pending payments via Stripe API check.
-   Added pre-selection of payment option on `/family/payment` page via URL query parameter (`?option=individual`).

### Changed

-   **BREAKING:** Replaced Stripe Checkout redirection flow with embedded Stripe Elements flow.
-   Renamed `/api/create-checkout-session.ts` to `/api/create-payment-intent.ts`.
-   Updated Stripe webhook handler (`/api/webhooks/stripe`) to process `payment_intent.succeeded` and `payment_intent.payment_failed` events.
-   Updated webhook handler to retrieve Payment Intent via Stripe API to reliably get `receipt_url`.
-   Updated `updatePaymentStatus` utility function to accept `supabasePaymentId` and handle `individual_session` recording.
-   Updated `/family/payment` route to create a `pending` payment record before navigating to the payment form.
-   Updated `/payment/success` loader to query by `payment_intent` and fetch necessary details.
-   Updated `README.md` to reflect the new payment flow, technology stack, setup instructions, project structure, and SQL-based function scheduling.
-   Refactored code to consistently use `type` instead of `payment_type` for the corresponding database column.
-   Made `app/db/supabase-setup.sql` script more idempotent (added `IF NOT EXISTS` for tables and indexes, corrected enum creation).
-   Refactored Family Portal (`/family`) layout for better visual balance on wider screens.
-   Modified `/pay/:paymentId` loader to check Stripe status for `pending` payments to prevent double charges and redirect if already succeeded.
-   Modified `updatePaymentStatus` to set `payment_date` for `failed` payments.
-   Improved Payment History sorting to prioritize `created_at`.
-   Improved Payment Success page display logic for `pending` status and when loader initially fails to find the record.

### Fixed

-   Resolved numerous TypeScript errors related to missing properties, type mismatches, and Supabase query parsing.
-   Fixed various JSX syntax errors and tag nesting issues in `Navbar.tsx`.
-   Resolved ESLint Rules of Hooks violations for `useMemo` and `useEffect`.
-   Fixed Stripe Elements `options.clientSecret` prop change warning by memoizing the `options` object.
-   Resolved issue where payment initiation page (`/family/payment`) refreshed instead of performing client-side navigation.
-   Fixed cancel link destination on payment page (`/pay/:paymentId`) to point to `/family`.
-   Improved Stripe Card Element text visibility in dark mode.
-   Removed duplicate code blocks (e.g., `catch` block, CSS `color` property).
-   Corrected Supabase query parsing errors caused by comments within `select` statements.
-   Handled potential `null` or missing `payment.type` property in `/pay/:paymentId` component.
-   Prevented duplicate payment record creation by ensuring payment initiation action only runs once per attempt.
-   Fixed `React.Children.only` error on Family Portal page (related to Button `asChild`).
-   Fixed typo in Payment History loader query (`.from.from`).
-   Made `/payment/success` loader query more robust (`maybeSingle`).
-   Prevented double API calls for creating payment intents from `/pay/:paymentId` page.
-   Corrected `/pay/:paymentId` loader logic to avoid incorrectly marking payments as `failed`.
-   Fixed dark mode visibility for `destructive` Alert variant text.

### Removed

-   Stripe Checkout session creation logic and redirection.
-   Redundant `ALTER TYPE ... RENAME VALUE` statement from `supabase-setup.sql`.
-   Local mutation of `payment` object in `/pay/:paymentId` loader.
