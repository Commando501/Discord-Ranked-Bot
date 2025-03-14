import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MmrConfig, mmrConfigSchema } from "@shared/botConfig";
import { Slider } from "@/components/ui/slider";

interface MmrConfigPanelProps {
  config: MmrConfig;
  onChange: (newConfig: MmrConfig) => void;
}

export default function MmrConfigPanel({ config, onChange }: MmrConfigPanelProps) {
  // Create a form with validation
  const form = useForm<MmrConfig>({
    resolver: zodResolver(mmrConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as MmrConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>MMR System Settings</CardTitle>
        <CardDescription>
          Configure how player ratings are calculated and managed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Basic MMR Settings */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Basic MMR Settings</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startingMmr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting MMR</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          max={5000} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Initial MMR value for new players
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="kFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>K-Factor</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            value={[field.value]}
                            min={1}
                            max={64}
                            step={1}
                            onValueChange={([value]) => field.onChange(value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min={1}
                            max={64}
                            className="w-16"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Maximum points a player can gain or lose in a match (1-64)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="mmrCalculationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MMR Calculation Method</FormLabel>
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
                        <SelectItem value="elo">ELO</SelectItem>
                        <SelectItem value="glicko2">Glicko-2</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The algorithm used to calculate MMR changes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Placement Matches */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Placement Matches</div>
              
              <FormField
                control={form.control}
                name="placementMatches"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Placement Matches</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={20} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of matches a player must complete before receiving their initial rank
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Streak Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Win Streak Bonuses</div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="streakSettings.threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Streak Threshold</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={20} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Wins needed to start bonus
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="streakSettings.bonusPerWin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus Per Win</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={50} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Extra MMR per streak win
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="streakSettings.maxBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Bonus</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={5} 
                          max={200} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum streak bonus
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* MMR Restrictions */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">MMR Restrictions</div>
              
              <FormField
                control={form.control}
                name="mmrRangeRestrictions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable MMR Range Restrictions</FormLabel>
                      <FormDescription>
                        Limit matchmaking to players with similar MMR
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
                name="maxMmrDifference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum MMR Difference</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={2000} 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        disabled={!form.watch("mmrRangeRestrictions")}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum allowed MMR difference between players in a match
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