import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import db, { schema } from "./database";
import { generateDemoName } from "./utils/generate-demo-name";

import dotenv from "dotenv";

dotenv.config();

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.API_URL || "https://api.tasks.radon-media.com",
  trustedOrigins: [
    "http://localhost:5173", // Development
    "https://tasks.radon-media.com", // Production frontend
    "https://api.tasks.radon-media.com" // Production API
  ],
  secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS || process.env.AUTH_SECRET || "fallback-secret-for-development-only-not-secure",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scopes: ["user:email"],
    },
  },
  plugins: [
    anonymous({
      generateName: async () => generateDemoName(),
    }),
  ],
});
