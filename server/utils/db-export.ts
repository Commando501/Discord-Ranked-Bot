import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { db } from '../db';

const execAsync = promisify(exec);

// Directory to save database exports
const EXPORT_DIR = path.join(process.cwd(), 'exports');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * Export database to a file
 * @returns Promise that resolves to the file path of the exported database
 */
export async function exportDatabase(): Promise<{ filePath: string, fileName: string }> {
  try {
    // Ensure database is properly connected
    await db.execute('SELECT 1');
    
    // Format timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `matchmaker_db_export_${timestamp}.sql`;
    const filePath = path.join(EXPORT_DIR, fileName);

    // Create pg_dump command with environment variables
    const pgDumpCommand = `pg_dump -Fc \
      --host=${process.env.PGHOST} \
      --port=${process.env.PGPORT} \
      --username=${process.env.PGUSER} \
      --dbname=${process.env.PGDATABASE} \
      --no-owner \
      --no-acl \
      --file=${filePath}`;

    // Execute pg_dump command with password from env
    const { stdout, stderr } = await execAsync(pgDumpCommand, {
      env: {
        ...process.env,
        PGPASSWORD: process.env.PGPASSWORD
      }
    });

    if (stderr && !stderr.includes('Dumping the contents of table')) {
      console.error('Error during database export:', stderr);
      throw new Error(`Database export error: ${stderr}`);
    }

    console.log(`Database export successful: ${filePath}`);
    
    return { 
      filePath,
      fileName 
    };
  } catch (error) {
    console.error('Failed to export database:', error);
    throw error;
  }
}

/**
 * Get list of available database exports
 */
export function getAvailableExports(): { fileName: string, filePath: string, size: number, created: Date }[] {
  try {
    if (!fs.existsSync(EXPORT_DIR)) {
      return [];
    }

    return fs.readdirSync(EXPORT_DIR)
      .filter(file => file.startsWith('matchmaker_db_export_') && file.endsWith('.sql'))
      .map(fileName => {
        const filePath = path.join(EXPORT_DIR, fileName);
        const stats = fs.statSync(filePath);
        
        return {
          fileName,
          filePath,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by date, newest first
  } catch (error) {
    console.error('Failed to get available exports:', error);
    return [];
  }
}

/**
 * Delete a database export file
 */
export function deleteExport(fileName: string): boolean {
  try {
    const filePath = path.join(EXPORT_DIR, fileName);
    
    // Security check to ensure we're only deleting files in our export directory
    if (!filePath.startsWith(EXPORT_DIR) || !fs.existsSync(filePath)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('Failed to delete export:', error);
    return false;
  }
}