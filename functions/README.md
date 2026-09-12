# Trusted backend: local foundation

Firebase Functions second generation, Node 22, Firebase Admin SDK and Cloudinary SDK. This implementation is local-only. No deployment, billing change, production secret or account operation is part of this release.

## Defaults and entry points

`TRUSTED_BACKEND_ENABLED=false` on server and client; `STRIPE_ENABLED=false`. The exported function is private and returns `backend-disabled` without initializing credentials unless all local safeguards pass: `FUNCTIONS_EMULATOR=true`, explicit `LOCAL_TRUSTED_BACKEND=true`, a `demo-*` project, and loopback Firestore AND Auth emulator hosts. A real project cannot activate this adapter. Production activation requires a separately reviewed change, not merely secret values or billing.

- `POST /api/cloudinary/sign`: fixed signed upload parameters, Super Admin only.
- `POST /api/admin/create-assistant`: disabled new-account staging, Super Admin only.
- `POST /api/payments/create-checkout-session` and `/api/stripe/webhook`: disabled stubs; no Stripe dependency/call/payment-state write.

The client has no endpoint URL by default. It displays **رفع الصور من الجهاز قيد التجهيز**, permits selection/preview, and blocks saving new images until a successful upload. No manual Cloudinary URL fallback. Existing saved images may be retained during edits. Other listing image flows are unchanged.

## Run locally

Use Node 22 and install dependencies with `npm ci --prefix functions --ignore-scripts`. From the repository root:

```
npm run test:backend
npm run test:trusted-browser
npm run test:commercial
npm run scan:secrets
```

Backend tests mock Auth and use synthetic signing secrets. Browser tests intercept external traffic, including provider uploads; one suite exercises the actual backend policy and Cloudinary SDK with the browser adapter. No real secret is needed.

For `npm run test:backend-emulator`, first start Firestore Emulator on `127.0.0.1:8080` and set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. This suite refuses remote hosts, uses a unique demo project, and tests actual transactions and current unchanged Rules. It does not connect to Production.

`npm run serve:mock --prefix functions` starts a loopback-only HTTP harness at port 8770. Use synthetic `Bearer mock-owner` and fixture request time `2000000000`. It is a mock, not real login or an upload service; do not connect the live site to it. Stop with Ctrl+C. HTTP tests automatically start and close an ephemeral instance.

`src/local-emulator.js` provides an Admin SDK adapter requiring both local Auth and Firestore emulators and an explicit demo project. For manual Functions Emulator tests, synthetic overrides may be placed in ignored `.secret.local` files; none are committed. The complete Functions+Auth emulator stack is not integration-tested here: Auth verification and account creation use mocks, while Firestore transactions use the real local emulator.

## Super Admin verification

Every sensitive request uses `verifyIdToken(token, true)`, current Auth user state, and canonical Firestore records. Require non-disabled user, `admin:true` in both token and current claims, enabled `adminSecurity/config`, UID in `superAdminUids`, `adminAccess.role=super_admin`, and `users.status=active`. Missing data or SDK errors deny with 403. Email and accountType never authorize. This is intentionally stricter than legacy missing-profile fallbacks.

Signing rechecks authorization before returning the capability. Assistant staging checks canonical owner records again in its Firestore transaction. Auth and Firestore have no shared transaction, so absolute cross-service revocation atomicity is not claimed.

## Upload contract and limits

Accept only purpose, bytes, contentType, width, height, placement, requestTimestamp and nonce. Purpose must be commercial_ad. Metadata permits JPEG/PNG/WebP, at most 300 KiB and 1600x1600 pixels. Hero minimum 800x400, middle 800x200, side/footer 300x150; ratio 2:1 except middle 4:1, tolerance 20%. The browser sends dimensions after compression. Client validation accepts JPG/JPEG/PNG/WebP source files up to 10 MiB and 20 megapixels; the existing compression adapter produces JPEG.

The server chooses timestamp, random public ID, folder `souq-alhalal/commercial-ads`, overwrite=false, signed preset `commercial_ads_signed_v1`, transformation `c_limit,w_1600,h_1600`, and fixed allowed formats. Arbitrary client signing parameters are rejected. Cloudinary SDK signs the exact parameters using SHA-256.

The client validates the returned authorization fields, uploads to `/image/upload`, and checks expected cloud, public ID, URL, resource type, format, bytes and dimensions before returning imageUrl. The commercial form then permits saving. Preview is available before upload; no save request is sent to a missing backend when flags are false.

### Provider guarantees still requiring verification

