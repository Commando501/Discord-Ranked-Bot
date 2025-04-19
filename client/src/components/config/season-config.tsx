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
import { Plus, Trash, Pencil, Save, X, Calendar as CalendarIcon, Upload, Image } from "lucide-react";
import { z } from "zod";
import { rankTierSchema } from "@shared/rankSystem";
import { useToast } from "@/hooks/use-toast";

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

export default function SeasonConfigPanel({ config, onChange }: SeasonConfigPanelProps) {
  // State to manage reward tiers UI
  const [newTierName, setNewTierName] = useState("");
  const [newTierMmr, setNewTierMmr] = useState(0);
  const [newTierDescription, setNewTierDescription] = useState("");
  const [tiers, setTiers] = useState(config.rewardTiers || []);
  const [rankTiers, setRankTiers] = useState(config.rankTiers || []); // Added rank tiers state

  // State for new rank tier inputs
  const [newRankTierName, setNewRankTierName] = useState("");
  const [newRankTierMmr, setNewRankTierMmr] = useState(0);
  const [newRankTierColor, setNewRankTierColor] = useState("#3BA55C");
  const [newRankTierDescription, setNewRankTierDescription] = useState("");
  const [newRankTierIcon, setNewRankTierIcon] = useState("");
  const [editingRankTierIndex, setEditingRankTierIndex] = useState<number | null>(null);
  const [editedRankTier, setEditedRankTier] = useState<RankTier | null>(null);

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

  // Get toast from the hook at component level
  const { toast } = useToast();
  
  // Handle rank icon file upload
  const handleRankIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Get the file
      const file = e.target.files[0];

      try {
        // Create a FormData object
        const formData = new FormData();
        formData.append('file', file);

        // Upload the file using fetch to a new server endpoint
        const response = await fetch('/api/upload/rank-icon', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload icon');
        }

        const data = await response.json();

        // Set the file path from the server response
        setNewRankTierIcon(`ranks/${file.name}`);

        // Show a success message using the pre-defined toast from useToast hook
        toast({
          title: "Icon uploaded successfully",
          description: `Icon saved as ranks/${file.name}`,
        });
      } catch (error) {
        console.error("Error uploading icon:", error);
        toast({
          title: "Upload failed",
          description: "There was an error uploading the icon",
          variant: "destructive",
        });
      }
    }
  };

  // Add a new rank tier
  const addRankTier = () => {
    try {
      const newTier = rankTierSchema.parse({
        name: newRankTierName,
        mmrThreshold: newRankTierMmr,
        color: newRankTierColor,
        description: newRankTierDescription,
        icon: newRankTierIcon || undefined, // Only include if not empty
      });

      // Add new tier and sort by MMR threshold
      const updatedRankTiers = [...rankTiers, newTier].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
      setRankTiers(updatedRankTiers);

      // Update the form data
      onChange({ ...form.getValues(), rankTiers: updatedRankTiers });

      // Reset input fields
      setNewRankTierName("");
      setNewRankTierMmr(0);
      setNewRankTierColor("#3BA55C");
      setNewRankTierDescription("");
      setNewRankTierIcon("");
    } catch (error) {
      console.error("Invalid rank tier data:", error);
    }
  };

    // Remove a rank tier
    const removeRankTier = (index: number) => {
      const updatedRankTiers = [...rankTiers];
      updatedRankTiers.splice(index, 1);
      setRankTiers(updatedRankTiers);
      onChange({...form.getValues(), rankTiers: updatedRankTiers});
    };

  const handleEditRankTier = (index: number) => {
    setEditingRankTierIndex(index);
    setEditedRankTier({...rankTiers[index]});
  };

  const handleSaveRankTier = (index: number) => {
    const updatedRankTiers = [...rankTiers];
    updatedRankTiers[index] = editedRankTier!;
    setRankTiers(updatedRankTiers);
    onChange({...form.getValues(), rankTiers: updatedRankTiers});
    setEditingRankTierIndex(null);
    setEditedRankTier(null);
  };

  const handleCancelRankTierEdit = () => {
    setEditingRankTierIndex(null);
    setEditedRankTier(null);
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

              {/* Rank Tiers UI */}
              <div className="space-y-2">
                {rankTiers.map((tier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                    {editingRankTierIndex === index ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2">
                        <div>
                          <Input
                            value={editedRankTier?.name || ""}
                            onChange={(e) => setEditedRankTier({...editedRankTier!, name: e.target.value})}
                            placeholder="Tier Name"
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            min={0}
                            value={editedRankTier?.mmrThreshold || 0}
                            onChange={(e) => setEditedRankTier({...editedRankTier!, mmrThreshold: parseInt(e.target.value)})}
                            placeholder="MMR Threshold"
                          />
                        </div>
                        <div className="flex">
                          <div 
                            className="w-10 h-10 rounded-l-md flex items-center justify-center" 
                            style={{ backgroundColor: editedRankTier?.color || "#000000" }}
                          ></div>
                          <Input
                            value={editedRankTier?.color || ""}
                            onChange={(e) => setEditedRankTier({...editedRankTier!, color: e.target.value})}
                            placeholder="#000000"
                            className="rounded-l-none"
                          />
                        </div>
                        <div>
                          <Input
                            value={editedRankTier?.description || ""}
                            onChange={(e) => setEditedRankTier({...editedRankTier!, description: e.target.value})}
                            placeholder="Description"
                          />
                        </div>
                        <div>
                          <Input
                            value={editedRankTier?.icon || ""}
                            onChange={(e) => setEditedRankTier({...editedRankTier!, icon: e.target.value})}
                            placeholder="ranks/icon.png"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center">
                        {tier.icon ? (
                          <img 
                            src={tier.icon} 
                            alt={`${tier.name} rank`} 
                            className="w-8 h-8 mr-2 object-contain"
                          />
                        ) : tier.color && (
                          <div 
                            className="w-4 h-4 rounded-full mr-2" 
                            style={{ backgroundColor: tier.color }}
                          ></div>
                        )}
                        <div>
                          <div className="font-medium">{tier.name}</div>
                          <div className="text-sm text-muted-foreground">
                            MMR: {tier.mmrThreshold} - {tier.description}
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      {editingRankTierIndex === index ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleSaveRankTier(index)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleCancelRankTierEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => removeRankTier(index)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditRankTier(index)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
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
              <div className="space-y-4">
                <div className="text-sm font-medium">Add New Rank Tier</div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <FormLabel htmlFor="rankTierName">Tier Name</FormLabel>
                    <Input
                      id="rankTierName"
                      value={newRankTierName}
                      onChange={(e) => setNewRankTierName(e.target.value)}
                      placeholder="Diamond"
                    />
                  </div>

                  <div>
                    <FormLabel htmlFor="rankTierMmr">MMR Threshold</FormLabel>
                    <Input
                      id="rankTierMmr"
                      type="number"
                      min={0}
                      value={newRankTierMmr}
                      onChange={(e) => setNewRankTierMmr(parseInt(e.target.value))}
                      placeholder="2000"
                    />
                  </div>

                  <div>
                    <FormLabel htmlFor="rankTierColor">Color (Hex)</FormLabel>
                    <div className="flex">
                      <div 
                        className="w-10 h-10 rounded-l-md flex items-center justify-center" 
                        style={{ backgroundColor: newRankTierColor }}
                      ></div>
                      <Input
                        id="rankTierColor"
                        value={newRankTierColor}
                        onChange={(e) => setNewRankTierColor(e.target.value)}
                        placeholder="#3BA55C"
                        className="rounded-l-none"
                      />
                    </div>
                  </div>

                  <div>
                    <FormLabel htmlFor="rankTierDescription">Description</FormLabel>
                    <Input
                      id="rankTierDescription"
                      value={newRankTierDescription}
                      onChange={(e) => setNewRankTierDescription(e.target.value)}
                      placeholder="Top tier players"
                    />
                  </div>

                  <div>
                    <FormLabel htmlFor="rankTierIcon">Rank Icon</FormLabel>
                    <div className="flex items-center space-x-2">
                      {newRankTierIcon ? (
                        <div className="flex items-center space-x-2">
                          <img 
                            src={newRankTierIcon} 
                            alt="Rank icon preview" 
                            className="w-8 h-8 object-contain"
                          />
                          <Input
                            id="rankTierIconPath"
                            value={newRankTierIcon}
                            onChange={(e) => setNewRankTierIcon(e.target.value)}
                            placeholder="ranks/icon.png"
                          />
                        </div>
                      ) : (
                        <div className="relative w-full">
                          <input
                            type="file"
                            id="rankTierIcon"
                            accept="image/*"
                            className="hidden"
                            onChange={handleRankIconUpload}
                          />
                          <Button 
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => document.getElementById('rankTierIcon')?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Icon
                          </Button>
                          <span className="text-xs text-muted-foreground block mt-1">
                            Or enter path: ranks/filename.png
                          </span>
                          <Input
                            id="rankTierIconPath"
                            value={newRankTierIcon}
                            onChange={(e) => setNewRankTierIcon(e.target.value)}
                            placeholder="ranks/icon.png"
                            className="mt-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button 
                  type="button" 
                  onClick={addRankTier} 
                  className="mt-2"
                  disabled={!newRankTierName || !newRankTierDescription || !newRankTierColor}
                >
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