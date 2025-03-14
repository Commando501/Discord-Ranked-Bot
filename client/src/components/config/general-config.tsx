import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { generalConfigSchema, GeneralConfig } from "@shared/botConfig";

interface GeneralConfigPanelProps {
  config: GeneralConfig;
  onChange: (newConfig: GeneralConfig) => void;
}

export default function GeneralConfigPanel({ config, onChange }: GeneralConfigPanelProps) {
  // Create a form with validation
  const form = useForm<GeneralConfig>({
    resolver: zodResolver(generalConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as GeneralConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Bot Settings</CardTitle>
        <CardDescription>
          Configure the basic settings for the Discord bot
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bot Status Section */}
              <div className="space-y-4">
                <div className="text-lg font-medium">Bot Presence</div>
                
                <FormField
                  control={form.control}
                  name="botStatus.activity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select activity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PLAYING">Playing</SelectItem>
                          <SelectItem value="WATCHING">Watching</SelectItem>
                          <SelectItem value="LISTENING">Listening to</SelectItem>
                          <SelectItem value="COMPETING">Competing in</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        This will be displayed as the bot's activity status
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="botStatus.statusMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Message</FormLabel>
                      <FormControl>
                        <Input placeholder="Matchmaking" {...field} />
                      </FormControl>
                      <FormDescription>
                        Custom message to display in the bot's status (max 128 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Command Settings */}
              <div className="space-y-4">
                <div className="text-lg font-medium">Command Settings</div>
                
                <FormField
                  control={form.control}
                  name="commandPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="!" {...field} maxLength={5} />
                      </FormControl>
                      <FormDescription>
                        Character to prefix text commands (max 5 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="adminRoleIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Role IDs</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter role IDs separated by commas" 
                          value={field.value.join(',')}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? value.split(',').map(id => id.trim()) : []);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Discord role IDs that have admin permissions for the bot
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Logging Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Logging & Errors</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="loggingLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logging Level</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="debug">Debug</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warn">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The verbosity level for bot logs
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="errorNotificationChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Error Notification Channel</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Discord channel ID (optional)" 
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Channel where bot errors will be posted
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="logEventChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Log Channel</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Discord channel ID (optional)" 
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Channel where important bot events will be logged
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}