import { Router, Request, Response, NextFunction } from "express";
import { Session } from "express-session";

// Extend Session type to include our custom properties
declare module "express-session" {
  interface Session {
    isAuthenticated?: boolean;
    user?: {
      username: string;
      isAdmin: boolean;
    };
  }
}

// Hardcoded admin credentials for simplicity, as per requirements
const ADMIN_CREDENTIALS = [
  { username: "lateleague1", password: "1@t3L3aGu3!23" },
  { username: "lateleague2", password: "LaTe134gUE123" },
  { username: "lateleague3", password: "lateL34GU3!23" },
];

export const authRouter = Router();

// Check authentication status
authRouter.get("/status", (req: Request, res: Response) => {
  if (req.session && req.session.isAuthenticated && req.session.user) {
    res.json({
      isAuthenticated: true,
      username: req.session.user.username,
    });
  } else {
    res.json({
      isAuthenticated: false,
    });
  }
});

// Login route
authRouter.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Check if credentials are valid
  const validUser = ADMIN_CREDENTIALS.find(
    (cred) => cred.username === username && cred.password === password,
  );

  if (validUser) {
    // Store user in session
    req.session.isAuthenticated = true;
    req.session.user = {
      username: validUser.username,
      isAdmin: true,
    };

    res.status(200).json({
      success: true,
      username: validUser.username,
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid username or password",
    });
  }
});

// Logout route
authRouter.post("/logout", (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err: Error | null) => {
      if (err) {
        res.status(500).json({
          success: false,
          message: "Failed to logout",
        });
      } else {
        res.status(200).json({
          success: true,
        });
      }
    });
  } else {
    res.status(200).json({
      success: true,
    });
  }
});

// Middleware to check if user is authenticated
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.session && req.session.isAuthenticated && req.session.user) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
};
