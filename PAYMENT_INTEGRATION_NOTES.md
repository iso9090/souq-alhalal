# Future payment integration (disabled)

Client → Payment Provider → Trusted Backend/Webhook → Verify payment → Backend sets paymentStatus=paid → Admin/automatic service processing.

العميل لا يملك أبدًا صلاحية كتابة paymentStatus=paid. Even an admin browser cannot mark a payment paid under the current rules.

A future trusted backend must authenticate ownership, calculate the service price from trusted country/service data, create a provider session, verify webhook signatures and provider payment state, match amount/currency/order/user, and process retries idempotently. Never trust redirects or client-reported success. Record paidAt and paymentReference only after verification; keep secrets on the backend. Refunds need a separately verified, auditable flow.

Current payment-demo reads only the signed-in user's serviceRequests. Its button changes DOM only. There is no payment SDK, card capture, backend, webhook, secret, or payment activation. Payment overrides remain trusted admin exceptions and do not change unpaid into paid.

Before activation: establish required business arrangements, publish support contact and final payment/refund terms, and test the backend in an isolated provider sandbox.
