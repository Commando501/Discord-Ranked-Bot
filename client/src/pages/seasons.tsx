import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SeasonConfig, seasonConfigSchema } from "@shared/botConfig";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

// Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import SeasonConfigPanel from "@/components/config/season-config";
import { Loader2, Calendar, Trophy, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SeasonsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("manage");

  // Fetch season configuration from API
  const { data: botConfig, isLoading, error } = useQuery({
    queryKey: ['/api/config'],
  });
  
  // Extract the season management section
  const config = botConfig?.seasonManagement as SeasonConfig | undefined;

  // Save season configuration
  const updateSeasonConfig = useMutation({
    mutationFn: async (updatedConfig: SeasonConfig) => {
      return apiRequest('/api/config/seasonManagement', 'PATCH', updatedConfig);
    },
    onSuccess: () => {
      toast({
        title: "Season configuration updated",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    },
    onError: (error) => {
      toast({
        title: "Error updating configuration",
        description: "There was a problem saving your changes. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to update config:", error);
    },
  });

  // Handle form submission
  const handleConfigChange = (updatedConfig: SeasonConfig) => {
    updateSeasonConfig.mutate(updatedConfig);
  };

  // Calculate time remaining in current season
  const getSeasonTimeRemaining = () => {
    if (!config?.seasonEndDate) return "No end date set";
    
    const endDate = new Date(config.seasonEndDate);
    const now = new Date();
    
    if (endDate < now) return "Season has ended";
    
    const diffTime = Math.abs(endDate.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return `${diffDays} days remaining`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Failed to load season data</h2>
        <p className="text-muted-foreground">There was an error loading the season configuration.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/config'] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Season Management</h1>
        <Badge variant="outline" className="text-sm px-3 py-1 flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {getSeasonTimeRemaining()}
        </Badge>
      </div>

      <Tabs defaultValue="manage" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="manage">Manage Current Season</TabsTrigger>
          <TabsTrigger value="history">Season History</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>Season {config.currentSeason}</CardTitle>
                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500">Active</Badge>
                </div>
                <CardDescription>
                  Configure settings for the current competitive season
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Season Start</span>
                    <p className="font-medium">
                      {config.seasonStartDate 
                        ? new Date(config.seasonStartDate).toLocaleDateString() 
                        : "Not set"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Season End</span>
                    <p className="font-medium">
                      {config.seasonEndDate 
                        ? new Date(config.seasonEndDate).toLocaleDateString() 
                        : "Not set"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">MMR Reset Type</span>
                    <p className="font-medium capitalize">{config.mmrResetType}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Placement Matches</span>
                    <p className="font-medium">{config.placementMatchRequirements}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <h3 className="font-medium">Reward Tiers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.rewardTiers && config.rewardTiers.length > 0 ? (
                      config.rewardTiers.map((tier, index) => (
                        <Card key={index} className="bg-muted/40">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold">{tier.name}</h4>
                              <Badge variant="secondary">{tier.mmrThreshold}+ MMR</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-muted-foreground col-span-2 text-center py-6">
                        No reward tiers configured
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Season Actions</CardTitle>
                <CardDescription>
                  Manage the current competitive season
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" variant="outline">
                  <Calendar className="mr-2 h-4 w-4" />
                  Start New Season
                </Button>
                <Button className="w-full" variant="outline">
                  <Trophy className="mr-2 h-4 w-4" />
                  Distribute Rewards
                </Button>
              </CardContent>
            </Card>
          </div>

          <SeasonConfigPanel config={config} onChange={handleConfigChange} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Season History</CardTitle>
              <CardDescription>
                View statistics from previous competitive seasons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No previous season data available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}