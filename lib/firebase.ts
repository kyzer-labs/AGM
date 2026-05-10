"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  OAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
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

export async function signInWithMicrosoft(): Promise<void> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  await signInWithPopup(auth, buildMicrosoftProvider());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export const FIREBASE_PROJECT_ID = config.projectId;
