import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationConfig, notificationConfigSchema } from "@shared/botConfig";
import { Slider } from "@/components/ui/slider";

interface NotificationConfigPanelProps {
  config: NotificationConfig;
  onChange: (newConfig: NotificationConfig) => void;
}

export default function NotificationConfigPanel({ config, onChange }: NotificationConfigPanelProps) {
  // Create a form with validation
  const form = useForm<NotificationConfig>({
    resolver: zodResolver(notificationConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as NotificationConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure how and when notifications are sent to users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Reminder Settings */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Match Reminders</div>
              
              <FormField
                control={form.control}
                name="matchReminders"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Match Reminders</FormLabel>
                      <FormDescription>
                        Send reminders to players before their matches
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
                name="reminderMinutesBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder Time (minutes)</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-4">
                        <Slider
                          value={[field.value]}
                          min={1}
                          max={60}
                          step={1}
                          onValueChange={([value]) => field.onChange(value)}
                          className="flex-1"
                          disabled={!form.watch("matchReminders")}
                        />
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          className="w-20"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          disabled={!form.watch("matchReminders")}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      How many minutes before a match to send reminders
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Direct Message Notifications */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Direct Message Notifications</div>
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="dmNotifications.matchCreated"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Match Created</FormLabel>
                        <FormDescription>
                          Notify players when they're added to a new match
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
                  name="dmNotifications.matchReminder"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Match Reminder</FormLabel>
                        <FormDescription>
                          Send match reminders via DM
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
                  name="dmNotifications.matchEnded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Match Ended</FormLabel>
                        <FormDescription>
                          Notify players when their match has ended
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
                  name="dmNotifications.queueTimeout"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Queue Timeout</FormLabel>
                        <FormDescription>
                          Notify players when they've been removed from the queue
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
              </div>
            </div>
            
            {/* Channel Notifications */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Channel Notifications</div>
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="channelNotifications.matchCreated"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Match Created</FormLabel>
                        <FormDescription>
                          Announce new matches in the announcement channel
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
                  name="channelNotifications.matchEnded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Match Ended</FormLabel>
                        <FormDescription>
                          Announce match results in the announcement channel
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
                  name="channelNotifications.queueStatus"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Queue Status</FormLabel>
                        <FormDescription>
                          Update the announcement channel with queue status
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
              </div>
            </div>
            
            {/* Advanced Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Advanced Settings</div>
              
              <FormField
                control={form.control}
                name="enableRoleMentions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Role Mentions</FormLabel>
                      <FormDescription>
                        Allow bot to mention roles in notifications
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
                name="announcementChannelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Announcement Channel ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Discord channel ID (optional)" 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Channel where match announcements will be posted
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}