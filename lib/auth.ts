import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { query } from "./db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const { rows } = await query<UserRow>(
          `SELECT id, email, name, password_hash
           FROM users
           WHERE email = $1
           LIMIT 1`,
          [email],
        );

        const user = rows[0];
        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          parsed.data.password,
          user.password_hash,
        );
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