A signing endpoint sees metadata, not file bytes. It cannot verify actual file magic, contents or dimensions before upload. A real signed preset enforcing actual format/size limits must be configured and tested; no preset was created here. The current contract expects folder-prefixed public IDs, so actual Cloudinary folder mode must be verified.

Cloudinary excludes file, cloud_name, resource_type and api_key from signing. Returning resourceType=image and using the image endpoint does not prove a stolen signature cannot be submitted elsewhere. Test raw/video endpoint attempts, disguised SVG/executable inputs, preset enforcement and asset provenance before production. If provider controls cannot enforce the required guarantees, use a trusted upload proxy that inspects bytes. Browser response checks are not a server security boundary.

Cloudinary signatures are valid for one hour. Request timestamps must be within 60 seconds of server time, but that does not shorten provider validity. Nonce reservation prevents duplicate authorization requests; unique public IDs with overwrite=false limit replacements, not all provider replays. The response reports the real one-hour expiry and does not claim a one-time token. [Signature documentation](https://cloudinary.com/documentation/authentication_signatures).

## Rate limits, CORS, storage and audit

Firestore transactions share nonce/counter state between instances: 5/minute/UID, 50/day/UID, 200/day/project, across sensitive operations. Fixed UTC windows can have boundary bursts. Replays return 409; quota exhaustion returns 429. Storage failure denies requests. Failed operations consume quota/nonce; retries require a new nonce.

Server-only collections backendQuota, backendReplay and backendAuditLogs are client-denied by current Rules, verified locally. Two-day expiry fields are written, but no TTL policy is configured. Production needs cleanup/retention decisions. Successful operations incur authorization reads, approximately four quota reads/four writes and an audit write; retries can add cost. Budgets and maxInstances are not hard spending caps. Unauthorized invocations may still incur compute cost.

CORS allows exactly `https://iso9090.github.io`; local mode adds only `http://localhost:8770` and `http://127.0.0.1:8770`. POST/OPTIONS and Authorization/Content-Type only, no wildcard or credential cookies. Origin cannot distinguish paths/repositories on the same GitHub Pages host. CORS is not authentication. The disabled webhook stub has no browser-origin requirement; a future webhook must verify Stripe signatures.

Audit helper projects only event, actor UID, operation ID and timestamp. Supported events are cloudinary_sign_requested, assistant_created, payment_session_created and payment_webhook_processed. It does not log tokens, passwords, signing capabilities, SDK errors or raw payment data. Existing assistant audit schema is preserved and written atomically with staging. Generic operation audit is separate; failures may require reconciliation.

## Assistant staging, invitation and recovery

Only displayName, email, loginMethod=email_reset, timestamp and nonce are accepted. Role, target UID, claims, permissions and password inputs are rejected. Any existing email returns 409 without modification, including existing owners. Google-first remains the current live workflow; this endpoint does not attach a Google provider.

Create a new random UID with an unpredictable server-generated password, disabled=true and emailVerified=false. Password is never returned, logged or stored in Firestore. Stage the existing users buyer profile, adminAccess admin_assistant/suspended with empty permissions, and adminAuditLogs schema. No admin claim is granted; Auth stays disabled. The response indicates pending-invitation.

Invitation/reset delivery and activation are not implemented. A future trusted flow must prove mailbox control and explicitly approve activation/permissions. Do not expose reset links to an administrator: they are credential capabilities. Auth creation and Firestore staging are not atomic. On failure the new account stays disabled; a trusted recovery process must reconcile it. This endpoint refuses to modify existing users on retry and never deletes accounts as cleanup. It is a local staging foundation, not a complete live onboarding flow.

## Stripe readiness

Checkout must read authoritative price/currency/order from Firestore, verify ownership and payable status, restrict return URLs, and use server idempotency keys. Never trust client amounts or paid_online fields. Only a verified webhook can confirm paid_online. Webhooks require unmodified raw body, Stripe-Signature verification/timestamp tolerance, durable event deduplication and idempotent fulfillment. Handle retries/out-of-order events and acknowledge after durable receipt. No payment or fulfillment is implemented. [Stripe webhook documentation](https://docs.stripe.com/webhooks).

## Secrets and release blockers

Secret Manager names: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET; Stripe secret names are future-only and unbound. Example values are empty. No real environment file, private key or service-account JSON is committed. The static build allowlist excludes functions and administrative tooling.

Production must use managed runtime identity and scoped IAM/secret access. Assistant creation should be isolated from image-signing privileges. Deployment is not ready solely after secrets/billing approval: provider enforcement, Auth emulator integration, invitation/recovery, IAM, region/cost controls, retention and explicit activation remain review gates. No deployment or billing scripts are included.
