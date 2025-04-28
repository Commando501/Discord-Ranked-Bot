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
    const exports = getExportsList();
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
    const exportPath = await exportDatabase();
    res.json({
      success: true,
      message: 'Database exported successfully',
      fileName: path.basename(exportPath)
    });
  } catch (err) {
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
    const imports = getImportsList();
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