import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/app-layout';
import { PlusCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("matches");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Fetch different data based on selected tab
  const playersQuery = useQuery<any[]>({
    queryKey: ['/api/admin/players'],
    enabled: selectedTab === 'players',
  });
  
  const matchesQuery = useQuery<any[]>({
    queryKey: ['/api/admin/matches'],
    enabled: selectedTab === 'matches',
  });
  
  const teamsQuery = useQuery<any[]>({
    queryKey: ['/api/admin/teams'],
    enabled: selectedTab === 'teams',
  });
  
  const queueQuery = useQuery<any[]>({
    queryKey: ['/api/admin/queue'],
    enabled: selectedTab === 'queue',
  });

  // Mutations for different entities
  const updatePlayerMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/admin/players/${data.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/top'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Player updated successfully",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update player",
        variant: "destructive",
      });
    }
  });
  
  const updateMatchMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/admin/matches/${data.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/matches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Match updated successfully",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update match",
        variant: "destructive",
      });
    }
  });
  
  const removeFromQueueMutation = useMutation({
    mutationFn: async (playerId: number) => {
      return await apiRequest(`/api/admin/queue/${playerId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Player removed from queue",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove player from queue",
        variant: "destructive",
      });
    }
  });
  
  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/queue/clear', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Queue cleared successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear queue",
        variant: "destructive",
      });
    }
  });

  // Handle edit dialog form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTab === 'players') {
      updatePlayerMutation.mutate(editingItem);
    } else if (selectedTab === 'matches') {
      updateMatchMutation.mutate(editingItem);
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric values
    if (['mmr', 'wins', 'losses', 'winStreak', 'lossStreak'].includes(name)) {
      setEditingItem({
        ...editingItem,
        [name]: parseInt(value) || 0,
      });
    } else {
      setEditingItem({
        ...editingItem,
        [name]: value,
      });
    }
  };

  // Opens edit dialog for a specific item
  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Management</h1>
            <p className="text-muted-foreground">Manage matches, teams, and queue settings</p>
            <p className="text-sm text-muted-foreground mt-1">For player management, please use the <a href="/players" className="text-primary hover:underline">Players page</a></p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                if (selectedTab === 'players') {
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/players'] });
                } else if (selectedTab === 'matches') {
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/matches'] });
                } else if (selectedTab === 'teams') {
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/teams'] });
                } else if (selectedTab === 'queue') {
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="matches" value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
          </TabsList>

          {/* Matches Tab */}
          <TabsContent value="matches">
            <Card>
              <CardHeader>
                <CardTitle>Manage Matches</CardTitle>
                <CardDescription>View and edit match details and status</CardDescription>
              </CardHeader>
              <CardContent>
                {matchesQuery.isLoading ? (
                  <div className="flex justify-center py-4">Loading matches...</div>
                ) : matchesQuery.isError ? (
                  <div className="text-red-500 py-4">Error loading matches data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Teams</TableHead>
                          <TableHead>Winner</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchesQuery.data?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              No matches found
                            </TableCell>
                          </TableRow>
                        ) : (
                          matchesQuery.data?.map((match: any) => (
                            <TableRow key={match.id}>
                              <TableCell>{match.id}</TableCell>
                              <TableCell>
                                <Badge className={match.status === 'ACTIVE' ? 'bg-green-600' : 
                                match.status === 'COMPLETED' ? 'bg-blue-600' : 'bg-yellow-600'}>
                                  {match.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(match.createdAt).toLocaleString()}</TableCell>
                              <TableCell>{match.teams?.length || 0} teams</TableCell>
                              <TableCell>
                                {match.winningTeamId ? `Team ${match.winningTeamId}` : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => openEditDialog(match)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Manage Teams</CardTitle>
                <CardDescription>View team details and players</CardDescription>
              </CardHeader>
              <CardContent>
                {teamsQuery.isLoading ? (
                  <div className="flex justify-center py-4">Loading teams...</div>
                ) : teamsQuery.isError ? (
                  <div className="text-red-500 py-4">Error loading teams data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Match ID</TableHead>
                          <TableHead>Avg. MMR</TableHead>
                          <TableHead>Players</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamsQuery.data?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              No teams found
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamsQuery.data?.map((team: any) => (
                            <TableRow key={team.id}>
                              <TableCell>{team.id}</TableCell>
                              <TableCell>{team.name}</TableCell>
                              <TableCell>{team.matchId}</TableCell>
                              <TableCell>{team.avgMMR}</TableCell>
                              <TableCell>{team.players?.length || 0} players</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    // View team details
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manage Queue</CardTitle>
                  <CardDescription>View and manage players in queue</CardDescription>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear the entire queue?')) {
                      clearQueueMutation.mutate();
                    }
                  }}
                  disabled={clearQueueMutation.isPending}
                >
                  Clear Queue
                </Button>
              </CardHeader>
              <CardContent>
                {queueQuery.isLoading ? (
                  <div className="flex justify-center py-4">Loading queue...</div>
                ) : queueQuery.isError ? (
                  <div className="text-red-500 py-4">Error loading queue data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Position</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>MMR</TableHead>
                          <TableHead>Joined At</TableHead>
                          <TableHead>Time In Queue</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queueQuery.data?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              Queue is empty
                            </TableCell>
                          </TableRow>
                        ) : (
                          queueQuery.data?.map((queueItem: any, index: number) => (
                            <TableRow key={queueItem.playerId}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{queueItem.player?.username || 'Unknown player'}</TableCell>
                              <TableCell>{queueItem.player?.mmr || 'N/A'}</TableCell>
                              <TableCell>{new Date(queueItem.joinedAt).toLocaleString()}</TableCell>
                              <TableCell>
                                {formatQueueTime(new Date(queueItem.joinedAt))}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    if (window.confirm('Remove this player from the queue?')) {
                                      removeFromQueueMutation.mutate(queueItem.playerId);
                                    }
                                  }}
                                  disabled={removeFromQueueMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit {selectedTab === 'players' ? 'Player' : 'Match'}</DialogTitle>
            <DialogDescription>
              Make changes to the {selectedTab === 'players' ? 'player' : 'match'} details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              {selectedTab === 'players' && editingItem && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="username" className="text-right">
                      Username
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      value={editingItem.username || ''}
                      onChange={handleInputChange}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="mmr" className="text-right">
                      MMR
                    </Label>
                    <Input
                      id="mmr"
                      name="mmr"
                      type="number"
                      value={editingItem.mmr || 0}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="wins" className="text-right">
                      Wins
                    </Label>
                    <Input
                      id="wins"
                      name="wins"
                      type="number"
                      value={editingItem.wins || 0}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="losses" className="text-right">
                      Losses
                    </Label>
                    <Input
                      id="losses"
                      name="losses"
                      type="number"
                      value={editingItem.losses || 0}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="winStreak" className="text-right">
                      Win Streak
                    </Label>
                    <Input
                      id="winStreak"
                      name="winStreak"
                      type="number"
                      value={editingItem.winStreak || 0}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="lossStreak" className="text-right">
                      Loss Streak
                    </Label>
                    <Input
                      id="lossStreak"
                      name="lossStreak"
                      type="number"
                      value={editingItem.lossStreak || 0}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
              
              {selectedTab === 'matches' && editingItem && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">
                      Status
                    </Label>
                    <Input
                      id="status"
                      name="status"
                      value={editingItem.status || ''}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="winningTeamId" className="text-right">
                      Winning Team ID
                    </Label>
                    <Input
                      id="winningTeamId"
                      name="winningTeamId"
                      type="number"
                      value={editingItem.winningTeamId || ''}
                      onChange={handleInputChange}
                      className="col-span-3"
                      placeholder="Leave empty if no winner yet"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={
                  (selectedTab === 'players' && updatePlayerMutation.isPending) || 
                  (selectedTab === 'matches' && updateMatchMutation.isPending)
                }
              >
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Helper function to format queue time
function formatQueueTime(joinedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - joinedAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  
  if (diffHrs > 0) {
    return `${diffHrs}h ${diffMins % 60}m`;
  } else {
    return `${diffMins}m`;
  }
}