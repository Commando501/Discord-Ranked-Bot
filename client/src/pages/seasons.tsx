import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SeasonConfig, seasonConfigSchema } from "@shared/botConfig";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, AlertTriangle, Calendar, Loader2, Trophy, RotateCcw } from "lucide-react";

// Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import SeasonConfigPanel from "@/components/config/season-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SeasonsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("manage");
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);
  const [showDistributeRewardsDialog, setShowDistributeRewardsDialog] = useState(false);
  const [showResetDataDialog, setShowResetDataDialog] = useState(false); // Added state for reset dialog
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Start new season mutation
  const startNewSeason = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/seasons/new', 'POST');
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      setShowNewSeasonDialog(false);
      toast({
        title: "New season started",
        description: data.message || "Season has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Failed to start new season",
        description: "There was an error starting the new season. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to start new season:", error);
    }
  });

  // Distribute rewards mutation
  const distributeRewards = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/seasons/distribute-rewards', 'POST');
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      setShowDistributeRewardsDialog(false);
      toast({
        title: "Rewards distributed",
        description: data.message || "Season rewards have been distributed successfully.",
      });
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        title: "Failed to distribute rewards",
        description: error?.response?.data?.message || "There was an error distributing rewards. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to distribute rewards:", error);
    }
  });

  // Reset all season data
  const resetSeasonData = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/seasons/reset-data', 'POST');
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      setShowResetDataDialog(false);
      toast({
        title: "Season Data Reset",
        description: `All match history has been archived and player stats have been reset.`,
      });
      // Invalidate various queries to refresh data across the app
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/matches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/top'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Error Resetting Season Data",
        description: "There was a problem resetting the season data. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to reset season data:", error);
    },
  });


  // Handle starting a new season
  const handleStartNewSeason = () => {
    setIsProcessing(true);
    startNewSeason.mutate();
  };

  // Handle distributing rewards
  const handleDistributeRewards = () => {
    setIsProcessing(true);
    distributeRewards.mutate();
  };

  // Handle reset season data
  const handleResetSeasonData = () => {
    setIsProcessing(true);
    resetSeasonData.mutate();
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
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowNewSeasonDialog(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Start New Season
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowDistributeRewardsDialog(true)}
                  disabled={!config.rewardTiers || config.rewardTiers.length === 0}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Distribute Rewards
                </Button>
                <Separator className="my-2" />
                <Button
                  variant="destructive"
                  onClick={() => setShowResetDataDialog(true)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset All Season Data
                </Button>

                {!config.rewardTiers || config.rewardTiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Configure reward tiers to enable distribution
                  </p>
                ) : null}
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

      {/* New Season Dialog */}
      <AlertDialog open={showNewSeasonDialog} onOpenChange={setShowNewSeasonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start New Season</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start a new season? This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Increment the season number to {(config.currentSeason || 1) + 1}</li>
                <li>Set today as the season start date</li>
                <li>Set the end date to 3 months from now</li>
                {config.mmrResetType !== 'none' && (
                  <li>Apply MMR reset ({config.mmrResetType}) to all players</li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent the dialog from closing automatically (we'll close it in the onSuccess callback)
                e.preventDefault();
                handleStartNewSeason();
              }}
              disabled={isProcessing}
            >
              {isProcessing && startNewSeason.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start New Season"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Distribute Rewards Dialog */}
      <AlertDialog open={showDistributeRewardsDialog} onOpenChange={setShowDistributeRewardsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Distribute Season Rewards</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to distribute the rewards for Season {config.currentSeason}?
              This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Calculate rewards based on player MMR and configured tiers</li>
                <li>Send reward notification messages to qualifying players</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDistributeRewards();
              }}
              disabled={isProcessing}
            >
              {isProcessing && distributeRewards.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Distribute Rewards"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Season Data Dialog */}
      <AlertDialog open={showResetDataDialog} onOpenChange={setShowResetDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" /> Reset All Season Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-3">
                <span className="font-semibold">WARNING:</span> This action cannot be undone. All match history and player data will be reset.
              </div>

              This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Archive all match history</li>
                <li>Reset all player stats to defaults (MMR, wins, losses, streaks)</li>
                <li>Clear the current queue</li>
                <li>Reset the season number to 1</li>
              </ul>

              <div className="mt-3 font-medium">
                Type "RESET" below to confirm this destructive action:
              </div>
              <input
                className="w-full mt-2 p-2 border border-red-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Type RESET to confirm"
                onChange={(e) => {
                  const confirmButton = document.getElementById('confirm-reset-button') as HTMLButtonElement;
                  if (confirmButton) {
                    confirmButton.disabled = e.target.value !== 'RESET' || isProcessing;
                  }
                }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-reset-button"
              onClick={(e) => {
                e.preventDefault();
                handleResetSeasonData();
              }}
              disabled={true} // Disabled by default until RESET is typed
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isProcessing && resetSeasonData.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Reset All Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}