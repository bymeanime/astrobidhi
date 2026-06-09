'use client'

import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Brain, Star, Share2, Users, Database, TrendingUp,
  Activity, Eye, RefreshCw, ArrowLeft, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface StatsData {
  totalAnalyses: number
  totalUsage: number
  uniqueDevices: number
  analysesByType: Record<string, number>
  usageByType: Record<string, number>
  providerUsage: Record<string, number>
  dailyActivity: Record<string, { charts: number; analyses: number }>
  recentUsage: { analysisType: string; deviceId: string; cacheKey: string; createdAt: string }[]
  sharedCharts: { shareId: string; analysisType: string | null; includeAnalysis: boolean; viewCount: number; createdAt: string }[]
  totalSharedCharts: number
  totalSharedViews: number
  eventsByType: Record<string, number>
  analyticsEvents: { eventType: string; deviceId: string | null; metadata: string; createdAt: string }[]
}

const COLORS = ['#C9721A', '#D4A843', '#6B1D1D', '#2D6A4F', '#9B59B6', '#B33A3A', '#34495E', '#E8A84C', '#4A0E0E', '#8E44AD']

const ANALYSIS_LABELS: Record<string, string> = {
  overall: 'Overall Reading',
  career: 'Career & Profession',
  relationships: 'Love & Marriage',
  health: 'Health & Wellness',
  finance: 'Wealth & Finance',
  spiritual: 'Spiritual Growth',
  dasa: 'Dasa Periods',
  horary: 'Horary (Prasna)',
  swot_5year: '5-Year SWOT',
  cosmic_blueprint: 'Cosmic Blueprint',
  shadow_integration: 'Shadow Integration',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-maroon-dark to-maroon flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-gold animate-pulse-glow mb-4">ॐ</div>
          <p className="text-gold-light text-lg">Loading Admin Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-maroon-dark to-maroon flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-temple-red mb-4">⚠</div>
          <p className="text-gold-light text-lg mb-4">{error}</p>
          <Button onClick={fetchStats} className="bg-saffron hover:bg-saffron-light text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  // Prepare chart data
  const usageByTypeData = Object.entries(stats.usageByType)
    .map(([type, count]) => ({ name: ANALYSIS_LABELS[type] || type, count }))
    .sort((a, b) => b.count - a.count)

  const providerData = Object.entries(stats.providerUsage)
    .map(([name, value]) => ({ name, value }))

  const dailyData = Object.entries(stats.dailyActivity)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, data]) => ({
      date: date.substring(5), // MM-DD
      Charts: data.charts,
      Analyses: data.analyses,
    }))

  const eventsData = Object.entries(stats.eventsByType)
    .map(([type, count]) => ({ name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-screen bg-temple-bg">
      {/* Header */}
      <header className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
              <div>
                <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi Admin</h1>
                <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">Analytics Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={fetchStats}
                variant="ghost"
                size="sm"
                className="text-saffron-light hover:bg-saffron/10"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <a href="/" className="text-saffron-light hover:text-gold-light text-sm flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Site
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-saffron/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Analyses</p>
                  <p className="text-3xl font-bold text-maroon">{stats.totalAnalyses}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cached in database</p>
                </div>
                <div className="w-12 h-12 bg-saffron/10 rounded-full flex items-center justify-center">
                  <Brain className="w-6 h-6 text-saffron" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-saffron/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-3xl font-bold text-maroon">{stats.totalUsage}</p>
                  <p className="text-xs text-muted-foreground mt-1">Analysis requests made</p>
                </div>
                <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-gold" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-saffron/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Devices</p>
                  <p className="text-3xl font-bold text-maroon">{stats.uniqueDevices}</p>
                  <p className="text-xs text-muted-foreground mt-1">Distinct users</p>
                </div>
                <div className="w-12 h-12 bg-vedic-green/10 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-vedic-green" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-saffron/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Shared Charts</p>
                  <p className="text-3xl font-bold text-maroon">{stats.totalSharedCharts}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.totalSharedViews} total views</p>
                </div>
                <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-temple-red" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="usage" className="mb-8">
          <TabsList className="bg-maroon/5">
            <TabsTrigger value="usage" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1" /> Analysis Usage
            </TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4 mr-1" /> Daily Activity
            </TabsTrigger>
            <TabsTrigger value="providers" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <PieChartIcon className="w-4 h-4 mr-1" /> AI Providers
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-1" /> Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <Card className="border-saffron/20">
              <CardHeader>
                <CardTitle className="text-maroon">Analysis Requests by Type</CardTitle>
                <CardDescription>How many times each analysis type has been requested</CardDescription>
              </CardHeader>
              <CardContent>
                {usageByTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={usageByTypeData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#C9721A22" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                        {usageByTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No usage data yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily">
            <Card className="border-saffron/20">
              <CardHeader>
                <CardTitle className="text-maroon">Daily Activity (Last 30 Days)</CardTitle>
                <CardDescription>Chart generations and analysis requests per day</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#C9721A22" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Charts" stroke="#C9721A" strokeWidth={2} dot={{ fill: '#C9721A' }} />
                      <Line type="monotone" dataKey="Analyses" stroke="#D4A843" strokeWidth={2} dot={{ fill: '#D4A843' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No daily activity data yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers">
            <Card className="border-saffron/20">
              <CardHeader>
                <CardTitle className="text-maroon">AI Provider Usage</CardTitle>
                <CardDescription>Which AI providers are being used for analyses</CardDescription>
              </CardHeader>
              <CardContent>
                {providerData.length > 0 ? (
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={providerData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {providerData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {providerData.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm font-medium">{p.name}</span>
                          <Badge variant="outline" className="text-xs">{p.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No provider data yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card className="border-saffron/20">
              <CardHeader>
                <CardTitle className="text-maroon">Analytics Events</CardTitle>
                <CardDescription>Breakdown of all tracked events</CardDescription>
              </CardHeader>
              <CardContent>
                {eventsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={eventsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#C9721A22" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]} fill="#6B1D1D" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No events tracked yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analysis Requests */}
          <Card className="border-saffron/20">
            <CardHeader>
              <CardTitle className="text-maroon flex items-center gap-2">
                <Eye className="w-5 h-5" /> Recent Analysis Requests
              </CardTitle>
              <CardDescription>Last 50 analysis requests from users</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentUsage.length > 0 ? (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-maroon/5">
                        <TableHead className="text-maroon font-semibold">Type</TableHead>
                        <TableHead className="text-maroon font-semibold">Device</TableHead>
                        <TableHead className="text-maroon font-semibold">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentUsage.map((u, i) => (
                        <TableRow key={i} className="hover:bg-saffron/5">
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-saffron/30">
                              {ANALYSIS_LABELS[u.analysisType] || u.analysisType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {u.deviceId ? u.deviceId.substring(0, 8) + '...' : 'N/A'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </CardContent>
          </Card>

          {/* Top Shared Charts */}
          <Card className="border-saffron/20">
            <CardHeader>
              <CardTitle className="text-maroon flex items-center gap-2">
                <Share2 className="w-5 h-5" /> Shared Charts
              </CardTitle>
              <CardDescription>Most viewed shared charts</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.sharedCharts.length > 0 ? (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-maroon/5">
                        <TableHead className="text-maroon font-semibold">Analysis</TableHead>
                        <TableHead className="text-maroon font-semibold">Views</TableHead>
                        <TableHead className="text-maroon font-semibold">Includes Analysis</TableHead>
                        <TableHead className="text-maroon font-semibold">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.sharedCharts.map((s, i) => (
                        <TableRow key={i} className="hover:bg-saffron/5">
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-saffron/30">
                              {s.analysisType ? (ANALYSIS_LABELS[s.analysisType] || s.analysisType) : 'Chart Only'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-maroon">
                            {s.viewCount}
                          </TableCell>
                          <TableCell>
                            {s.includeAnalysis ? (
                              <Badge className="bg-vedic-green text-white text-xs">Yes</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No shared charts yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cache Stats */}
        <Card className="border-saffron/20 mt-6">
          <CardHeader>
            <CardTitle className="text-maroon flex items-center gap-2">
              <Database className="w-5 h-5" /> Cache Statistics
            </CardTitle>
            <CardDescription>Cached analysis entries by type (cache hits save AI costs)</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.analysesByType).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(stats.analysesByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="bg-saffron/5 border border-saffron/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-maroon">{count}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ANALYSIS_LABELS[type] || type}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No cached analyses yet</p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-8 bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60">
        <div className="vedic-divider" />
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <p className="text-xs">AstroBidhi Admin Dashboard &bull; Data refreshes on load</p>
        </div>
      </footer>
    </div>
  )
}
