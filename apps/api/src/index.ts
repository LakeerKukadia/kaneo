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
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for Railway
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 1337,
    hostname: "0.0.0.0",
  });
});

// Better-auth integration for Hono - handle all auth routes
app.all("/api/auth/*", async (c) => {
  console.log(`🔐 Auth request: ${c.req.method} ${c.req.path}`);
  console.log(`🔐 Request URL: ${c.req.url}`);
  
  try {
    const response = await auth.handler(c.req.raw);
    console.log(`🔐 Auth response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.clone().text();
      console.error(`🔐 Auth error response: ${errorText}`);
    }
    
    return response;
  } catch (error) {
    console.error("🔐 Auth handler error:", error);
    console.error("🔐 Error stack:", error.stack);
    return c.json({ 
      error: "Authentication error", 
      message: error.message,
      stack: error.stack
    }, 500);
  }
});

// Debug: Test auth object directly
app.get("/debug/auth-test", async (c) => {
  try {
    console.log("Testing auth object:");
    console.log("Auth type:", typeof auth);
    console.log("Auth handler type:", typeof auth.handler);
    console.log("Auth api type:", typeof auth.api);
    
    // Try to call auth directly with a simple request
    const testRequest = new Request("https://api.tasks.radon-media.com/api/auth/session", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    const result = await auth.handler(testRequest);
    
    return c.json({
      authObjectExists: !!auth,
      handlerExists: !!auth.handler,
      apiExists: !!auth.api,
      testResult: {
        status: result.status,
        statusText: result.statusText,
        ok: result.ok
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Auth test error:", error);
    return c.json({
      error: "Auth test failed",
      message: error.message,
      stack: error.stack
    }, 500);
  }
});

// Test different auth paths
app.post("/test/auth-handler", async (c) => {
  try {
    console.log(`🧪 Testing auth handler: ${c.req.method} ${c.req.url}`);

    const body = await c.req.json();
    console.log("Test request body:", body);

    // Test multiple path variations
    const testPaths = [
      "/sign-up/email",
      "/api/auth/sign-up/email",
      "/auth/sign-up/email",
      "/sign-in/email",
      "/api/auth/sign-in/email",
    ];

    const results = {};

    for (const testPath of testPaths) {
      try {
        const testURL = new URL(c.req.url);
        testURL.pathname = testPath;

        const testRequest = new Request(testURL.toString(), {
          method: c.req.method,
          headers: c.req.raw.headers,
          body: JSON.stringify(body),
        });

        console.log(`Testing path: ${testPath}`);
        const result = await auth.handler(testRequest);
        results[testPath] = {
          status: result.status,
          statusText: result.statusText,
          ok: result.ok,
        };

        console.log(`Path ${testPath} result:`, results[testPath]);
      } catch (error) {
        results[testPath] = { error: error.message };
        console.log(`Path ${testPath} error:`, error.message);
      }
    }

    return c.json({
      message: "Auth handler path test results",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Auth handler test error:", error);
    return c.json(
      {
        error: "Auth handler test failed",
        message: error.message,
        stack: error.stack,
      },
      500,
    );
  }
});

// Direct user endpoints with path correction for better-auth
app.post("/user/sign-up", async (c) => {
  try {
    console.log(`🔄 User sign-up: ${c.req.method} ${c.req.url}`);
    const body = await c.req.json();
    console.log("Request body:", body);

    // Create a new request with the path better-auth expects
    const authURL = new URL(c.req.url);
    authURL.pathname = "/api/auth/sign-up";

    const authRequest = new Request(authURL.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: JSON.stringify(body),
    });

    console.log("Modified request URL:", authURL.toString());
    const result = await auth.handler(authRequest);
    console.log("Auth handler response:", result);
    return result;
  } catch (error) {
    console.error("User sign-up error:", error);
    return c.json(
      {
        error: "Sign-up failed",
        message: error.message,
        stack: error.stack,
      },
      500,
    );
  }
});

app.post("/user/sign-in", async (c) => {
  try {
    console.log(`🔄 User sign-in: ${c.req.method} ${c.req.url}`);
    const body = await c.req.json();

    // Create a new request with the path better-auth expects
    const authURL = new URL(c.req.url);
    authURL.pathname = "/api/auth/sign-in";

    const authRequest = new Request(authURL.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: JSON.stringify(body),
    });

    const result = await auth.handler(authRequest);
    return result;
  } catch (error) {
    console.error("User sign-in error:", error);
    return c.json(
      {
        error: "Sign-in failed",
        message: error.message,
      },
      500,
    );
  }
});

// Debug endpoint to check auth configuration
app.get("/debug/auth-info", async (c) => {
  try {
    // Test if we can call auth methods
    let authMethods = {};
    try {
      authMethods = {
        hasApi: !!auth.api,
        hasHandler: typeof auth.handler === "function",
        apiMethods: auth.api ? Object.keys(auth.api) : [],
      };
    } catch (e) {
      authMethods = { error: e.message };
    }

    return c.json({
      authConfigured: !!auth,
      authHandlerExists: typeof auth.handler === "function",
      authMethods,
      baseURL:
        process.env.BETTER_AUTH_URL || "https://api.tasks.radon-media.com",
      hasSecret: !!(
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_ACCESS ||
        process.env.AUTH_SECRET
      ),
      hasDatabase: !!process.env.DATABASE_URL,
      environmentVars: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "not set",
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "not set",
        JWT_ACCESS: process.env.JWT_ACCESS || "not set",
        AUTH_SECRET: process.env.AUTH_SECRET || "not set",
        DATABASE_URL: process.env.DATABASE_URL ? "set" : "not set",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      error: "Auth configuration error",
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
});

// Simple test endpoint for user routes
app.post("/test/user-endpoint", async (c) => {
  return c.json({
    message: "User endpoint test works",
    method: c.req.method,
    url: c.req.url,
    timestamp: new Date().toISOString(),
  });
});

// Add a /me endpoint for user session info
app.get("/me", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session?.user) {
      return c.json(
        {
          authenticated: false,
          user: null,
          message: "Not authenticated",
        },
        200,
      ); // Return 200 instead of 401
    }

    return c.json({
      authenticated: true,
      user: session.user,
      session: session.session,
    });
  } catch (error) {
    console.error("Error in /me endpoint:", error);
    return c.json(
      {
        authenticated: false,
        user: null,
        error: "Session check failed",
      },
      200,
    );
  }
});

// Authentication middleware - exclude public endpoints
app.use("*", async (c, next) => {
  // Skip authentication for public endpoints
  const publicPaths = [
    "/health",
    "/",
    "/api/auth",
    "/me",
    "/user/",
    "/sign-in",
    "/sign-up",
    "/sign-out",
    "/debug/",
    "/test/",
  ];
  const currentPath = new URL(c.req.url).pathname;

  // Skip auth for public paths and auth endpoints
  if (publicPaths.some((path) => currentPath.startsWith(path))) {
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

// Debug environment variables and auth initialization
console.log("🔧 Environment check:");
console.log("- PORT:", process.env.PORT || "not set");
console.log("- BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL || "not set");
console.log(
  "- JWT_ACCESS_SECRET:",
  process.env.JWT_ACCESS_SECRET ? "***set***" : "not set",
);
console.log(
  "- DATABASE_URL:",
  process.env.DATABASE_URL ? "***set***" : "not set",
);

console.log("🔧 Better-auth initialization check:");
console.log("- Auth object exists:", !!auth);
console.log("- Auth handler type:", typeof auth?.handler);
console.log("- Auth API exists:", !!auth?.api);

// Test auth handler with a simple request
try {
  const testRequest = new Request("http://localhost/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test: "data" }),
  });
  console.log("- Testing auth handler initialization...");
  auth
    .handler(testRequest)
    .then((result) => {
      console.log(
        "- Auth handler test result:",
        result.status,
        result.statusText,
      );
    })
    .catch((error) => {
      console.log("- Auth handler test error:", error.message);
    });
} catch (error) {
  console.log("- Auth handler initialization error:", error.message);
}

const port = Number(process.env.PORT) || 1337;

serve(
  {
    fetch: app.fetch,
    port: port,
    hostname: "0.0.0.0", // Listen on all interfaces in Docker
  },
  (info) => {
    console.log(`🏃 Hono API is running at http://0.0.0.0:${info.port}`);
    console.log(
      `📍 Using PORT environment variable: ${process.env.PORT || "not set, using default 1337"}`,
    );
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
