import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const LOCAL_DEV_ORIGINS = [
  ...Array.from({ length: 11 }, (_, index) => `http://localhost:${3000 + index}`),
  ...Array.from({ length: 11 }, (_, index) => `http://127.0.0.1:${3000 + index}`),
  ...Array.from({ length: 8 }, (_, index) => `http://localhost:${5173 + index}`),
  ...Array.from({ length: 8 }, (_, index) => `http://127.0.0.1:${5173 + index}`),
];

function getVercelOrigin() {
  const vercelUrl =
    process.env.VERCEL_ENV === "production"
      ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
      : (process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (!vercelUrl) return undefined;
  return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
}

const vercelOrigin = getVercelOrigin();

const runtimeEnv = {
  ...process.env,
  // Public auth base: /api/auth bypasses the rewrite's path strip, so the
  // same URL works for incoming matching and generated callbacks
  BETTER_AUTH_URL:
    process.env.BETTER_AUTH_URL ?? (vercelOrigin ? `${vercelOrigin}/api/auth` : undefined),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? vercelOrigin,
};

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    VERCEL_OIDC_TOKEN: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: runtimeEnv,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

export const trustedOrigins = Array.from(
  new Set([
    env.CORS_ORIGIN,
    ...(env.NODE_ENV === "development" ? LOCAL_DEV_ORIGINS : []),
  ]),
);

export function isTrustedOrigin(origin: string) {
  return trustedOrigins.includes(origin);
}
