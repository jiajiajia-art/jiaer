# Recharge Success Receipt Design

## Goal

After a recharge-center order is confirmed paid, show a clear receipt for KK coin, weekly membership, or monthly membership purchases and let the user return to the recharge plans without closing the recharge center.

## Scope

- Cover WeChat, Alipay, and overseas payment flows used by the existing recharge center.
- Cover the existing KK coin, weekly membership, and monthly membership products.
- Do not add Dream Bean/points checkout, alter backend settlement, or change cancellation and payment verification rules.

## Behavior

- Only show the receipt after the server confirms the order is paid.
- KK coin receipts show the granted KK coin quantity calculated from the selected plan, including an applicable first-charge bonus.
- Weekly and monthly membership receipts name the activated plan and summarize its existing duration and daily reward benefits.
- WeChat Native success replaces the QR waiting view with the receipt.
- Alipay success replaces the checkout status view with the same receipt.
- Overseas payment return displays the same receipt after the existing server-side order query confirms paid.
- The primary action returns to the recharge plan selector while keeping the recharge center open.
- Pending, failed, or cancelled orders never display a success receipt. Existing payment finality and entitlement settlement remain unchanged.
- Preserve enough non-sensitive product summary in session-scoped client state to render the receipt after payment navigation/return; never treat that client state as payment confirmation.

## Implementation Shape

- Add a small reusable receipt presentation component for the confirmed product summary and return action.
- Reuse it in the recharge modal's WeChat and Alipay success states and in the overseas return success surface.
- Derive the receipt summary from the selected checkout plan; refresh account data after paid confirmation as today.
- Keep order IDs and product summary recovery scoped to the current browser tab/session and validate the server-reported order ID/status before showing the overseas receipt.

## Verification

- Unit checks for KK coin quantities, first-charge bonus, weekly/monthly labels and benefits, plus missing/invalid session receipt data.
- Verify paid-only gating for WeChat, Alipay, and overseas flows.
- Run frontend TypeScript checks and focused payment regressions.
- No real payment, backend/API, database, or deployment changes are in scope.
