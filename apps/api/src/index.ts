import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { Cron } from "croner";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import activity from "./activity";
import { auth } from "./auth";
import config from "./config";
import db from "./database";
import githubIntegration from "./github-integration";
import label from "./label";

import notification from "./notification";
import project from "./project";
import { getPublicProject } from "./project/controllers/get-public-project";
import search from "./search";
import task from "./task";
import timeEntry from "./time-entry";
import getSettings from "./utils/get-settings";
import purgeDemoData from "./utils/purge-demo-data";
import workspace from "./workspace";
import workspaceUser from "./workspace-user";

const app = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
  };
}>();

const { isDemoMode } = getSettings();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "http://localhost:5173", // Development
      "https://tasks.radon-media.com", // Production frontend
    ];

app.use(
  "*",
  cors({
    credentials: true,
    origin: (origin) => {
      if (!origin) {
        return null;
      }

      return corsOrigins.includes(origin) ? origin : null;
    },
  }),
);

const configRoute = app.route("/config", config);

const githubIntegrationRoute = app.route(
  "/github-integration",
  githubIntegration,
);

const publicProjectRoute = app.get("/public-project/:id", async (c) => {
  const { id } = c.req.param();
  const project = await getPublicProject(id);

  return c.json(project);
});

// Root endpoint
app.get("/", (c) => {
  return c.json({ 
    message: "Kaneo API Server", 
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint for Railway
app.get("/health", (c) => {
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 1337,
    hostname: "0.0.0.0"
  });
});

// Better-auth endpoints at /api/auth/*
app.on(["POST", "GET", "PUT", "DELETE"], "/api/auth/*", (c) => {
  console.log(`🔐 Auth request: ${c.req.method} ${c.req.url}`);
  return auth.handler(c.req.raw);
});

// Better-auth expects default paths like /sign-in, /sign-up etc
// Mount auth handler at root level for default paths
app.on(["POST", "GET", "PUT", "DELETE"], "/sign-in", (c) => auth.handler(c.req.raw));
app.on(["POST", "GET", "PUT", "DELETE"], "/sign-up", (c) => auth.handler(c.req.raw));
app.on(["POST", "GET", "PUT", "DELETE"], "/sign-out", (c) => auth.handler(c.req.raw));

// Also handle /user/* paths for compatibility
app.on(["POST", "GET", "PUT", "DELETE"], "/user/*", (c) => {
  console.log(`🔄 User endpoint: ${c.req.method} ${c.req.url}`);
  return auth.handler(c.req.raw);
});

// Add a /me endpoint for user session info
app.get("/me", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    
    if (!session?.user) {
      return c.json({ 
        authenticated: false, 
        user: null,
        message: "Not authenticated" 
      }, 200); // Return 200 instead of 401
    }
    
    return c.json({
      authenticated: true,
      user: session.user,
      session: session.session
    });
  } catch (error) {
    console.error("Error in /me endpoint:", error);
    return c.json({ 
      authenticated: false, 
      user: null,
      error: "Session check failed" 
    }, 200);
  }
});

// Authentication middleware - exclude public endpoints
app.use("*", async (c, next) => {
  // Skip authentication for public endpoints
  const publicPaths = ["/health", "/", "/api/auth", "/me", "/user/", "/sign-in", "/sign-up", "/sign-out"];
  const currentPath = new URL(c.req.url).pathname;
  
  // Skip auth for public paths and auth endpoints
  if (publicPaths.some(path => currentPath.startsWith(path))) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", session?.user || null);
    c.set("session", session?.session || null);
    c.set("userId", session?.user?.id || "");
    return next();
  }

  // For protected paths, require authentication
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user || null);
  c.set("session", session?.session || null);
  c.set("userId", session?.user?.id || "");

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return next();
});

if (isDemoMode) {
  new Cron("0 * * * *", async () => {
    await purgeDemoData();
  });
}

const workspaceRoute = app.route("/workspace", workspace);
const workspaceUserRoute = app.route("/workspace-user", workspaceUser);
const projectRoute = app.route("/project", project);
const taskRoute = app.route("/task", task);
const activityRoute = app.route("/activity", activity);
const timeEntryRoute = app.route("/time-entry", timeEntry);
const labelRoute = app.route("/label", label);
const notificationRoute = app.route("/notification", notification);
const searchRoute = app.route("/search", search);

// Run database migrations asynchronously (non-blocking)
migrate(db, { migrationsFolder: "drizzle" })
  .then(() => {
    console.log("✅ Database migrations completed successfully");
  })
  .catch((error) => {
    console.error("❌ Database migration failed (non-blocking):", error);
    // Log the error but don't crash the app
    console.log("⚠️ App will continue running despite migration failure");
  });

// Debug environment variables
console.log("🔧 Environment check:");
console.log("- PORT:", process.env.PORT || "not set");
console.log("- BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL || "not set");
console.log("- JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "***set***" : "not set");
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "***set***" : "not set");

const port = Number(process.env.PORT) || 1337;

serve(
  {
    fetch: app.fetch,
    port: port,
    hostname: "0.0.0.0", // Listen on all interfaces in Docker
  },
  (info) => {
    console.log(`🏃 Hono API is running at http://0.0.0.0:${info.port}`);
    console.log(`📍 Using PORT environment variable: ${process.env.PORT || 'not set, using default 1337'}`);
  },
);

export type AppType =
  | typeof workspaceRoute
  | typeof workspaceUserRoute
  | typeof projectRoute
  | typeof taskRoute
  | typeof activityRoute
  | typeof timeEntryRoute
  | typeof labelRoute
  | typeof notificationRoute
  | typeof searchRoute
  | typeof publicProjectRoute
  | typeof githubIntegrationRoute
  | typeof configRoute;

export default app;
