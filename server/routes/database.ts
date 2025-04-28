import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exportDatabase, getAvailableExports, deleteExport } from '../utils/db-export';
import { importDatabase, uploadImportFile, getAvailableImports, deleteImport } from '../utils/db-import';

// Create multer instance for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  }
});

// Admin middleware function (placeholder - reuse your existing auth middleware)
function adminMiddleware(req: Request, res: Response, next: express.NextFunction) {
  // Check if the user is authenticated and is an admin
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  next();
}

export function registerDatabaseRoutes(app: express.Express) {
  // Create export directory if it doesn't exist
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Create import directory if it doesn't exist
  const importDir = path.join(process.cwd(), 'imports');
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
  }

  /**
   * Export the database
   * POST /api/database/export
   */
  app.post('/api/database/export', adminMiddleware, async (req: Request, res: Response) => {
    try {
      const result = await exportDatabase();
      res.status(200).json({
        success: true,
        message: 'Database exported successfully',
        data: {
          fileName: result.fileName,
          filePath: result.filePath
        }
      });
    } catch (error) {
      console.error('Error exporting database:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export database',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get a list of available exports
   * GET /api/database/exports
   */
  app.get('/api/database/exports', adminMiddleware, (req: Request, res: Response) => {
    try {
      const exports = getAvailableExports();
      res.status(200).json({
        success: true,
        data: exports.map(exp => ({
          fileName: exp.fileName,
          size: exp.size,
          created: exp.created,
          downloadUrl: `/api/database/exports/${exp.fileName}`
        }))
      });
    } catch (error) {
      console.error('Error getting exports:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get exports',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Download an export file
   * GET /api/database/exports/:fileName
   */
  app.get('/api/database/exports/:fileName', adminMiddleware, (req: Request, res: Response) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(exportDir, fileName);

      // Security check - ensure the file is in the exports directory
      if (!filePath.startsWith(exportDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Export file not found'
        });
      }

      res.download(filePath);
    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download export',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Delete an export file
   * DELETE /api/database/exports/:fileName
   */
  app.delete('/api/database/exports/:fileName', adminMiddleware, (req: Request, res: Response) => {
    try {
      const fileName = req.params.fileName;
      const success = deleteExport(fileName);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Export deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Export file not found or could not be deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting export:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete export',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Upload and import a database file
   * POST /api/database/import
   */
  app.post('/api/database/import', adminMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Upload file to imports directory
      const filePath = await uploadImportFile(req.file.buffer, req.file.originalname);

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filePath,
          fileName: path.basename(filePath)
        }
      });
    } catch (error) {
      console.error('Error uploading import file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload import file',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Import a previously uploaded database file
   * POST /api/database/import/:fileName
   */
  app.post('/api/database/import/:fileName', adminMiddleware, async (req: Request, res: Response) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(importDir, fileName);

      // Security check - ensure the file is in the imports directory
      if (!filePath.startsWith(importDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Import file not found'
        });
      }

      await importDatabase(filePath);

      res.status(200).json({
        success: true,
        message: 'Database imported successfully'
      });
    } catch (error) {
      console.error('Error importing database:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import database',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get a list of available imports
   * GET /api/database/imports
   */
  app.get('/api/database/imports', adminMiddleware, (req: Request, res: Response) => {
    try {
      const imports = getAvailableImports();
      res.status(200).json({
        success: true,
        data: imports.map(imp => ({
          fileName: imp.fileName,
          size: imp.size,
          uploaded: imp.uploaded
        }))
      });
    } catch (error) {
      console.error('Error getting imports:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get imports',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Delete an import file
   * DELETE /api/database/imports/:fileName
   */
  app.delete('/api/database/imports/:fileName', adminMiddleware, (req: Request, res: Response) => {
    try {
      const fileName = req.params.fileName;
      const success = deleteImport(fileName);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Import deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Import file not found or could not be deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting import:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete import',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}