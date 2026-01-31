import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [twoFactorClient(), passkeyClient()],
});

export const { signIn, signUp, signOut, useSession, twoFactor, passkey } =
  authClient;

// Export named functions for easier imports
export async function signInWithEmail(email: string, password: string) {
  return signIn.email({
    email,
    password,
  });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
) {
  return signUp.email({
    email,
    password,
    name,
  });
}

export async function signInWithSocial(provider: "google") {
  return signIn.social({
    provider,
    callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
}

// TOTP/2FA functions
export async function enableTwoFactor(password?: string) {
  return twoFactor.enable({ password: password || "" });
}

export async function verifyTwoFactor(code: string) {
  return twoFactor.verifyTotp({ code });
}

export async function disableTwoFactor(password: string) {
  return twoFactor.disable({ password });
}

// Passkey functions
export async function registerPasskey() {
  return passkey.addPasskey();
}

export async function signInWithPasskey() {
  return signIn.passkey();
}

export async function listPasskeys() {
  return passkey.listUserPasskeys();
}

export async function deletePasskey(id: string) {
  return passkey.deletePasskey({ id });
}
