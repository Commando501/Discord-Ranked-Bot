
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Starting migration to add Xbox fields...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // For migrations, use a direct connection
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  
  try {
    // Check if columns already exist
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('xbox_gamertag', 'xuid');
    `;
    
    const existingColumns = await sql.unsafe(checkColumnQuery);
    
    // If columns don't exist, add them
    if (!existingColumns.find(col => col.column_name === 'xbox_gamertag')) {
      console.log('Adding xbox_gamertag column...');
      await sql.unsafe(`ALTER TABLE players ADD COLUMN xbox_gamertag TEXT;`);
    }
    
    if (!existingColumns.find(col => col.column_name === 'xuid')) {
      console.log('Adding xuid column...');
      await sql.unsafe(`ALTER TABLE players ADD COLUMN xuid TEXT;`);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main()
  .then(() => {
    console.log('Migration script executed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
