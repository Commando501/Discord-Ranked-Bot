import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { format } from 'date-fns';

// Directory for storing database exports
const EXPORTS_DIR = path.join(process.cwd(), 'exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

/**
 * Generate a filename for the database export
 */
function generateExportFilename(): string {
  const date = format(new Date(), 'yyyyMMdd-HHmmss');
  return `db-export-${date}.sql`;
}

/**
 * Export the PostgreSQL database to a file
 * @returns Promise that resolves to the export file path or rejects with an error
 */
export async function exportDatabase(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const exportFilename = generateExportFilename();
      const exportPath = path.join(EXPORTS_DIR, exportFilename);
      
      // Use pg_dump to export the database
      const pg_dump = spawn('pg_dump', [
        '-c',                        // Clean (drop) database objects before recreating
        '--if-exists',               // Use IF EXISTS when dropping objects
        '-O',                        // Don't output ownership commands
        '-x',                        // Don't dump privileges (grant/revoke)
        '-f', exportPath,            // Output file
        process.env.DATABASE_URL!    // Connection string
      ]);
      
      let errorOutput = '';
      
      pg_dump.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pg_dump.on('close', (code) => {
        if (code === 0) {
          resolve(exportPath);
        } else {
          reject(new Error(`pg_dump failed with code ${code}. Error: ${errorOutput}`));
        }
      });
      
      pg_dump.on('error', (err) => {
        reject(new Error(`Failed to start pg_dump: ${err.message}`));
      });
      
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get list of available database exports
 * @returns Array of export file information
 */
export function getExportsList() {
  try {
    if (!fs.existsSync(EXPORTS_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(EXPORTS_DIR)
      .filter(file => file.endsWith('.sql') || file.endsWith('.dump'))
      .map(fileName => {
        const filePath = path.join(EXPORTS_DIR, fileName);
        const stats = fs.statSync(filePath);
        
        return {
          fileName,
          size: stats.size,
          created: stats.mtime.toISOString(),
          downloadUrl: `/api/database/exports/download/${fileName}`
        };
      })
      .sort((a, b) => {
        // Sort by created date, newest first
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      });
    
    return files;
  } catch (err) {
    console.error('Error getting exports list:', err);
    return [];
  }
}

/**
 * Delete a database export file
 * @param fileName Name of the file to delete
 * @returns True if deletion was successful, false otherwise
 */
export function deleteExportFile(fileName: string): boolean {
  try {
    const filePath = path.join(EXPORTS_DIR, fileName);
    
    // Validate file exists and is within exports directory (avoid path traversal)
    if (!fs.existsSync(filePath) || !filePath.startsWith(EXPORTS_DIR)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error('Error deleting export file:', err);
    return false;
  }
}