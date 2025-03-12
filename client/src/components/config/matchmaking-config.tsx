import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MatchmakingConfig, matchmakingConfigSchema } from "@shared/botConfig";
import { Slider } from "@/components/ui/slider";

interface MatchmakingConfigPanelProps {
  config: MatchmakingConfig;
  onChange: (newConfig: MatchmakingConfig) => void;
}

export default function MatchmakingConfigPanel({ config, onChange }: MatchmakingConfigPanelProps) {
  // Create a form with validation
  const form = useForm<MatchmakingConfig>({
    resolver: zodResolver(matchmakingConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as MatchmakingConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matchmaking Settings</CardTitle>
        <CardDescription>
          Configure how players are matched and teams are created
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Queue Settings */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Queue Settings</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="queueSizeLimits.min"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Queue Size</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={2} 
                          max={50} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum players needed to create a match
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="queueSizeLimits.max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Queue Size</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={2} 
                          max={50} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum players allowed in the queue
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="queueTimeoutMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Queue Timeout (minutes)</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-4">
                        <Slider
                          value={[field.value]}
                          min={1}
                          max={240}
                          step={1}
                          onValueChange={([value]) => field.onChange(value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={240}
                          className="w-20"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Time after which players are automatically removed from the queue
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Match Creation */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Match Creation</div>
              
              <FormField
                control={form.control}
                name="autoMatchCreation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Automatic Match Creation</FormLabel>
                      <FormDescription>
                        Automatically create matches when enough players are in queue
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
                name="matchCreationIntervalSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Interval (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={5} 
                        max={300} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How often the bot checks the queue to create matches
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="minPlayersPerTeam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Players Per Team</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={10} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum number of players required for each team
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="teamBalanceMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Balance Method</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="random">Random</SelectItem>
                        <SelectItem value="mmr">MMR Balanced</SelectItem>
                        <SelectItem value="role">Role Based</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How teams are balanced when creating matches
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="autoEndMatchHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-End Matches After (hours)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={48} 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Automatically end matches after this duration if not reported
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Announcements */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Match Announcements</div>
              
              <FormField
                control={form.control}
                name="matchAnnouncementFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Creation Announcement</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3}
                        placeholder="Match #{matchId} has been created! Teams: Team {team1} vs Team {team2}"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Format for announcing new matches. Variables: {'{matchId}'}, {'{team1}'}, {'{team2}'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="postMatchResultsFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Results Announcement</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3}
                        placeholder="Match #{matchId} has ended! Winner: {winnerTeam}"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Format for announcing match results. Variables: {'{matchId}'}, {'{winnerTeam}'}, {'{loserTeam}'}
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