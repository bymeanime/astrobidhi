'use client'

import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Brain, Star, Share2, Users, Database, TrendingUp,
  Activity, Eye, RefreshCw, ArrowLeft, BarChart3, PieChart as PieChartIcon,
  LogOut, Shield, Plus, Trash2, CheckCircle, XCircle, Clock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

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

interface AccessGrant {
  id: string
  deviceId: string
  accessLevel: string
  grantedBy: string
  reason: string | null
  expiresAt: string | null
  createdAt: string
  isExpired: boolean
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

  // Access management state
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const [grantDeviceId, setGrantDeviceId] = useState('')
  const [grantAccessLevel, setGrantAccessLevel] = useState<'premium' | 'unlimited'>('premium')
  const [grantReason, setGrantReason] = useState('')
  const [grantExpiresAt, setGrantExpiresAt] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantMessage, setGrantMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {}
    window.location.href = '/admin/login'
  }

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'same-origin' })
      if (res.status === 401) {
        // Session expired, redirect to login
        window.location.href = '/admin/login'
        return
      }
      if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  const fetchAccessGrants = async () => {
    setAccessLoading(true)
    try {
      const res = await fetch('/api/admin/access', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setAccessGrants(data.grants || [])
      } else {
        console.error('[Access Grants] Fetch failed:', res.status, await res.text().catch(() => ''))
      }
    } catch (err) {
      console.error('Failed to fetch access grants:', err)
    } finally {
      setAccessLoading(false)
    }
  }

  const handleGrantAccess = async () => {
    if (!grantDeviceId.trim()) return
    setGrantSubmitting(true)
    setGrantMessage(null)
    try {
      const body: Record<string, string> = {
        deviceId: grantDeviceId.trim(),
        accessLevel: grantAccessLevel,
      }
      if (grantReason.trim()) body.reason = grantReason.trim()
      if (grantExpiresAt) body.expiresAt = new Date(grantExpiresAt).toISOString()

      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })

      const data = await res.json()
      if (res.ok) {
        setGrantMessage({ type: 'success', text: `Access granted! ${data.updated ? 'Updated existing grant.' : 'Created new grant.'}` })
        setGrantDeviceId('')
        setGrantReason('')
        setGrantExpiresAt('')
        fetchAccessGrants()
      } else {
        console.error('[Grant Access] Failed:', res.status, data)
        if (res.status === 401) {
          setGrantMessage({ type: 'error', text: 'Session expired. Please refresh the page and log in again.' })
        } else {
          setGrantMessage({ type: 'error', text: data.detail || 'Failed to grant access' })
        }
      }
    } catch (err) {
      setGrantMessage({ type: 'error', text: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setGrantSubmitting(false)
    }
  }

  const handleRevokeAccess = async (deviceId: string) => {
    if (!confirm(`Revoke access for device ${deviceId.substring(0, 8)}...?`)) return
    try {
      const res = await fetch(`/api/admin/access/${encodeURIComponent(deviceId)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        fetchAccessGrants()
      } else {
        const data = await res.json()
        alert(data.detail || 'Failed to revoke access')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error')
    }
  }

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { fetchAccessGrants() }, [])

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
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-saffron-light hover:bg-temple-red/20"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

          <Card className="border-emerald-600/30 bg-emerald-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Grants</p>
                  <p className="text-3xl font-bold text-emerald-700">{accessGrants.filter(g => !g.isExpired).length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Premium/Unlimited users</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs: Analytics + Access Management */}
        <Tabs defaultValue="analytics" className="mb-8">
          <TabsList className="bg-maroon/5">
            <TabsTrigger value="analytics" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="access" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Shield className="w-4 h-4 mr-1" /> Access Management
            </TabsTrigger>
          </TabsList>

          {/* ====== ANALYTICS TAB ====== */}
          <TabsContent value="analytics">
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
          </TabsContent>

          {/* ====== ACCESS MANAGEMENT TAB ====== */}
          <TabsContent value="access">
            <div className="space-y-6">
              {/* How to Find Device ID */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                    <Eye className="w-5 h-5" /> How to Find a User&apos;s Device ID
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-700 space-y-2">
                  <p>To grant access to a user, you need their <strong>Device ID</strong>. Here&apos;s how to find it:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Ask the user to open the site in their browser</li>
                    <li>Have them open <strong>Developer Tools</strong> (F12 or Right-Click → Inspect)</li>
                    <li>Go to <strong>Console</strong> tab and type: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">localStorage.getItem(&apos;astrobidi_device_id&apos;)</code></li>
                    <li>Copy the UUID that appears (e.g. <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">a1b2c3d4-e5f6-...</code>)</li>
                    <li>Paste it below to grant access</li>
                  </ol>
                  <p className="text-xs text-blue-600 mt-2">You can also find device IDs from the Recent Analysis Requests table in the Analytics tab.</p>
                </CardContent>
              </Card>

              {/* Grant Access Form */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-maroon flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Grant Access
                      </CardTitle>
                      <CardDescription>Give a device premium or unlimited access to AI analyses</CardDescription>
                    </div>
                    <Button
                      onClick={() => setGrantDialogOpen(true)}
                      className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" /> New Grant
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Access Grants Table */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-maroon flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Current Access Grants
                      </CardTitle>
                      <CardDescription>All devices with premium or unlimited access</CardDescription>
                    </div>
                    <Button
                      onClick={fetchAccessGrants}
                      variant="ghost"
                      size="sm"
                      className="text-saffron hover:bg-saffron/10"
                    >
                      <RefreshCw className={`w-4 h-4 ${accessLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {accessLoading && accessGrants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Loading access grants...</p>
                  ) : accessGrants.length > 0 ? (
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-maroon/5">
                            <TableHead className="text-maroon font-semibold">Device ID</TableHead>
                            <TableHead className="text-maroon font-semibold">Access Level</TableHead>
                            <TableHead className="text-maroon font-semibold">Reason</TableHead>
                            <TableHead className="text-maroon font-semibold">Granted By</TableHead>
                            <TableHead className="text-maroon font-semibold">Expires</TableHead>
                            <TableHead className="text-maroon font-semibold">Status</TableHead>
                            <TableHead className="text-maroon font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accessGrants.map((grant) => (
                            <TableRow key={grant.id} className="hover:bg-saffron/5">
                              <TableCell className="font-mono text-xs">
                                <span className="cursor-pointer hover:text-saffron" title={grant.deviceId} onClick={() => navigator.clipboard?.writeText(grant.deviceId)}>
                                  {grant.deviceId.substring(0, 12)}...
                                </span>
                              </TableCell>
                              <TableCell>
                                {grant.accessLevel === 'unlimited' ? (
                                  <Badge className="bg-gradient-to-r from-emerald-600 to-green-500 text-white text-xs">
                                    UNLIMITED
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-xs">
                                    PREMIUM
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {grant.reason || <span className="italic">No reason</span>}
                              </TableCell>
                              <TableCell className="text-xs">
                                {grant.grantedBy}
                              </TableCell>
                              <TableCell className="text-xs">
                                {grant.expiresAt ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(grant.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">Never</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {grant.isExpired ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                                    <XCircle className="w-3 h-3 mr-1" /> Expired
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevokeAccess(grant.deviceId)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No access grants yet. Click &quot;New Grant&quot; to grant access to a device.</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Grant by Recent Device */}
              {stats.recentUsage.length > 0 && (
                <Card className="border-saffron/20">
                  <CardHeader>
                    <CardTitle className="text-maroon flex items-center gap-2 text-base">
                      <Users className="w-5 h-5" /> Quick Grant from Recent Users
                    </CardTitle>
                    <CardDescription>Click a device ID to quickly grant access</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {[...new Map(stats.recentUsage.map(u => [u.deviceId, u])).values()].slice(0, 20).map((u) => (
                        <button
                          key={u.deviceId}
                          onClick={() => {
                            setGrantDeviceId(u.deviceId)
                            setGrantDialogOpen(true)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-saffron/10 border border-saffron/20 rounded-full text-xs font-mono text-maroon hover:bg-saffron/20 hover:border-saffron/40 transition-all"
                        >
                          <Shield className="w-3 h-3 text-saffron" />
                          {u.deviceId.substring(0, 12)}...
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Grant Access Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" /> Grant Access
            </DialogTitle>
            <DialogDescription>
              Give a device premium or unlimited access to AI analyses
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Device ID *</Label>
              <Input
                value={grantDeviceId}
                onChange={e => setGrantDeviceId(e.target.value)}
                placeholder="Paste device UUID here..."
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Full UUID from the user&apos;s browser localStorage
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Access Level</Label>
              <Select value={grantAccessLevel} onValueChange={(v: 'premium' | 'unlimited') => setGrantAccessLevel(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">
                    <span className="flex items-center gap-2">
                      <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-[10px] px-1.5">PREMIUM</Badge>
                      Unlock premium analysis types (SWOT, Cosmic Blueprint, Shadow)
                    </span>
                  </SelectItem>
                  <SelectItem value="unlimited">
                    <span className="flex items-center gap-2">
                      <Badge className="bg-gradient-to-r from-emerald-600 to-green-500 text-white text-[10px] px-1.5">UNLIMITED</Badge>
                      Premium types + bypass all rate limits
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Reason (optional)</Label>
              <Input
                value={grantReason}
                onChange={e => setGrantReason(e.target.value)}
                placeholder="e.g. free_trial, early_adopter, promo, beta_tester"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Expiration (optional)</Label>
              <Input
                type="datetime-local"
                value={grantExpiresAt}
                onChange={e => setGrantExpiresAt(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for permanent access (never expires)
              </p>
            </div>

            {grantMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                grantMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {grantMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {grantMessage.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setGrantDialogOpen(false); setGrantMessage(null) }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantAccess}
              disabled={grantSubmitting || !grantDeviceId.trim()}
              className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white"
            >
              {grantSubmitting ? (
                <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Granting...</>
              ) : (
                <><Shield className="w-4 h-4 mr-1" /> Grant Access</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
