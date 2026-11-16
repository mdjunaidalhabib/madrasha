# Public website donations

Donation access is disabled for every institution until explicitly granted.

1. In Super Admin → Website Control → Institution theme & status, select the institution and enable **Public website donations**.
2. In that institution's Admin → Settings → Website settings → **Donations** (inside the website settings menu), complete donation settings. Enter a title, purpose, verified payment accounts and instructions. Optionally add an HTTPS checkout URL and assistance phone number. The menu requires the current access grant, active website module and `website.manage` permission.
3. Use the pencil controls to edit and save individual fields. Add or edit payment methods with their Save/Cancel controls. Enable the publication toggle after setting up a title and payment destination; the toggle saves immediately. The public website displays the donation navigation entry and section on desktop, mobile and custom domains.
4. Revoke access from Super Admin to hide the section on subsequent public requests. Saved account details remain available when access is granted again.

Payments are made directly to the institution's listed wallet/bank account or its external checkout page. This feature does not process funds, verify transfers, issue receipts or automatically post accounting entries. The institution confirms receipt directly with the donor.

Payment method descriptions are generated from structured fields. Wallets offer Personal/Merchant account types; bank transfers offer Savings/Current and separate bank, branch and optional nine-digit routing fields. Previously saved bank names appear as suggestions. Both admin and public views format these fields in the selected language; older descriptions remain visible for compatibility.

## Donation demo

Super Admin → Website Control → Demo template → **Donations (demo)** edits the starting title, description and instructions, with a live content preview. Save using the template's regular save action. `{{institution_name}}` is replaced with the target institution's name.

Super admin demo fields use pencil controls with Apply/Cancel. Apply updates the local demo draft; **Save changes** persists the entire template. Global saving, switching tabs, and moving/removing items are disabled while a field edit is open so unfinished edits cannot be silently lost. Publication controls are available in the relevant section tabs and for individual list items. The donation demo publication toggle controls preview visibility only; it never grants tenant access or publishes an institution's donation page. The starter website's master publication switch remains in General settings.

Newly granted institutions receive this content as an unpublished draft. Existing institutions retain their saved content and accounts when re-granted access. Website settings → Donations → **Load demo text** applies and saves demo text with publication turned off; existing payment accounts are preserved. Demo data never grants access, publishes automatically or supplies payment destinations. Website demo resets continue to preserve donation settings. Legacy `/donations` URLs redirect to `/settings/website?tab=donations`.

## Access and persistence

- `GET/PATCH /api/website/super/madrasas/:id/donations`: super admin only. PATCH accepts exactly `{ "allowed": boolean }`.
- `GET/PUT /api/website/admin/donations`: authenticated tenant plus `website.manage`. PUT accepts the complete donation configuration, never an access grant or tenant ID.
- `GET /api/website/admin/donations/demo`: current donation grant plus `website.manage`; returns personalized demo text in an unpublished configuration without payment destinations.
- Public website payload: `donation` is `null` unless access is granted, configuration is valid and publication is enabled.
- Settings writes atomically require the tenant's current grant, so a stale open admin form cannot bypass revocation.
- `website_donation_settings` stores access and configuration separately from demo website content. Demo provisioning and resets cannot copy accounts or grant access.
- Payment destinations accept HTTPS links without embedded credentials. Copy is rendered as plain text; it cannot inject HTML.

Migration: `20261116140000_add_website_donations`. Regenerate Prisma after updating the schema, and apply migrations using the deployment's normal migration process before running the new application.

Validation: backend donation policy/authorization tests, all three frontend builds/type checks, and `node artifacts/donation-browser-check.cjs` against a frontend dev server on port 5188. Browser checks use mocked institution/payment details and do not modify operational data.
