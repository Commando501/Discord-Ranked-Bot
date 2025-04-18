import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SeasonConfig, seasonConfigSchema } from "@shared/botConfig";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash } from "lucide-react";
import { z } from "zod";
import { rankTierSchema } from "@shared/rankSystem";

interface SeasonConfigPanelProps {
  config: SeasonConfig;
  onChange: (newConfig: SeasonConfig) => void;
}

// Define a schema for reward tiers
const rewardTierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mmrThreshold: z.number().int().min(0, "MMR threshold must be at least 0"),
  description: z.string().min(1, "Description is required"),
});

// Import rankTierSchema from shared directory instead of redefining it
import { rankTierSchema } from "@shared/rankSystem";


export default function SeasonConfigPanel({ config, onChange }: SeasonConfigPanelProps) {
  // State to manage reward tiers UI
  const [newTierName, setNewTierName] = useState("");
  const [newTierMmr, setNewTierMmr] = useState(0);
  const [newTierDescription, setNewTierDescription] = useState("");
  const [tiers, setTiers] = useState(config.rewardTiers || []);
  const [rankTiers, setRankTiers] = useState(config.rankTiers || []); // Added rank tiers state


  // Create a form with validation
  const form = useForm<SeasonConfig>({
    resolver: zodResolver(seasonConfigSchema),
    defaultValues: config,
  });

  // Update tiers when config changes
  React.useEffect(() => {
    if (config.rewardTiers) {
      setTiers(config.rewardTiers);
    }
    if (config.rankTiers) {
      setRankTiers(config.rankTiers);
    }
  }, [config.rewardTiers, config.rankTiers]);

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      // Make sure to include the tiers and rankTiers
      onChange({ ...value, rewardTiers: tiers, rankTiers: rankTiers } as SeasonConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange, tiers, rankTiers]);

  // Add a new tier
  const addTier = () => {
    try {
      const newTier = rewardTierSchema.parse({
        name: newTierName,
        mmrThreshold: newTierMmr,
        description: newTierDescription,
      });

      // Add new tier and sort by MMR threshold
      const updatedTiers = [...tiers, newTier].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
      setTiers(updatedTiers);

      // Update the form data
      onChange({ ...form.getValues(), rewardTiers: updatedTiers });

      // Reset input fields
      setNewTierName("");
      setNewTierMmr(0);
      setNewTierDescription("");
    } catch (error) {
      console.error("Invalid tier data:", error);
    }
  };

  //Remove a tier
  const removeTier = (index: number) => {
    const updatedTiers = [...tiers];
    updatedTiers.splice(index, 1);
    setTiers(updatedTiers);
    onChange({...form.getValues(), rewardTiers: updatedTiers});
  }

  // Add a new rank tier
  const addRankTier = () => {
    //Implementation for adding a new rank tier would go here, mirroring the addTier function
    //This would require a new state variable for newRankTierName etc. and a function to handle adding the new rank tier to the rankTiers state
  };

    // Remove a rank tier
    const removeRankTier = (index: number) => {
      const updatedRankTiers = [...rankTiers];
      updatedRankTiers.splice(index, 1);
      setRankTiers(updatedRankTiers);
      onChange({...form.getValues(), rankTiers: updatedRankTiers});
    };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return format(new Date(dateString), "PPP");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Management</CardTitle>
        <CardDescription>
          Configure competitive seasons and end-of-season rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Basic Season Settings */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Season Settings</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="currentSeason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Season Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        The number of the current season
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mmrResetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MMR Reset Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full">Full Reset</SelectItem>
                          <SelectItem value="soft">Soft Reset</SelectItem>
                          <SelectItem value="none">No Reset</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How MMR is reset between seasons
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="seasonStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Season Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full justify-start text-left font-normal ${
                                !field.value ? "text-muted-foreground" : ""
                              }`}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? formatDate(field.value) : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? date.toISOString() : undefined)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When the current season started
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seasonEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Season End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full justify-start text-left font-normal ${
                                !field.value ? "text-muted-foreground" : ""
                              }`}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? formatDate(field.value) : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? date.toISOString() : undefined)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When the current season will end
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="placementMatchRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Placement Matches</FormLabel>
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
                      Number of matches required for seasonal placement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableEndOfSeasonAnnouncements"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">End of Season Announcements</FormLabel>
                      <FormDescription>
                        Send announcements when seasons end
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

            {/* Reward Tiers */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Reward Tiers</div>

              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        MMR: {tier.mmrThreshold} - {tier.description}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeTier(index)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {tiers.length === 0 && (
                  <div className="text-center p-4 border rounded-md text-muted-foreground">
                    No reward tiers defined
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="text-sm font-medium">Add New Tier</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <FormLabel htmlFor="tierName">Tier Name</FormLabel>
                    <Input
                      id="tierName"
                      value={newTierName}
                      onChange={(e) => setNewTierName(e.target.value)}
                      placeholder="Diamond"
                    />
                  </div>

                  <div>
                    <FormLabel htmlFor="tierMmr">MMR Threshold</FormLabel>
                    <Input
                      id="tierMmr"
                      type="number"
                      min={0}
                      value={newTierMmr}
                      onChange={(e) => setNewTierMmr(parseInt(e.target.value))}
                      placeholder="2000"
                    />
                  </div>

                  <div>
                    <FormLabel htmlFor="tierDescription">Description</FormLabel>
                    <Input
                      id="tierDescription"
                      value={newTierDescription}
                      onChange={(e) => setNewTierDescription(e.target.value)}
                      placeholder="Top tier players"
                    />
                  </div>
                </div>

                <Button 
                  type="button" 
                  onClick={addTier} 
                  className="mt-2"
                  disabled={!newTierName || !newTierDescription}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tier
                </Button>
              </div>
            </div>

            {/* Rank Tiers Section */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Rank Tiers</div>

              {/* Rank Tiers UI -  mirroring the Reward Tiers UI */}
              <div className="space-y-2">
                {rankTiers.map((tier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        MMR: {tier.mmrThreshold} - {tier.description}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeRankTier(index)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {rankTiers.length === 0 && (
                  <div className="text-center p-4 border rounded-md text-muted-foreground">
                    No rank tiers defined
                  </div>
                )}
              </div>

              <Separator />

              {/* Add New Rank Tier Section */}
              {/* This would need to be fleshed out with actual input fields for rank tier properties */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Add New Rank Tier</div>
                <Button type="button" onClick={addRankTier} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rank Tier
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}