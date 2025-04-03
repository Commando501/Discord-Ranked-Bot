import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeBot } from "./index.bot";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("Starting application initialization...");
    
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Express error handler:", err);
      res.status(status).json({ message });
    });

    console.log("Setting up static content...");
    // Only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    console.log("Static content setup complete");

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client
    const port = 5000;
    
    // Create a process-wide unhandled rejection handler to catch any errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      
      // Initialize the Discord bot after the server is started
      console.log("Server started, checking Discord token...");
      log(`DISCORD_TOKEN present: ${!!process.env.DISCORD_TOKEN}`);
      
      if (process.env.DISCORD_TOKEN) {
        log("Attempting to initialize Discord bot...");
        
        // Wrap bot initialization in another try-catch for additional safety
        try {
          initializeBot().then(() => {
            log("Discord bot initialized successfully");
            
            // Keep the process alive even if there are no event listeners
            setInterval(() => {
              log("Heartbeat - keeping application alive");
            }, 60000);
            
          }).catch(err => {
            log(`Failed to initialize Discord bot: ${err.message}`);
            // Log full error details for debugging
            console.error("Full Discord initialization error:", err);
            
            // Keep the process alive even if bot initialization fails
            setInterval(() => {
              log("Heartbeat - keeping application alive despite bot init failure");
            }, 60000);
          });
        } catch (directError) {
          console.error("Critical error during bot initialization setup:", directError);
          
          // Keep the process alive even if there's a critical error
          setInterval(() => {
            log("Emergency heartbeat - keeping application alive after critical error");
          }, 60000);
        }
      } else {
        log("DISCORD_TOKEN not found in environment variables, bot will not start");
        
        // Keep the process alive even without bot
        setInterval(() => {
          log("Heartbeat - keeping application alive (no bot)");
        }, 60000);
      }
    });
  } catch (startupError) {
    console.error("CRITICAL STARTUP ERROR:", startupError);
    
    // Keep the application running even with startup errors
    setInterval(() => {
      console.log("Emergency heartbeat - application had critical startup error but remains alive");
    }, 30000);
  }
})();
