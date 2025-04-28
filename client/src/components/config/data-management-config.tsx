import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DataManagementConfig, dataManagementConfigSchema } from "@shared/botConfig";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast"; // Assuming toast is available

interface DataManagementConfigPanelProps {
  config: DataManagementConfig;
  onChange: (newConfig: DataManagementConfig) => void;
}

export default function DataManagementConfigPanel({ config, onChange }: DataManagementConfigPanelProps) {
  // Create a form with validation
  const form = useForm<DataManagementConfig>({
    resolver: zodResolver(dataManagementConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as DataManagementConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  // Updated handleDownloadData function
  const handleDownloadData = async () => {
    try {
      // Call the export API endpoint
      const response = await fetch('/api/admin/export-database', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export database');
      }

      // Get the blob data
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;

      // Get current date for filename
      const date = new Date().toISOString().split('T')[0];
      a.download = `matchmaking-db-export-${date}.json`;

      // Trigger download
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Database has been exported successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error('Error downloading data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export database data.",
        variant: "destructive",
      });
    }
  };

  // Mock function for upload action
  const handleUploadData = () => {
    // This would handle data import on the server in a real app
    console.log("Data import requested");
  };

  // Mock function for backup action
  const handleTriggerBackup = () => {
    // This would trigger a manual backup on the server in a real app
    console.log("Manual backup requested");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Management</CardTitle>
        <CardDescription>
          Configure data retention, backups, and exports
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Data Retention */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Data Retention</div>

              <FormField
                control={form.control}
                name="dataRetentionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Retention Period (days)</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-4">
                        <Slider
                          value={[field.value]}
                          min={30}
                          max={3650}
                          step={30}
                          onValueChange={([value]) => field.onChange(value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min={30}
                          max={3650}
                          className="w-24"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      How long to keep match and player data (30 days to 10 years)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Backup Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Backup Settings</div>

              <FormField
                control={form.control}
                name="backupSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Automatic Backup Schedule</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How frequently to automatically back up bot data
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTriggerBackup}
                  className="w-full md:w-auto"
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Trigger Manual Backup
                </Button>
              </div>
            </div>

            {/* Data Export */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Data Export and Import</div>

              <FormField
                control={form.control}
                name="enableDataExports"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Data Exports</FormLabel>
                      <FormDescription>
                        Allow administrators to export match and player data
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableDataImport"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Data Import</FormLabel>
                      <FormDescription>
                        Allow administrators to import data from external sources
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("enableDataImport") && (
                <Alert variant="warning" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Enabling data imports can potentially overwrite existing data.
                    Make sure to back up your data before performing any imports.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadData}
                  disabled={!form.watch("enableDataExports")}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUploadData}
                  disabled={!form.watch("enableDataImport")}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}