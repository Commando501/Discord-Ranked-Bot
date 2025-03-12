import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IntegrationConfig, integrationConfigSchema } from "@shared/botConfig";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash } from "lucide-react";

interface IntegrationConfigPanelProps {
  config: IntegrationConfig;
  onChange: (newConfig: IntegrationConfig) => void;
}

export default function IntegrationConfigPanel({ config, onChange }: IntegrationConfigPanelProps) {
  // Local state for API keys and webhooks management
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyValue, setNewApiKeyValue] = useState("");
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newOAuthSetting, setNewOAuthSetting] = useState("");
  const [newOAuthValue, setNewOAuthValue] = useState("");

  // Create a form with validation
  const form = useForm<IntegrationConfig>({
    resolver: zodResolver(integrationConfigSchema),
    defaultValues: config,
  });

  // Watch for form changes and update parent component
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as IntegrationConfig);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  // Add a new API key
  const addApiKey = () => {
    if (!newApiKeyName || !newApiKeyValue) return;
    
    const updatedApiKeys = { 
      ...form.getValues().apiKeys, 
      [newApiKeyName]: newApiKeyValue 
    };
    
    form.setValue("apiKeys", updatedApiKeys);
    setNewApiKeyName("");
    setNewApiKeyValue("");
  };

  // Remove an API key
  const removeApiKey = (keyName: string) => {
    const currentApiKeys = { ...form.getValues().apiKeys };
    delete currentApiKeys[keyName];
    form.setValue("apiKeys", currentApiKeys);
  };

  // Add a new webhook
  const addWebhook = () => {
    if (!newWebhookName || !newWebhookUrl) return;
    
    // Check if URL is valid
    try {
      new URL(newWebhookUrl);
      
      const updatedWebhooks = { 
        ...form.getValues().webhookUrls, 
        [newWebhookName]: newWebhookUrl 
      };
      
      form.setValue("webhookUrls", updatedWebhooks);
      setNewWebhookName("");
      setNewWebhookUrl("");
    } catch (e) {
      // URL is invalid
      console.error("Invalid URL:", e);
    }
  };

  // Remove a webhook
  const removeWebhook = (webhookName: string) => {
    const currentWebhooks = { ...form.getValues().webhookUrls };
    delete currentWebhooks[webhookName];
    form.setValue("webhookUrls", currentWebhooks);
  };

  // Add OAuth setting
  const addOAuthSetting = () => {
    if (!newOAuthSetting || !newOAuthValue) return;
    
    const updatedSettings = { 
      ...form.getValues().oauth2Settings, 
      [newOAuthSetting]: newOAuthValue 
    };
    
    form.setValue("oauth2Settings", updatedSettings);
    setNewOAuthSetting("");
    setNewOAuthValue("");
  };

  // Remove OAuth setting
  const removeOAuthSetting = (settingName: string) => {
    const currentSettings = { ...form.getValues().oauth2Settings };
    delete currentSettings[settingName];
    form.setValue("oauth2Settings", currentSettings);
  };

  // Toggle platform integration
  const togglePlatform = (platform: string) => {
    const currentPlatforms = [...form.getValues().externalPlatformIntegrations];
    
    if (currentPlatforms.includes(platform as any)) {
      // Remove the platform
      const updatedPlatforms = currentPlatforms.filter(p => p !== platform);
      form.setValue("externalPlatformIntegrations", updatedPlatforms);
    } else {
      // Add the platform
      form.setValue("externalPlatformIntegrations", [...currentPlatforms, platform as any]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Settings</CardTitle>
        <CardDescription>
          Configure external integrations and API connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            {/* Discord Server */}
            <div className="space-y-4">
              <div className="text-lg font-medium">Discord Settings</div>
              
              <FormField
                control={form.control}
                name="discordServerUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Server URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://discord.gg/your-invite" 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Public invite URL to your Discord server
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* API Keys */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">API Keys</div>
              
              <div className="space-y-2">
                {Object.entries(form.watch("apiKeys") || {}).map(([keyName, keyValue]) => (
                  <div key={keyName} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{keyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {keyValue.substring(0, 4)}****{keyValue.substring(keyValue.length - 4)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeApiKey(keyName)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {Object.keys(form.watch("apiKeys") || {}).length === 0 && (
                  <div className="text-center p-4 border rounded-md text-muted-foreground">
                    No API keys defined
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="text-sm font-medium">Add New API Key</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="apiKeyName">Key Name</FormLabel>
                    <Input
                      id="apiKeyName"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="TWITCH_API_KEY"
                    />
                  </div>
                  
                  <div>
                    <FormLabel htmlFor="apiKeyValue">Key Value</FormLabel>
                    <Input
                      id="apiKeyValue"
                      type="password"
                      value={newApiKeyValue}
                      onChange={(e) => setNewApiKeyValue(e.target.value)}
                      placeholder="Enter secret key"
                    />
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  onClick={addApiKey} 
                  className="mt-2"
                  disabled={!newApiKeyName || !newApiKeyValue}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add API Key
                </Button>
              </div>
            </div>
            
            {/* Webhooks */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">Webhook URLs</div>
              
              <div className="space-y-2">
                {Object.entries(form.watch("webhookUrls") || {}).map(([hookName, hookUrl]) => (
                  <div key={hookName} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{hookName}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-md">
                        {hookUrl}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeWebhook(hookName)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {Object.keys(form.watch("webhookUrls") || {}).length === 0 && (
                  <div className="text-center p-4 border rounded-md text-muted-foreground">
                    No webhook URLs defined
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="text-sm font-medium">Add New Webhook</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="webhookName">Webhook Name</FormLabel>
                    <Input
                      id="webhookName"
                      value={newWebhookName}
                      onChange={(e) => setNewWebhookName(e.target.value)}
                      placeholder="match_results"
                    />
                  </div>
                  
                  <div>
                    <FormLabel htmlFor="webhookUrl">Webhook URL</FormLabel>
                    <Input
                      id="webhookUrl"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  onClick={addWebhook} 
                  className="mt-2"
                  disabled={!newWebhookName || !newWebhookUrl}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </div>
            </div>
            
            {/* OAuth2 Settings */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">OAuth2 Settings</div>
              
              <FormField
                control={form.control}
                name="enableOAuth2"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable OAuth2</FormLabel>
                      <FormDescription>
                        Allow users to connect their accounts via OAuth
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
              
              {form.watch("enableOAuth2") && (
                <div className="pl-4 pt-2">
                  <div className="space-y-2">
                    {Object.entries(form.watch("oauth2Settings") || {}).map(([settingName, settingValue]) => (
                      <div key={settingName} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex-1">
                          <div className="font-medium">{settingName}</div>
                          <div className="text-sm text-muted-foreground">
                            {settingValue.includes("secret") || settingName.includes("secret") 
                              ? settingValue.substring(0, 4) + "****" + settingValue.substring(settingValue.length - 4) 
                              : settingValue}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeOAuthSetting(settingName)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {Object.keys(form.watch("oauth2Settings") || {}).length === 0 && (
                      <div className="text-center p-4 border rounded-md text-muted-foreground">
                        No OAuth settings defined
                      </div>
                    )}
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Add OAuth Setting</div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FormLabel htmlFor="oauthSetting">Setting Name</FormLabel>
                        <Input
                          id="oauthSetting"
                          value={newOAuthSetting}
                          onChange={(e) => setNewOAuthSetting(e.target.value)}
                          placeholder="client_id"
                        />
                      </div>
                      
                      <div>
                        <FormLabel htmlFor="oauthValue">Value</FormLabel>
                        <Input
                          id="oauthValue"
                          value={newOAuthValue}
                          onChange={(e) => setNewOAuthValue(e.target.value)}
                          placeholder="Value"
                          type={newOAuthSetting.includes("secret") ? "password" : "text"}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="button" 
                      onClick={addOAuthSetting} 
                      className="mt-2"
                      disabled={!newOAuthSetting || !newOAuthValue}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Setting
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* External Platforms */}
            <div className="space-y-4 pt-4">
              <div className="text-lg font-medium">External Platform Integrations</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="steam" 
                    checked={form.watch("externalPlatformIntegrations").includes("steam")}
                    onCheckedChange={() => togglePlatform("steam")}
                  />
                  <label
                    htmlFor="steam"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Steam
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="faceit" 
                    checked={form.watch("externalPlatformIntegrations").includes("faceit")}
                    onCheckedChange={() => togglePlatform("faceit")}
                  />
                  <label
                    htmlFor="faceit"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    FACEIT
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="battlenet" 
                    checked={form.watch("externalPlatformIntegrations").includes("battlenet")}
                    onCheckedChange={() => togglePlatform("battlenet")}
                  />
                  <label
                    htmlFor="battlenet"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Battle.net
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="epic" 
                    checked={form.watch("externalPlatformIntegrations").includes("epic")}
                    onCheckedChange={() => togglePlatform("epic")}
                  />
                  <label
                    htmlFor="epic"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Epic Games
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}