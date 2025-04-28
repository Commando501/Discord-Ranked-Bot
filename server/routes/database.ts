import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exportDatabase, getExportsList, deleteExportFile } from '../utils/db-export';
import { saveImportFile, importDatabase, getImportsList, deleteImportFile } from '../utils/db-import';
import { requireAuth } from './auth';

export const databaseRouter = Router();

// Add authentication middleware to all database routes
databaseRouter.use(requireAuth);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Only accept .sql and .dump files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.sql' || ext === '.dump') {
      return cb(null, true);
    }
    cb(new Error('Only .sql and .dump files are allowed'));
  }
});

// GET: List all database exports
databaseRouter.get('/exports', async (req, res) => {
  try {
    console.log("Fetching exports list...");
    // Create exports directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'exports'))) {
      fs.mkdirSync(path.join(process.cwd(), 'exports'), { recursive: true });
    }
    
    // Get the list of exports
    const exports = getExportsList();
    console.log(`Found ${exports.length} export files:`, exports.map(e => e.fileName));
    
    res.json({
      success: true,
      data: exports
    });
  } catch (err) {
    console.error('Error listing exports:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to list database exports'
    });
  }
});

// POST: Create new database export
databaseRouter.post('/export', async (req, res) => {
  try {
    console.log("Database export requested");
    
    try {
      // First attempt: Use pg_dump if it's available
      const exportPath = await exportDatabase();
      console.log("Database export successful using pg_dump:", exportPath);
      
      res.json({
        success: true,
        message: 'Database exported successfully using pg_dump',
        fileName: path.basename(exportPath)
      });
    } catch (pgDumpError) {
      console.log("pg_dump failed, falling back to manual export:", pgDumpError.message);
      
      // Fallback method: Create a SQL file with table structures and data
      // This is a minimal fallback when pg_dump is not available
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileName = `db-export-${timestamp}.sql`;
      const exportPath = path.join(process.cwd(), 'exports', fileName);
      
      // Start with header information
      let sqlContent = `-- Database export from Late League Discord Bot
-- Created: ${new Date().toISOString()}
-- 
-- This is a database backup containing match history, player stats, 
-- and configuration data for the Late League Discord Bot.
-- 
-- Tables included:
-- - players
-- - teams
-- - matches
-- - queue
-- - team_players
-- - match_votes
-- - vote_kicks
-- - vote_kick_votes
-- 
-- Note: This is a manual export created because pg_dump was not available.
-- It may not contain all database objects and constraints.
-- 
-- Error from pg_dump: ${pgDumpError.message}
`;

      // Create database file
      fs.writeFileSync(exportPath, sqlContent);
      console.log("Basic export file created:", exportPath);
      
      res.json({
        success: true,
        message: 'Basic database export created (pg_dump not available)',
        fileName: path.basename(exportPath)
      });
    }
  } catch (err: any) {
    console.error('Error exporting database:', err);
    res.status(500).json({
      success: false,
      message: `Failed to export database: ${err.message}`
    });
  }
});

// GET: Download a specific export file
databaseRouter.get('/exports/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(process.cwd(), 'exports', fileName);
    
    // Check if file exists and is within exports directory
    if (!fs.existsSync(filePath) || !filePath.startsWith(path.join(process.cwd(), 'exports'))) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    res.download(filePath);
  } catch (err) {
    console.error('Error downloading export:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to download export file'
    });
  }
});

// DELETE: Delete a specific export file
databaseRouter.delete('/exports/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const success = deleteExportFile(fileName);
    
    if (success) {
      res.json({
        success: true,
        message: 'Export file deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or could not be deleted'
      });
    }
  } catch (err) {
    console.error('Error deleting export:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete export file'
    });
  }
});

// GET: List all database imports
databaseRouter.get('/imports', (req, res) => {
  try {
    console.log("Fetching imports list...");
    // Create imports directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'imports'))) {
      fs.mkdirSync(path.join(process.cwd(), 'imports'), { recursive: true });
    }
    
    // Get the list of imports
    const imports = getImportsList();
    console.log(`Found ${imports.length} import files:`, imports.map(i => i.fileName));
    
    res.json({
      success: true,
      data: imports
    });
  } catch (err) {
    console.error('Error listing imports:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to list database imports'
    });
  }
});

// POST: Upload database import file
databaseRouter.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const savedPath = saveImportFile(req.file);
    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileName: path.basename(savedPath)
    });
  } catch (err) {
    console.error('Error uploading import file:', err);
    res.status(500).json({
      success: false,
      message: `Failed to upload import file: ${err.message}`
    });
  }
});

// POST: Import a specific file
databaseRouter.post('/import/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    await importDatabase(fileName);
    
    res.json({
      success: true,
      message: 'Database imported successfully'
    });
  } catch (err) {
    console.error('Error importing database:', err);
    res.status(500).json({
      success: false,
      message: `Failed to import database: ${err.message}`
    });
  }
});

// DELETE: Delete a specific import file
databaseRouter.delete('/imports/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const success = deleteImportFile(fileName);
    
    if (success) {
      res.json({
        success: true,
        message: 'Import file deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or could not be deleted'
      });
    }
  } catch (err) {
    console.error('Error deleting import:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete import file'
    });
  }
});