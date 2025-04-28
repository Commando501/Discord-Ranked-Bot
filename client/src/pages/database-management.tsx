import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableRow, TableHeader, TableHead, TableBody, TableCell, Table } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, FileDown, Database, FileUp, Trash2 } from 'lucide-react';
import { formatFileSize, formatDate } from '@/lib/utils';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

// Types
interface ExportFile {
  fileName: string;
  size: number;
  created: string;
  downloadUrl: string;
}

interface ImportFile {
  fileName: string;
  size: number;
  uploaded: string;
}

const DatabaseManagementPage = () => {
  const [activeTab, setActiveTab] = useState('export');
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuthContext();
  
  const [exports, setExports] = useState<ExportFile[]>([]);
  const [imports, setImports] = useState<ImportFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importingFile, setImportingFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load available exports and imports
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load exports
      const exportsResponse = await apiRequest('GET', '/api/database/exports');
      const exportsData = await exportsResponse.json();
      
      if (exportsResponse.ok && exportsData.success) {
        setExports(exportsData.data || []);
      } else {
        console.error('Failed to load exports:', exportsData);
        setError('Failed to load database exports');
      }
      
      // Load imports
      const importsResponse = await apiRequest('GET', '/api/database/imports');
      const importsData = await importsResponse.json();
      
      if (importsResponse.ok && importsData.success) {
        setImports(importsData.data || []);
      } else {
        console.error('Failed to load imports:', importsData);
        setError('Failed to load database imports');
      }
    } catch (err) {
      console.error('Error loading database files:', err);
      setError('Failed to load database files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle database export
  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('POST', '/api/database/export');
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: 'Database Exported',
          description: 'Database export completed successfully.',
        });
        loadData(); // Refresh the list
      } else {
        console.error('Export failed:', data);
        setError(data.message || 'Failed to export database');
        toast({
          variant: 'destructive',
          title: 'Export Failed',
          description: data.message || 'Failed to export database',
        });
      }
    } catch (err) {
      console.error('Error during export:', err);
      setError('Error during database export. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'An error occurred during database export',
      });
    } finally {
      setExportLoading(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        variant: 'destructive',
        title: 'No File Selected',
        description: 'Please select a file to upload',
      });
      return;
    }

    setImportLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/database/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: 'File Uploaded',
          description: 'Database file uploaded successfully',
        });
        setSelectedFile(null);
        // Reset the file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadData(); // Refresh the list
      } else {
        console.error('Upload failed:', data);
        setError(data.message || 'Failed to upload file');
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: data.message || 'Failed to upload file',
        });
      }
    } catch (err) {
      console.error('Error during upload:', err);
      setError('Error during file upload. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'An error occurred during file upload',
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Handle database import
  const handleImport = async (fileName: string) => {
    setImportingFile(fileName);
    setError(null);
    
    try {
      const response = await apiRequest('POST', `/api/database/import/${fileName}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: 'Database Imported',
          description: 'Database import completed successfully',
        });
      } else {
        console.error('Import failed:', data);
        setError(data.message || 'Failed to import database');
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: data.message || 'Failed to import database',
        });
      }
    } catch (err) {
      console.error('Error during import:', err);
      setError('Error during database import. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Import Error',
        description: 'An error occurred during database import',
      });
    } finally {
      setImportingFile(null);
    }
  };

  // Handle delete export file
  const handleDeleteExport = async (fileName: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/database/exports/${fileName}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: 'File Deleted',
          description: 'Export file deleted successfully',
        });
        setExports(exports.filter(exp => exp.fileName !== fileName));
      } else {
        console.error('Delete failed:', data);
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: data.message || 'Failed to delete file',
        });
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Error',
        description: 'An error occurred while deleting the file',
      });
    }
  };

  // Handle delete import file
  const handleDeleteImport = async (fileName: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/database/imports/${fileName}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: 'File Deleted',
          description: 'Import file deleted successfully',
        });
        setImports(imports.filter(imp => imp.fileName !== fileName));
      } else {
        console.error('Delete failed:', data);
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: data.message || 'Failed to delete file',
        });
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Error',
        description: 'An error occurred while deleting the file',
      });
    }
  };

  // Handle download export file
  const handleDownload = (downloadUrl: string) => {
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Database Management</h1>
          <p className="text-muted-foreground mt-2">Export and import database for system migration</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="export" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export Database</TabsTrigger>
            <TabsTrigger value="import">Import Database</TabsTrigger>
          </TabsList>
          
          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Export</CardTitle>
                <CardDescription>
                  Create a backup of the current database. This will export all database tables.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button 
                  onClick={handleExport} 
                  disabled={exportLoading}
                  className="w-full sm:w-auto"
                >
                  {exportLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Export Database
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Exports</CardTitle>
                <CardDescription>
                  Download or delete previous database exports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : exports.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No exports available
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exports.map((exportFile) => (
                          <TableRow key={exportFile.fileName}>
                            <TableCell className="font-medium truncate max-w-[200px]">
                              {exportFile.fileName}
                            </TableCell>
                            <TableCell>{formatFileSize(exportFile.size)}</TableCell>
                            <TableCell>{formatDate(new Date(exportFile.created))}</TableCell>
                            <TableCell className="space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDownload(exportFile.downloadUrl)}
                              >
                                <FileDown className="h-4 w-4 mr-1" /> Download
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteExport(exportFile.fileName)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Database File</CardTitle>
                <CardDescription>
                  Upload a database file (.sql format) for importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <input
                      id="file-upload"
                      type="file"
                      accept=".sql,.dump"
                      onChange={handleFileSelect}
                      className="rounded-md border border-input p-2"
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected file: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || importLoading}
                  className="w-full sm:w-auto"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Upload File
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Imports</CardTitle>
                <CardDescription>
                  Import or delete previous uploaded database files
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : imports.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No import files available
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {imports.map((importFile) => (
                          <TableRow key={importFile.fileName}>
                            <TableCell className="font-medium truncate max-w-[200px]">
                              {importFile.fileName}
                            </TableCell>
                            <TableCell>{formatFileSize(importFile.size)}</TableCell>
                            <TableCell>{formatDate(new Date(importFile.uploaded))}</TableCell>
                            <TableCell className="space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleImport(importFile.fileName)}
                                disabled={importingFile === importFile.fileName}
                              >
                                {importingFile === importFile.fileName ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...
                                  </>
                                ) : (
                                  <>
                                    <Database className="h-4 w-4 mr-1" /> Import
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteImport(importFile.fileName)}
                                disabled={importingFile === importFile.fileName}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DatabaseManagementPage;