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

app.on(["POST", "GET", "PUT", "DELETE"], "/api/auth/*", (c) =>
  auth.handler(c.req.raw),
);

app.use("*", async (c, next) => {
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
