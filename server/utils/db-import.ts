import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Directory for storing database imports
const IMPORTS_DIR = path.join(process.cwd(), 'imports');

// Ensure imports directory exists
if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

/**
 * Save an uploaded file to the imports directory
 * @param file File buffer and metadata
 * @returns Saved file path
 */
export function saveImportFile(file: Express.Multer.File): string {
  const filePath = path.join(IMPORTS_DIR, file.originalname);
  fs.writeFileSync(filePath, file.buffer);
  return filePath;
}

/**
 * Import a database file using psql
 * @param fileName Name of the file to import
 * @returns Promise that resolves when import is complete
 */
export async function importDatabase(fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(IMPORTS_DIR, fileName);
      
      // Validate file exists and is within imports directory (avoid path traversal)
      if (!fs.existsSync(filePath) || !filePath.startsWith(IMPORTS_DIR)) {
        reject(new Error('File not found or invalid path'));
        return;
      }
      
      // Use psql to import the database
      const psql = spawn('psql', [
        process.env.DATABASE_URL!,  // Connection string
        '-f', filePath              // Import file
      ]);
      
      let errorOutput = '';
      
      psql.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('PSQL stderr:', output);
        errorOutput += output;
      });
      
      psql.stdout.on('data', (data) => {
        console.log('PSQL stdout:', data.toString());
      });
      
      psql.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`psql failed with code ${code}. Error: ${errorOutput}`));
        }
      });
      
      psql.on('error', (err) => {
        reject(new Error(`Failed to start psql: ${err.message}`));
      });
      
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get list of available database import files
 * @returns Array of import file information
 */
export function getImportsList() {
  try {
    if (!fs.existsSync(IMPORTS_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(IMPORTS_DIR)
      .filter(file => file.endsWith('.sql') || file.endsWith('.dump'))
      .map(fileName => {
        const filePath = path.join(IMPORTS_DIR, fileName);
        const stats = fs.statSync(filePath);
        
        return {
          fileName,
          size: stats.size,
          uploaded: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => {
        // Sort by uploaded date, newest first
        return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
      });
    
    return files;
  } catch (err) {
    console.error('Error getting imports list:', err);
    return [];
  }
}

/**
 * Delete a database import file
 * @param fileName Name of the file to delete
 * @returns True if deletion was successful, false otherwise
 */
export function deleteImportFile(fileName: string): boolean {
  try {
    const filePath = path.join(IMPORTS_DIR, fileName);
    
    // Validate file exists and is within imports directory (avoid path traversal)
    if (!fs.existsSync(filePath) || !filePath.startsWith(IMPORTS_DIR)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error('Error deleting import file:', err);
    return false;
  }
}