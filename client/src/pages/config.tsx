import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AppLayout from "@/components/layout/app-layout";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Import configuration components
import GeneralConfigPanel from "../components/config/general-config";
import MatchmakingConfigPanel from "../components/config/matchmaking-config";
import MmrConfigPanel from "../components/config/mmr-config";
import SeasonConfigPanel from "../components/config/season-config";
import MatchRulesConfigPanel from "../components/config/match-rules-config";
import NotificationConfigPanel from "../components/config/notification-config";
import IntegrationConfigPanel from "../components/config/integration-config";
import DataManagementConfigPanel from "../components/config/data-management-config";

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [editedConfig, setEditedConfig] = useState<any>(null);
  
  // Fetch bot configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['/api/config'],
    refetchOnWindowFocus: false
  });

  // Save specific configuration section
  const updateSection = useMutation({
    mutationFn: async (section: string) => {
      if (!editedConfig || !editedConfig[section]) return null;
      
      return apiRequest(
        `/api/config/${section}`,
        'PATCH',
        editedConfig[section]
      );
    },
    onSuccess: () => {
      toast({
        title: "Changes saved",
        description: "Configuration has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    },
    onError: (error) => {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error saving changes",
        description: "There was a problem updating the configuration",
        variant: "destructive",
      });
    },
  });

  // Initialize edited config when data loads
  React.useEffect(() => {
    if (config && !editedConfig) {
      setEditedConfig(config);
    }
  }, [config, editedConfig]);

  // Handle configuration changes
  const handleConfigChange = (section: string, newSectionConfig: any) => {
    setEditedConfig((prev: any) => ({
      ...prev,
      [section]: newSectionConfig
    }));
  };

  // Save current section
  const saveCurrentSection = () => {
    updateSection.mutate(activeTab);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 flex items-center justify-center h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading configuration...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-500">Error Loading Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p>There was a problem loading the bot configuration. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bot Configuration</h1>
          <p className="text-muted-foreground">
            Manage and customize all aspects of the Discord matchmaking bot
          </p>
        </div>

        <Separator className="my-6" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex justify-between items-center">
            <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full md:w-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="matchmaking">Matchmaking</TabsTrigger>
              <TabsTrigger value="mmrSystem">MMR</TabsTrigger>
              <TabsTrigger value="seasonManagement">Seasons</TabsTrigger>
              <TabsTrigger value="matchRules">Rules</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="dataManagement">Data</TabsTrigger>
            </TabsList>
            
            <Button 
              onClick={saveCurrentSection} 
              disabled={updateSection.isPending}
              className="ml-4"
            >
              {updateSection.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {editedConfig && (
            <>
              <TabsContent value="general" className="space-y-4">
                <GeneralConfigPanel
                  config={editedConfig.general}
                  onChange={(newConfig) => handleConfigChange("general", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="matchmaking" className="space-y-4">
                <MatchmakingConfigPanel
                  config={editedConfig.matchmaking}
                  onChange={(newConfig) => handleConfigChange("matchmaking", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="mmrSystem" className="space-y-4">
                <MmrConfigPanel
                  config={editedConfig.mmrSystem}
                  onChange={(newConfig) => handleConfigChange("mmrSystem", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="seasonManagement" className="space-y-4">
                <SeasonConfigPanel
                  config={editedConfig.seasonManagement}
                  onChange={(newConfig) => handleConfigChange("seasonManagement", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="matchRules" className="space-y-4">
                <MatchRulesConfigPanel
                  config={editedConfig.matchRules}
                  onChange={(newConfig) => handleConfigChange("matchRules", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="notifications" className="space-y-4">
                <NotificationConfigPanel
                  config={editedConfig.notifications}
                  onChange={(newConfig) => handleConfigChange("notifications", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="integrations" className="space-y-4">
                <IntegrationConfigPanel
                  config={editedConfig.integrations}
                  onChange={(newConfig) => handleConfigChange("integrations", newConfig)}
                />
              </TabsContent>
              
              <TabsContent value="dataManagement" className="space-y-4">
                <DataManagementConfigPanel
                  config={editedConfig.dataManagement}
                  onChange={(newConfig) => handleConfigChange("dataManagement", newConfig)}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}