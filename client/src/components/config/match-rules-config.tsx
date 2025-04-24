import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MatchRulesConfig, matchRulesConfigSchema } from "@shared/botConfig";
import { Slider } from "@/components/ui/slider";

interface MatchRulesConfigPanelProps {
  config: MatchRulesConfig;
  onChange: (newConfig: MatchRulesConfig) => void;
}

export default function MatchRulesConfigPanel({ config, onChange }: MatchRulesConfigPanelProps) {
  // Create a form with validation
  const form = useForm<MatchRulesConfig>({
    resolver: zodResolver(matchRulesConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as MatchRulesConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Rules</CardTitle>
        <CardDescription>
          Configure rules for active matches and voting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Vote System Settings */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Vote System Settings</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="voteSystemSettings.majorityPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Majority Percentage</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            value={[field.value]}
                            min={50}
                            max={100}
                            step={5}
                            onValueChange={([value]) => field.onChange(value)}
                            className="flex-1"
                          />
                          <div className="w-12 text-center">
                            {field.value}%
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Percentage of votes required for a vote to pass
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="voteSystemSettings.minVotesNeeded"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Votes Required</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum number of votes needed regardless of percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Match Time Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Match Time Settings</div>
              
              <FormField
                control={form.control}
                name="matchTimeLimitHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Time Limit (hours)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0.5} 
                        max={48} 
                        step={0.5}
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum time allowed for a match to be completed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="noShowTimeoutMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No-Show Timeout (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time to wait for missing players before allowing a forfeit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Match Player Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Player Requirements</div>
              
              <FormField
                control={form.control}
                name="minPlayersToStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Players to Start</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum players required to be present to start a match
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Game Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Game Settings</div>
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="enableForfeit"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Forfeit</FormLabel>
                        <FormDescription>
                          Allow teams to forfeit matches
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
                  name="allowSubstitutes"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow Substitutes</FormLabel>
                        <FormDescription>
                          Allow players to be substituted during a match
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
            
            {/* Player Rotation Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Player Rotation</div>
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="playerRotation.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Player Rotation</FormLabel>
                        <FormDescription>
                          Automatically rotate players out of lobbies based on configured rules
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
                  name="playerRotation.rotationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rotation Method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!form.watch("playerRotation.enabled")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual (Admin Only)</SelectItem>
                          <SelectItem value="votekick">Vote Kick</SelectItem>
                          <SelectItem value="losses">Based on Losses</SelectItem>
                          <SelectItem value="timeout">Timeout After Match</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How players are rotated out of active lobbies
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="playerRotation.autoRotateOnLosses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Losses Before Rotation</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={5} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          disabled={!form.watch("playerRotation.enabled") || form.watch("playerRotation.rotationMethod") !== "losses"}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of consecutive losses before a player is rotated out (only applies to loss-based rotation)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="playerRotation.timeoutMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={5} 
                          max={120} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          disabled={!form.watch("playerRotation.enabled") || form.watch("playerRotation.rotationMethod") !== "timeout"}
                        />
                      </FormControl>
                      <FormDescription>
                        How long a player must wait before rejoining after being rotated out (only applies to timeout-based rotation)
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