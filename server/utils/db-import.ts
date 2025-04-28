import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { db } from '../db';
import { pool } from '../db';

const execAsync = promisify(exec);

// Directory where database imports should be placed
const IMPORT_DIR = path.join(process.cwd(), 'imports');

// Ensure import directory exists
if (!fs.existsSync(IMPORT_DIR)) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
}

/**
 * Import database from an uploaded file
 * @param filePath Path to the uploaded file
 * @returns Promise that resolves when the import is complete
 */
export async function importDatabase(filePath: string): Promise<void> {
  try {
    // Verify file exists and is in the correct directory
    if (!fs.existsSync(filePath)) {
      throw new Error(`Import file not found: ${filePath}`);
    }

    // Security check - ensure the file is in the imports directory
    const normalizedFilePath = path.normalize(filePath);
    if (!normalizedFilePath.startsWith(IMPORT_DIR)) {
      throw new Error('Invalid import file path');
    }

    // Ensure the database is connected
    await db.execute('SELECT 1');

    // Close all connections to the database before import
    await pool.end();

    console.log('Starting database import...');
    
    // Create pg_restore command with environment variables
    const pgRestoreCommand = `pg_restore -c \
      --host=${process.env.PGHOST} \
      --port=${process.env.PGPORT} \
      --username=${process.env.PGUSER} \
      --dbname=${process.env.PGDATABASE} \
      --no-owner \
      --no-acl \
      ${filePath}`;

    // Execute pg_restore command with password from env
    const { stdout, stderr } = await execAsync(pgRestoreCommand, {
      env: {
        ...process.env,
        PGPASSWORD: process.env.PGPASSWORD
      }
    });

    if (stderr && !stderr.includes('creating') && !stderr.includes('restoring')) {
      console.error('Error during database import:', stderr);
      throw new Error(`Database import error: ${stderr}`);
    }

    console.log('Database import completed successfully');
  } catch (error) {
    console.error('Failed to import database:', error);
    throw error;
  } finally {
    // Reconnect to the database after import
    await pool.connect();
  }
}

/**
 * Upload an import file to the imports directory
 * @param fileData The file data buffer
 * @param fileName The original file name
 * @returns Promise that resolves to the path where the file was saved
 */
export async function uploadImportFile(fileData: Buffer, fileName: string): Promise<string> {
  try {
    // Validate that the file appears to be a PostgreSQL dump
    if (!fileName.endsWith('.sql') && !fileName.endsWith('.dump')) {
      throw new Error('Invalid file type. Only .sql or .dump files are supported.');
    }

    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const importFileName = `matchmaker_db_import_${timestamp}_${path.basename(fileName)}`;
    const importFilePath = path.join(IMPORT_DIR, importFileName);

    // Write file to disk
    fs.writeFileSync(importFilePath, fileData);

    console.log(`Import file uploaded: ${importFilePath}`);
    return importFilePath;
  } catch (error) {
    console.error('Failed to upload import file:', error);
    throw error;
  }
}

/**
 * Get list of available import files
 */
export function getAvailableImports(): { fileName: string, filePath: string, size: number, uploaded: Date }[] {
  try {
    if (!fs.existsSync(IMPORT_DIR)) {
      return [];
    }

    return fs.readdirSync(IMPORT_DIR)
      .filter(file => file.startsWith('matchmaker_db_import_') && (file.endsWith('.sql') || file.endsWith('.dump')))
      .map(fileName => {
        const filePath = path.join(IMPORT_DIR, fileName);
        const stats = fs.statSync(filePath);
        
        return {
          fileName,
          filePath,
          size: stats.size,
          uploaded: stats.mtime
        };
      })
      .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime()); // Sort by date, newest first
  } catch (error) {
    console.error('Failed to get available imports:', error);
    return [];
  }
}

/**
 * Delete an import file
 */
export function deleteImport(fileName: string): boolean {
  try {
    const filePath = path.join(IMPORT_DIR, fileName);
    
    // Security check to ensure we're only deleting files in our import directory
    if (!filePath.startsWith(IMPORT_DIR) || !fs.existsSync(filePath)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('Failed to delete import:', error);
    return false;
  }
}