// Run only from a trusted local environment with Application Default Credentials.
// Install firebase-admin outside the public web build, then run:
//   node admin-tools/set-admin-claim.mjs --uid FIREBASE_AUTH_UID

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uidIndex = process.argv.indexOf("--uid");
const uid = uidIndex >= 0 ? process.argv[uidIndex + 1] : "";
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "souq-al-halal-9e3e8";

if (!uid) {
  throw new Error("Pass the exact Firebase Auth UID with --uid. Phone numbers are not accepted.");
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS must point to a trusted local key outside this repository.");
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const auth = getAuth();
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
console.log(`Admin claim granted to UID ${uid}. Re-authentication or token refresh is required.`);
