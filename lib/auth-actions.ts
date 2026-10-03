"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "./auth";
import { query } from "./db";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AuthFormState = {
  error?: string;
};

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)`,
      [email, passwordHash, parsed.data.name],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users_email_key") || message.includes("duplicate key")) {
      return { error: "An account with that email already exists." };
    }
    if (message.includes("DATABASE_URL")) {
      return { error: "Database is not configured. Set DATABASE_URL to sign up." };
    }
    return { error: "Could not create your account. Try again." };
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Please log in." };
    }
    throw error;
  }

  return {};
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return { error: "Database is not configured. Set DATABASE_URL to log in." };
    }
    throw error;
  }

  return {};
}

export async function logout() {
  const { signOut } = await import("./auth");
  await signOut({ redirectTo: "/login" });
}
