"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  OAuthProvider,
  signInWithRedirect,
  signOut,
  type Auth,
  type UserCredential,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

export function getFirebaseApp(): FirebaseApp {
  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error(
      "Firebase environment variables are missing. See docs/SETUP.md and copy .env.example to .env.local.",
    );
  }
  return getApps().length === 0 ? initializeApp(config) : getApp();
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

const tenant = process.env.NEXT_PUBLIC_MICROSOFT_TENANT ?? "common";

export function buildMicrosoftProvider(): OAuthProvider {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({
    tenant,
    prompt: "select_account",
  });
  provider.addScope("openid");
  provider.addScope("email");
  provider.addScope("profile");
  return provider;
}

/**
 * Sign in with Microsoft via Firebase's redirect flow.
 *
 * Why redirect rather than popup:
 *   - `signInWithPopup` requires reliable cross-window postMessage to
 *     return the credential to the parent tab. Strict popup blockers,
 *     embedded webviews (Cursor IDE Browser, in-app webviews), and
 *     Cross-Origin-Opener-Policy headers regularly break that channel,
 *     producing a phantom `auth/popup-blocked` error AFTER the user has
 *     already authenticated in the popup. The result is a stranded popup
 *     and a confusing failure UX.
 *   - The redirect flow takes the entire tab to Microsoft, comes back to
 *     `https://<project>.firebaseapp.com/__/auth/handler` to exchange
 *     the OAuth code, and lands the user on the original origin where
 *     `processRedirectResult` (mounted in `Providers`) consumes the
 *     credential and `onIdTokenChanged` fires the rest of the app.
 *   - Modern Firebase guidance (v9+) treats redirect as the recommended
 *     web flow precisely because of these failure modes. The UX cost
 *     for a once-per-session AGM sign-in is negligible.
 *
 * `signInWithRedirect` returns a never-resolving promise because the
 * tab navigates away before resolution; we type the return as `never`.
 */
export async function signInWithMicrosoft(): Promise<never> {
  await signInWithRedirect(getFirebaseAuth(), buildMicrosoftProvider());
  throw new Error("signInWithRedirect did not navigate the page.");
}

/**
 * Consume the pending redirect-flow sign-in result on app mount.
 * Returns the credential when there is one to process, `null` otherwise.
 * Errors thrown here originate from the Microsoft side of the redirect
 * (e.g. user cancelled, account disabled) and should be surfaced to the
 * user via toast.
 */
export async function processRedirectResult(): Promise<UserCredential | null> {
  return await getRedirectResult(getFirebaseAuth());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export const FIREBASE_PROJECT_ID = config.projectId;
