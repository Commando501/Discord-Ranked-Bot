
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { db } from './db';

declare module 'express-session' {
  interface SessionData {
    token: {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    };
    user: {
      id: string;
      username: string;
      avatar?: string;
      discriminator?: string;
    };
  }
}

export const setupSession = () => {
  const PgSession = connectPgSimple(session);

  return session({
    store: new PgSession({
      pool: db,
      tableName: 'sessions',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      httpOnly: true,
    }
  });
};
