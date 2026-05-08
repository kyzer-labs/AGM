/**
 * Convex auth bridge: trust Firebase Auth ID tokens.
 *
 * Firebase signs ID tokens with this issuer/audience pair:
 *   iss: https://securetoken.google.com/<projectId>
 *   aud: <projectId>
 *
 * `FIREBASE_PROJECT_ID` must be set in the Convex deployment env
 * (see `bunx convex env set FIREBASE_PROJECT_ID <id>` in docs/SETUP.md).
 */
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

if (!firebaseProjectId) {
  throw new Error(
    "Convex auth.config.ts: FIREBASE_PROJECT_ID is not set in the Convex deployment env. " +
      "Run: bunx convex env set FIREBASE_PROJECT_ID <your-firebase-project-id>",
  );
}

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${firebaseProjectId}`,
      applicationID: firebaseProjectId,
    },
  ],
};
