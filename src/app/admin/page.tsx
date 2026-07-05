'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Brain, Star, Share2, Users, Database, TrendingUp,
  Activity, Eye, RefreshCw, ArrowLeft, BarChart3, PieChart as PieChartIcon,
  LogOut, Shield, Plus, Trash2, CheckCircle, XCircle, Clock,
  Package, Tag, Edit, Copy, Search, Pencil, ArrowUpDown, Zap, Gift, AlertCircle,
  BookOpen, UserCheck, Video, Mail, CreditCard, ExternalLink, Crown, DollarSign
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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// ──────────────────── Types ────────────────────

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

interface DeviceAccessGrant {
  id: string
  deviceId: string
  analysisType: string
  source: string
  sourceRef: string | null
  grantedBy: string
  reason: string | null
  expiresAt: string | null
  createdAt: string
  isExpired: boolean
}

interface CatalogItem {
  id: string
  analysisType: string
  name: string
  description: string | null
  priceCents: number
  originalPriceCents: number | null
  isActive: number
  sortOrder: number
  createdAt: string
  lsVariantId?: string | null  // Lemon Squeezy variant ID for per-analysis one-time purchases
}

interface BundleItem {
  id: string
  slug: string
  name: string
  description: string | null
  priceCents: number
  originalPriceCents: number | null
  isActive: number
  sortOrder: number
  createdAt: string
  items: string[]
}

interface PromoCode {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  applicableType: string
  applicableItems: string[] | null
  maxUses: number | null
  useCount: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string
}

interface ReadingBooking {
  id: string
  bookingRef: string
  tier: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  birthDate: string | null
  birthTime: string | null
  birthCity: string | null
  questions: string | null
  focusAreas: string | null
  preferredLanguage: string
  status: string
  scheduledAt: string | null
  completedAt: string | null
  meetingLink: string | null
  notes: string | null
  priceCents: number
  paidAt: string | null
  paymentRef: string | null
  astrologerId: string | null
  astrologerName: string | null
  astrologerTitle: string | null
  deviceId: string | null
  createdAt: string
  updatedAt: string
}

interface AstrologerProfile {
  id: string
  name: string
  title: string | null
  bio: string | null
  specialties: string
  experienceYears: number
  qualifications: string | null
  languages: string
  rating: number
  reviewCount: number
  photoUrl: string | null
  isAvailable: number
  sortOrder: number
  createdAt: string
}

// ──────────────────── Constants ────────────────────

const COLORS = ['#C9721A', '#D4A843', '#6B1D1D', '#2D6A4F', '#9B59B6', '#B33A3A', '#34495E', '#E8A84C', '#4A0E0E', '#8E44AD']

const ANALYSIS_LABELS: Record<string, string> = {
  overall: 'Overall Reading',
  career: 'Career & Profession',
  relationships: 'Love & Marriage',
  health: 'Health & Wellness',
  finance: 'Wealth & Finance',
  education: 'Education & Learning',
  family: 'Family & Children',
  horary: 'Horary (Prasna)',
  spiritual: 'Spiritual Growth',
  dasa: 'Dasa Periods',
  vedic_master: 'Vedic Master Reading',
  trik_bhava: 'Trik Bhava Analysis',
  forecast_12month: '12-Month Forecast',
  cosmic_love_letter: 'Cosmic Love Letter',
  name_numerology: 'Name Numerology',
  gemstone_remedy: 'Gemstone & Remedy',
  compatibility_profile: 'Compatibility Profile',
  swot_5year: '5-Year SWOT',
  cosmic_blueprint: 'Cosmic Blueprint',
  shadow_integration: 'Shadow Integration',
  life_decoder: 'Life Decoder',
  career_destiny: 'Career Destiny',
  relationship_destiny: 'Relationship Destiny',
  soul_purpose: 'Soul Purpose',
  wealth_code: 'Wealth Code',
  future_timeline: 'Future Timeline',
  kp_prashna: 'KP Prashna (Advanced)',
  past_life_karma: 'Past Life Karma',
  mangal_dosha: 'Mangal Dosha Report',
  sade_sati: 'Sade Sati Report',
  horoscope_monthly: 'Daily Horoscope Subscription',
  reading_basic: 'Basic Reading',
  reading_standard: 'Standard Reading',
  reading_premium: 'Premium Reading',
  reading_ultimate: 'Ultimate Reading',
}

const centsToDollar = (cents: number) => `$${(cents / 100).toFixed(2)}`
const dollarToCents = (dollars: string) => Math.round(parseFloat(dollars) * 100) || 0
const savingsPercent = (price: number, original: number | null) => {
  if (!original || original <= price) return 0
  return Math.round(((original - price) / original) * 100)
}

// ──────────────────── Component ────────────────────

export default function AdminDashboard() {
  const { toast } = useToast()

  // ── Core state ──
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Access management state ──
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([])
  const [deviceAccessGrants, setDeviceAccessGrants] = useState<DeviceAccessGrant[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const [grantDeviceId, setGrantDeviceId] = useState('')
  const [grantMode, setGrantMode] = useState<'legacy' | 'granular'>('granular')
  const [grantAccessLevel, setGrantAccessLevel] = useState<'premium' | 'unlimited'>('premium')
  const [grantAnalysisTypes, setGrantAnalysisTypes] = useState<string[]>([])
  const [grantReason, setGrantReason] = useState('')
  const [grantExpiresAt, setGrantExpiresAt] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantMessage, setGrantMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Catalog state ──
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [catalogEditItem, setCatalogEditItem] = useState<CatalogItem | null>(null)
  const [catalogForm, setCatalogForm] = useState({
    analysisType: '', name: '', description: '', priceDollars: '', originalPriceDollars: '', isActive: true, sortOrder: 0, lsVariantId: '',
  })
  const [catalogSubmitting, setCatalogSubmitting] = useState(false)

  // ── Messages state ──
  const [messages, setMessages] = useState<{ id: string; name: string; email: string; message: string; isRead: number; createdAt: string }[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0)
  const [messagesTotalCount, setMessagesTotalCount] = useState(0)

  // ── Bundles state ──
  const [bundles, setBundles] = useState<BundleItem[]>([])
  const [bundlesLoading, setBundlesLoading] = useState(false)
  const [bundlesError, setBundlesError] = useState<string | null>(null)
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false)
  const [bundleEditItem, setBundleEditItem] = useState<BundleItem | null>(null)
  const [bundleForm, setBundleForm] = useState({
    slug: '', name: '', description: '', priceDollars: '', originalPriceDollars: '', items: [] as string[], isActive: true, sortOrder: 0,
  })
  const [bundleSubmitting, setBundleSubmitting] = useState(false)

  // ── Promo state ──
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [promosLoading, setPromosLoading] = useState(false)
  const [promosError, setPromosError] = useState<string | null>(null)
  const [promoDialogOpen, setPromoDialogOpen] = useState(false)
  const [promoEditItem, setPromoEditItem] = useState<PromoCode | null>(null)
  const [promoForm, setPromoForm] = useState({
    code: '', description: '', type: 'percent_off' as string, value: 0,
    applicableType: 'all' as string, applicableItems: [] as string[],
    maxUses: '' as string, validFrom: '', validUntil: '', isActive: true,
  })
  const [promoSubmitting, setPromoSubmitting] = useState(false)

  // ── Readings state ──
  const [bookings, setBookings] = useState<ReadingBooking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all')
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ReadingBooking | null>(null)
  const [bookingUpdateForm, setBookingUpdateForm] = useState({
    status: '', astrologerId: '', scheduledAt: '', meetingLink: '', notes: '',
  })
  const [bookingUpdateSubmitting, setBookingUpdateSubmitting] = useState(false)

  // ── Astrologers state ──
  const [astrologers, setAstrologers] = useState<AstrologerProfile[]>([])
  const [astrologersLoading, setAstrologersLoading] = useState(false)
  const [astrologersError, setAstrologersError] = useState<string | null>(null)
  const [astrologerDialogOpen, setAstrologerDialogOpen] = useState(false)
  const [astrologerEditItem, setAstrologerEditItem] = useState<AstrologerProfile | null>(null)
  const [astrologerForm, setAstrologerForm] = useState({
    name: '', title: '', bio: '', specialties: 'vedic_reading', experienceYears: 0,
    qualifications: '', languages: 'English,Hindi', rating: 0, reviewCount: 0,
    photoUrl: '', isAvailable: true, sortOrder: 0,
  })
  const [astrologerSubmitting, setAstrologerSubmitting] = useState(false)

  // ── Whop integration status state ──
  interface WhopStatus {
    configured: boolean
    hasAppId: boolean
    hasClientSecret: boolean
    hasApiKey: boolean
    hasCompanyId: boolean
    hasProductId: boolean
    hasExperienceId: boolean
    hasRedirectUri: boolean
    hasCheckoutUrl: boolean
    appIdPreview: string | null
    productIdPreview: string | null
    redirectUri: string | null
    checkoutUrl: string | null
    api: { status: number | null; error: string | null }
    recentMemberships: Array<{
      id: string
      status: string
      productId: string
      productTitle?: string
      planId: string
    }>
    fullConfig: {
      appId: string | null
      productId: string | null
      experienceId: string | null
      companyId: string | null
      redirectUri: string | null
      hasClientSecret: boolean
      hasApiKey: boolean
    }
  }
  const [whopStatus, setWhopStatus] = useState<WhopStatus | null>(null)
  const [whopLoading, setWhopLoading] = useState(false)
  const [whopError, setWhopError] = useState<string | null>(null)

  // ── Lemon Squeezy integration status state ──
  interface LsStatus {
    configured: boolean
    hasApiKey: boolean
    hasStoreId: boolean
    hasVariantId: boolean
    hasWebhookSecret: boolean
    hasCheckoutUrl: boolean
    apiKeyPreview: string | null
    storeId: string | null
    variantId: string | null
    checkoutUrl: string | null
    api: { reachable: boolean; status: number | null; error: string | null }
    recentSubscriptions: Array<{
      subscriptionId: string
      customerEmail: string
      customerName: string | null
      status: string
      statusFormatted: string | null
      currentPeriodEnd: string | null
      renewsAt: string | null
      trialEndsAt: string | null
      cancelled: boolean
      createdAt: string
      updatedAt: string
    }>
    countsByStatus: Record<string, number>
    checkoutUrlWorks: boolean
    checkoutUrlError: string | null
    fullConfig: {
      storeId: string | null
      variantId: string | null
      hasApiKey: boolean
      hasWebhookSecret: boolean
      checkoutUrl: string | null
    }
  }
  const [lsStatus, setLsStatus] = useState<LsStatus | null>(null)
  const [lsLoading, setLsLoading] = useState(false)
  const [lsError, setLsError] = useState<string | null>(null)

  // ── Subscriptions overview state ──
  interface SubTierInfo {
    tier: string
    period: string
    priceCents: number
    priceLabel: string
    effectiveMonthly: string
    yearlySavings: number
    chartsPerPeriod: number
    analysesIncluded: string[]
    lsVariantId: string | null
    lsConfigured: boolean
    whopProductId: string | null
    whopConfigured: boolean
  }
  interface SubOverview {
    tierMatrix: SubTierInfo[]
    subscriberCounts: Record<string, number>
    totalActiveSubs: number
    revenueByTier: Record<string, number>
    mrrCents: number
    mrrLabel: string
    recentSubscriptions: Array<{
      subscriptionId: string
      customerEmail: string
      customerName: string | null
      tier: string
      period: string
      provider: string
      status: string
      chartsUsedThisPeriod: number
      chartsPerPeriod: number
      periodEnd: string | null
      createdAt: string
    }>
  }
  const [subOverview, setSubOverview] = useState<SubOverview | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)

  // ──────────────── Fetch functions ────────────────

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {}
    window.location.href = '/admin/login'
  }

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'same-origin' })
      if (res.status === 401) {
        // Don't redirect immediately - just show error so the rest of the dashboard works
        setError('Session expired. Analytics data unavailable. Try refreshing.')
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
  }, [])

  const fetchAccessGrants = useCallback(async () => {
    setAccessLoading(true)
    setAccessError(null)
    try {
      const res = await fetch('/api/admin/access', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setAccessGrants(data.grants || [])
        setDeviceAccessGrants(data.deviceAccessGrants || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setAccessError(data.detail || `Failed to fetch access grants (${res.status})`)
        if (res.status === 401) setAccessError('Session expired. Please refresh the page.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setAccessError(msg)
      console.error('Failed to fetch access grants:', err)
    } finally {
      setAccessLoading(false)
    }
  }, [])

  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const res = await fetch('/api/admin/catalog', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setCatalogItems(data.items || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setCatalogError(data.detail || `Failed to fetch catalog (${res.status})`)
        if (res.status === 401) setCatalogError('Session expired. Please refresh the page.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setCatalogError(msg)
      console.error('Failed to fetch catalog:', err)
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true)
    try {
      const res = await fetch('/api/admin/messages', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setMessagesUnreadCount(data.unreadCount || 0)
        setMessagesTotalCount(data.totalCount || 0)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  const markMessageRead = useCallback(async (messageId: string, isRead: boolean) => {
    try {
      await fetch(`/api/admin/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      })
      fetchMessages()
    } catch (err) {
      console.error('Failed to update message:', err)
    }
  }, [fetchMessages])

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/admin/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      fetchMessages()
    } catch (err) {
      console.error('Failed to delete message:', err)
    }
  }, [fetchMessages])

  const fetchBundles = useCallback(async () => {
    setBundlesLoading(true)
    setBundlesError(null)
    try {
      const res = await fetch('/api/admin/bundles', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setBundles(data.bundles || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setBundlesError(data.detail || `Failed to fetch bundles (${res.status})`)
        if (res.status === 401) setBundlesError('Session expired. Please refresh the page.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setBundlesError(msg)
      console.error('Failed to fetch bundles:', err)
    } finally {
      setBundlesLoading(false)
    }
  }, [])

  const fetchPromos = useCallback(async () => {
    setPromosLoading(true)
    setPromosError(null)
    try {
      const res = await fetch('/api/admin/promos', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setPromos(data.promos || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setPromosError(data.detail || `Failed to fetch promo codes (${res.status})`)
        if (res.status === 401) setPromosError('Session expired. Please refresh the page.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setPromosError(msg)
      console.error('Failed to fetch promos:', err)
    } finally {
      setPromosLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchAccessGrants() }, [fetchAccessGrants])
  useEffect(() => { fetchCatalog() }, [fetchCatalog])
  useEffect(() => { fetchMessages() }, [fetchMessages])
  useEffect(() => { fetchBundles() }, [fetchBundles])
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const url = bookingStatusFilter !== 'all' ? `/api/admin/readings?status=${bookingStatusFilter}` : '/api/admin/readings'
      const res = await fetch(url, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setBookingsError(data.detail || `Failed to fetch bookings (${res.status})`)
      }
    } catch (err) {
      setBookingsError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setBookingsLoading(false)
    }
  }, [bookingStatusFilter])

  const fetchAstrologers = useCallback(async () => {
    setAstrologersLoading(true)
    setAstrologersError(null)
    try {
      const res = await fetch('/api/admin/astrologers', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setAstrologers(data.astrologers || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setAstrologersError(data.detail || `Failed to fetch astrologers (${res.status})`)
      }
    } catch (err) {
      setAstrologersError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAstrologersLoading(false)
    }
  }, [])

  useEffect(() => { fetchPromos() }, [fetchPromos])
  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { fetchAstrologers() }, [fetchAstrologers])

  const fetchWhopStatus = useCallback(async () => {
    setWhopLoading(true)
    setWhopError(null)
    try {
      const res = await fetch('/api/admin/whop', { credentials: 'same-origin' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setWhopError(data.detail || `Failed to fetch Whop status (${res.status})`)
        return
      }
      const data = await res.json() as WhopStatus
      setWhopStatus(data)
    } catch (err) {
      setWhopError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setWhopLoading(false)
    }
  }, [])

  useEffect(() => { fetchWhopStatus() }, [fetchWhopStatus])

  const fetchLsStatus = useCallback(async () => {
    setLsLoading(true)
    setLsError(null)
    try {
      const res = await fetch('/api/admin/lemonsqueezy', { credentials: 'same-origin' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setLsError(data.detail || `Failed to fetch LS status (${res.status})`)
        return
      }
      const data = await res.json() as LsStatus
      setLsStatus(data)
    } catch (err) {
      setLsError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLsLoading(false)
    }
  }, [])

  useEffect(() => { fetchLsStatus() }, [fetchLsStatus])

  const fetchSubOverview = useCallback(async () => {
    setSubLoading(true)
    setSubError(null)
    try {
      const res = await fetch('/api/admin/subscriptions', { credentials: 'same-origin' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubError(data.detail || `Failed to fetch subscriptions (${res.status})`)
        return
      }
      const data = await res.json() as SubOverview
      setSubOverview(data)
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubOverview() }, [fetchSubOverview])

  // ──────────────── Access handlers ────────────────

  const handleGrantAccess = async () => {
    if (!grantDeviceId.trim()) return
    setGrantSubmitting(true)
    setGrantMessage(null)
    try {
      let body: Record<string, unknown>
      if (grantMode === 'legacy') {
        body = { deviceId: grantDeviceId.trim(), accessLevel: grantAccessLevel }
        if (grantReason.trim()) body.reason = grantReason.trim()
        if (grantExpiresAt) body.expiresAt = new Date(grantExpiresAt).toISOString()
      } else {
        if (grantAnalysisTypes.length === 0) {
          setGrantMessage({ type: 'error', text: 'Select at least one analysis type or use legacy mode.' })
          setGrantSubmitting(false)
          return
        }
        body = { deviceId: grantDeviceId.trim(), analysisTypes: grantAnalysisTypes, source: 'admin_grant' }
        if (grantReason.trim()) body.reason = grantReason.trim()
        if (grantExpiresAt) body.expiresAt = new Date(grantExpiresAt).toISOString()
      }

      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })

      const data = await res.json()
      if (res.ok) {
        setGrantMessage({ type: 'success', text: `Access granted! ${data.updated ? 'Updated existing grant.' : 'Created new grant.'}` })
        toast({ title: 'Access Granted', description: `Successfully granted access to ${grantDeviceId.substring(0, 8)}...`, variant: 'default' })
        setGrantDeviceId('')
        setGrantReason('')
        setGrantExpiresAt('')
        setGrantAnalysisTypes([])
        fetchAccessGrants()
      } else {
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
        toast({ title: 'Access Revoked', description: `Access revoked for ${deviceId.substring(0, 8)}...` })
        fetchAccessGrants()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to revoke access', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  // ──────────────── Catalog handlers ────────────────

  const openCatalogCreate = () => {
    setCatalogEditItem(null)
    setCatalogForm({ analysisType: '', name: '', description: '', priceDollars: '', originalPriceDollars: '', isActive: true, sortOrder: 0, lsVariantId: '' })
    setCatalogDialogOpen(true)
  }

  const openCatalogEdit = (item: CatalogItem) => {
    setCatalogEditItem(item)
    setCatalogForm({
      analysisType: item.analysisType, name: item.name, description: item.description || '',
      priceDollars: (item.priceCents / 100).toFixed(2),
      originalPriceDollars: item.originalPriceCents ? (item.originalPriceCents / 100).toFixed(2) : '',
      isActive: item.isActive === 1, sortOrder: item.sortOrder,
      lsVariantId: item.lsVariantId || '',
    })
    setCatalogDialogOpen(true)
  }

  const handleCatalogSubmit = async () => {
    if (!catalogForm.analysisType.trim() || !catalogForm.name.trim()) return
    setCatalogSubmitting(true)
    try {
      const priceCents = dollarToCents(catalogForm.priceDollars)
      const originalPriceCents = catalogForm.originalPriceDollars ? dollarToCents(catalogForm.originalPriceDollars) : null
      const lsVariantId = catalogForm.lsVariantId.trim() || null

      if (catalogEditItem) {
        const res = await fetch(`/api/admin/catalog/${encodeURIComponent(catalogEditItem.analysisType)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catalogForm.name, description: catalogForm.description || null, priceCents, originalPriceCents, isActive: catalogForm.isActive, sortOrder: catalogForm.sortOrder, lsVariantId }),
          credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Catalog Updated', description: `${catalogForm.name} updated successfully` })
          fetchCatalog()
          setCatalogDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to update', variant: 'destructive' })
        }
      } else {
        const res = await fetch('/api/admin/catalog', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisType: catalogForm.analysisType, name: catalogForm.name, description: catalogForm.description || null, priceCents, originalPriceCents, isActive: catalogForm.isActive, sortOrder: catalogForm.sortOrder, lsVariantId }),
          credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Catalog Item Created', description: `${catalogForm.name} added to catalog` })
          fetchCatalog()
          setCatalogDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to create', variant: 'destructive' })
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    } finally {
      setCatalogSubmitting(false)
    }
  }

  const handleCatalogDelete = async (analysisType: string) => {
    if (!confirm(`Delete catalog item "${ANALYSIS_LABELS[analysisType] || analysisType}"? This will also remove it from any bundles.`)) return
    try {
      const res = await fetch(`/api/admin/catalog/${encodeURIComponent(analysisType)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Catalog item deleted' })
        fetchCatalog()
        fetchBundles()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to delete', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  // ──────────────── Bundle handlers ────────────────

  const openBundleCreate = () => {
    setBundleEditItem(null)
    setBundleForm({ slug: '', name: '', description: '', priceDollars: '', originalPriceDollars: '', items: [], isActive: true, sortOrder: 0 })
    setBundleDialogOpen(true)
  }

  const openBundleEdit = (bundle: BundleItem) => {
    setBundleEditItem(bundle)
    setBundleForm({
      slug: bundle.slug, name: bundle.name, description: bundle.description || '',
      priceDollars: (bundle.priceCents / 100).toFixed(2),
      originalPriceDollars: bundle.originalPriceCents ? (bundle.originalPriceCents / 100).toFixed(2) : '',
      items: [...bundle.items], isActive: bundle.isActive === 1, sortOrder: bundle.sortOrder,
    })
    setBundleDialogOpen(true)
  }

  const handleBundleSubmit = async () => {
    if (!bundleForm.slug.trim() || !bundleForm.name.trim()) return
    setBundleSubmitting(true)
    try {
      const priceCents = dollarToCents(bundleForm.priceDollars)
      const originalPriceCents = bundleForm.originalPriceDollars ? dollarToCents(bundleForm.originalPriceDollars) : null

      if (bundleEditItem) {
        const res = await fetch(`/api/admin/bundles/${encodeURIComponent(bundleEditItem.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: bundleForm.name, slug: bundleForm.slug, description: bundleForm.description || null, priceCents, originalPriceCents, items: bundleForm.items, isActive: bundleForm.isActive, sortOrder: bundleForm.sortOrder }),
          credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Bundle Updated', description: `${bundleForm.name} updated successfully` })
          fetchBundles()
          setBundleDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to update', variant: 'destructive' })
        }
      } else {
        const res = await fetch('/api/admin/bundles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: bundleForm.slug, name: bundleForm.name, description: bundleForm.description || null, priceCents, originalPriceCents, items: bundleForm.items, isActive: bundleForm.isActive, sortOrder: bundleForm.sortOrder }),
          credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Bundle Created', description: `${bundleForm.name} created` })
          fetchBundles()
          setBundleDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to create', variant: 'destructive' })
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    } finally {
      setBundleSubmitting(false)
    }
  }

  const handleBundleDelete = async (bundleId: string) => {
    if (!confirm('Delete this bundle?')) return
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(bundleId)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Bundle deleted' })
        fetchBundles()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to delete', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  // ──────────────── Promo handlers ────────────────

  const openPromoCreate = () => {
    setPromoEditItem(null)
    setPromoForm({ code: '', description: '', type: 'percent_off', value: 50, applicableType: 'all', applicableItems: [], maxUses: '', validFrom: '', validUntil: '', isActive: true })
    setPromoDialogOpen(true)
  }

  const openPromoEdit = (promo: PromoCode) => {
    setPromoEditItem(promo)
    setPromoForm({
      code: promo.code, description: promo.description || '', type: promo.type, value: promo.value,
      applicableType: promo.applicableType, applicableItems: promo.applicableItems || [],
      maxUses: promo.maxUses !== null ? String(promo.maxUses) : '',
      validFrom: promo.validFrom ? promo.validFrom.substring(0, 16) : '',
      validUntil: promo.validUntil ? promo.validUntil.substring(0, 16) : '',
      isActive: promo.isActive,
    })
    setPromoDialogOpen(true)
  }

  const handlePromoSubmit = async () => {
    if (!promoForm.code.trim()) return
    setPromoSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        code: promoForm.code.trim().toUpperCase(),
        description: promoForm.description || null,
        type: promoForm.type,
        value: promoForm.value,
        applicableType: promoForm.applicableType,
        applicableItems: promoForm.applicableType === 'specific' ? promoForm.applicableItems : null,
        maxUses: promoForm.maxUses ? parseInt(promoForm.maxUses) : null,
        validFrom: promoForm.validFrom || null,
        validUntil: promoForm.validUntil || null,
        isActive: promoForm.isActive,
      }

      if (promoEditItem) {
        const res = await fetch(`/api/admin/promos/${encodeURIComponent(promoEditItem.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Promo Updated', description: `${promoForm.code} updated` })
          fetchPromos()
          setPromoDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to update', variant: 'destructive' })
        }
      } else {
        const res = await fetch('/api/admin/promos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Promo Created', description: `${promoForm.code} created` })
          fetchPromos()
          setPromoDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to create', variant: 'destructive' })
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    } finally {
      setPromoSubmitting(false)
    }
  }

  const handlePromoDelete = async (promoId: string) => {
    if (!confirm('Delete this promo code?')) return
    try {
      const res = await fetch(`/api/admin/promos/${encodeURIComponent(promoId)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Promo code deleted' })
        fetchPromos()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to delete', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text)
    toast({ title: 'Copied!', description: `${text} copied to clipboard` })
  }

  // ──────────────── Astrologer CRUD handlers ────────────────

  const openAstrologerCreate = () => {
    setAstrologerEditItem(null)
    setAstrologerForm({ name: '', title: '', bio: '', specialties: 'vedic_reading', experienceYears: 0, qualifications: '', languages: 'English,Hindi', rating: 0, reviewCount: 0, photoUrl: '', isAvailable: true, sortOrder: 0 })
    setAstrologerDialogOpen(true)
  }

  const openAstrologerEdit = (astro: AstrologerProfile) => {
    setAstrologerEditItem(astro)
    setAstrologerForm({
      name: astro.name, title: astro.title || '', bio: astro.bio || '',
      specialties: astro.specialties, experienceYears: astro.experienceYears,
      qualifications: astro.qualifications || '', languages: astro.languages,
      rating: astro.rating, reviewCount: astro.reviewCount,
      photoUrl: astro.photoUrl || '', isAvailable: astro.isAvailable === 1, sortOrder: astro.sortOrder,
    })
    setAstrologerDialogOpen(true)
  }

  const handleAstrologerSubmit = async () => {
    if (!astrologerForm.name.trim()) return
    setAstrologerSubmitting(true)
    try {
      const body = { ...astrologerForm, isAvailable: astrologerForm.isAvailable }
      if (astrologerEditItem) {
        const res = await fetch(`/api/admin/astrologers/${encodeURIComponent(astrologerEditItem.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Astrologer Updated', description: `${astrologerForm.name} updated` })
          fetchAstrologers()
          setAstrologerDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to update', variant: 'destructive' })
        }
      } else {
        const res = await fetch('/api/admin/astrologers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), credentials: 'same-origin',
        })
        if (res.ok) {
          toast({ title: 'Astrologer Added', description: `${astrologerForm.name} added` })
          fetchAstrologers()
          setAstrologerDialogOpen(false)
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.detail || 'Failed to add', variant: 'destructive' })
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    } finally {
      setAstrologerSubmitting(false)
    }
  }

  const handleAstrologerDelete = async (astrologerId: string) => {
    if (!confirm('Delete this astrologer? They will be unassigned from any bookings.')) return
    try {
      const res = await fetch(`/api/admin/astrologers/${encodeURIComponent(astrologerId)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Astrologer deleted' })
        fetchAstrologers()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to delete', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  const openBookingDetail = (booking: ReadingBooking) => {
    setSelectedBooking(booking)
    setBookingUpdateForm({
      status: booking.status,
      astrologerId: booking.astrologerId || '',
      scheduledAt: booking.scheduledAt ? booking.scheduledAt.substring(0, 16) : '',
      meetingLink: booking.meetingLink || '',
      notes: booking.notes || '',
    })
    setBookingDialogOpen(true)
  }

  const handleBookingUpdate = async () => {
    if (!selectedBooking) return
    setBookingUpdateSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      if (bookingUpdateForm.status) body.status = bookingUpdateForm.status
      if (bookingUpdateForm.astrologerId) body.astrologerId = bookingUpdateForm.astrologerId
      else if (bookingUpdateForm.astrologerId === '' && selectedBooking.astrologerId) body.astrologerId = null
      if (bookingUpdateForm.scheduledAt) body.scheduledAt = new Date(bookingUpdateForm.scheduledAt).toISOString()
      if (bookingUpdateForm.meetingLink) body.meetingLink = bookingUpdateForm.meetingLink
      if (bookingUpdateForm.notes) body.notes = bookingUpdateForm.notes

      const res = await fetch(`/api/admin/readings/${encodeURIComponent(selectedBooking.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), credentials: 'same-origin',
      })
      if (res.ok) {
        toast({ title: 'Booking Updated', description: `Booking ${selectedBooking.bookingRef} updated` })
        fetchBookings()
        setBookingDialogOpen(false)
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to update', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    } finally {
      setBookingUpdateSubmitting(false)
    }
  }

  const handleBookingDelete = async (bookingId: string) => {
    if (!confirm('Delete this booking?')) return
    try {
      const res = await fetch(`/api/admin/readings/${encodeURIComponent(bookingId)}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Booking deleted' })
        fetchBookings()
        setBookingDialogOpen(false)
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.detail || 'Failed to delete', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' })
    }
  }

  // ──────────────── Default stats for when API fails ────────────────

  const EMPTY_STATS: StatsData = {
    totalAnalyses: 0, totalUsage: 0, uniqueDevices: 0,
    analysesByType: {}, usageByType: {}, providerUsage: {},
    dailyActivity: {}, recentUsage: [], sharedCharts: [],
    totalSharedCharts: 0, totalSharedViews: 0, eventsByType: {},
    analyticsEvents: [],
  }

  const effectiveStats = stats || EMPTY_STATS

  // ──────────────── Chart data ────────────────

  const usageByTypeData = Object.entries(effectiveStats.usageByType)
    .map(([type, count]) => ({ name: ANALYSIS_LABELS[type] || type, count }))
    .sort((a, b) => b.count - a.count)

  const providerData = Object.entries(effectiveStats.providerUsage)
    .map(([name, value]) => ({ name, value }))

  const dailyData = Object.entries(effectiveStats.dailyActivity)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, data]) => ({
      date: date.substring(5),
      Charts: data.charts,
      Analyses: data.analyses,
    }))

  const eventsData = Object.entries(effectiveStats.eventsByType)
    .map(([type, count]) => ({ name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count }))
    .sort((a, b) => b.count - a.count)

  // ──────────────── Render ────────────────

  return (
    <div className="min-h-screen bg-temple-bg flex flex-col">
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
              <Button onClick={fetchStats} variant="ghost" size="sm" className="text-saffron-light hover:bg-saffron/10">
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-saffron-light hover:bg-temple-red/20">
                <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
              <a href="/" className="text-saffron-light hover:text-gold-light text-sm flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Site
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="border-saffron/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Analyses</p>
                  <p className="text-3xl font-bold text-maroon">{effectiveStats.totalAnalyses}</p>
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
                  <p className="text-3xl font-bold text-maroon">{effectiveStats.totalUsage}</p>
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
                  <p className="text-3xl font-bold text-maroon">{effectiveStats.uniqueDevices}</p>
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
                  <p className="text-3xl font-bold text-maroon">{effectiveStats.totalSharedCharts}</p>
                  <p className="text-xs text-muted-foreground mt-1">{effectiveStats.totalSharedViews} total views</p>
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
                  <p className="text-3xl font-bold text-emerald-700">{accessGrants.filter(g => !g.isExpired).length + deviceAccessGrants.filter(g => !g.isExpired).length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Premium/Unlimited users</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-blue-300/30 ${messagesUnreadCount > 0 ? 'bg-blue-50/50' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages</p>
                  <p className="text-3xl font-bold text-blue-700">{messagesUnreadCount > 0 ? messagesUnreadCount : messagesTotalCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{messagesUnreadCount > 0 ? 'unread messages' : 'total messages'}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════ Main Tabs ═══════════ */}
        <Tabs defaultValue="analytics" className="mb-8">
          <TabsList className="bg-maroon/5 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-1" /> Catalog
            </TabsTrigger>
            <TabsTrigger value="bundles" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Gift className="w-4 h-4 mr-1" /> Bundles
            </TabsTrigger>
            <TabsTrigger value="promos" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Tag className="w-4 h-4 mr-1" /> Promos
            </TabsTrigger>
            <TabsTrigger value="access" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Shield className="w-4 h-4 mr-1" /> Access
            </TabsTrigger>
            <TabsTrigger value="readings" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <BookOpen className="w-4 h-4 mr-1" /> Readings
            </TabsTrigger>
            <TabsTrigger value="astrologers" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <UserCheck className="w-4 h-4 mr-1" /> Astrologers
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <Mail className="w-4 h-4 mr-1" /> Messages
            </TabsTrigger>
            <TabsTrigger value="whop" className="data-[state=active]:bg-saffron data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-1" /> Whop
            </TabsTrigger>
            <TabsTrigger value="lemonsqueezy" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-1" /> Lemon Squeezy
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Crown className="w-4 h-4 mr-1" /> Subscriptions
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ ANALYTICS TAB ═══════════ */}
          <TabsContent value="analytics">
            {error && (
              <Card className="border-amber-200 bg-amber-50 mb-4">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 font-medium">Analytics data unavailable</p>
                    <p className="text-xs text-amber-600">{error}</p>
                  </div>
                  <Button onClick={fetchStats} size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
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
                          <Tooltip contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }} />
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
                          <Tooltip contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }} />
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
                            <Pie data={providerData} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={120} fill="#8884d8" dataKey="value">
                              {providerData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }} />
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
                          <Tooltip contentStyle={{ backgroundColor: '#FFF8F0', border: '1px solid #C9721A44', borderRadius: '8px' }} />
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
              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon flex items-center gap-2"><Eye className="w-5 h-5" /> Recent Analysis Requests</CardTitle>
                  <CardDescription>Last 50 analysis requests from users</CardDescription>
                </CardHeader>
                <CardContent>
                  {effectiveStats.recentUsage.length > 0 ? (
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
                          {effectiveStats.recentUsage.map((u, i) => (
                            <TableRow key={i} className="hover:bg-saffron/5">
                              <TableCell><Badge variant="outline" className="text-xs border-saffron/30">{ANALYSIS_LABELS[u.analysisType] || u.analysisType}</Badge></TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{u.deviceId ? u.deviceId.substring(0, 8) + '...' : 'N/A'}</TableCell>
                              <TableCell className="text-xs">{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
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

              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon flex items-center gap-2"><Share2 className="w-5 h-5" /> Shared Charts</CardTitle>
                  <CardDescription>Most viewed shared charts</CardDescription>
                </CardHeader>
                <CardContent>
                  {effectiveStats.sharedCharts.length > 0 ? (
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
                          {effectiveStats.sharedCharts.map((s, i) => (
                            <TableRow key={i} className="hover:bg-saffron/5">
                              <TableCell><Badge variant="outline" className="text-xs border-saffron/30">{s.analysisType ? (ANALYSIS_LABELS[s.analysisType] || s.analysisType) : 'Chart Only'}</Badge></TableCell>
                              <TableCell className="font-bold text-maroon">{s.viewCount}</TableCell>
                              <TableCell>
                                {s.includeAnalysis ? <Badge className="bg-vedic-green text-white text-xs">Yes</Badge> : <Badge variant="outline" className="text-xs">No</Badge>}
                              </TableCell>
                              <TableCell className="text-xs">{new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
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
                <CardTitle className="text-maroon flex items-center gap-2"><Database className="w-5 h-5" /> Cache Statistics</CardTitle>
                <CardDescription>Cached analysis entries by type (cache hits save AI costs)</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(effectiveStats.analysesByType).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(effectiveStats.analysesByType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
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

          {/* ═══════════ CATALOG TAB ═══════════ */}
          <TabsContent value="catalog">
            {catalogError && (
              <Card className="border-red-200 bg-red-50 mb-4">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Failed to load catalog</p>
                    <p className="text-xs text-red-600">{catalogError}</p>
                  </div>
                  <Button onClick={fetchCatalog} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <RefreshCw className={`w-3 h-3 mr-1 ${catalogLoading ? 'animate-spin' : ''}`} /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2"><Package className="w-5 h-5" /> Premium Catalog</CardTitle>
                    <CardDescription>Manage premium analysis types and their pricing</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={fetchCatalog} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                      <RefreshCw className={`w-4 h-4 ${catalogLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={openCatalogCreate} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
                      <Plus className="w-4 h-4 mr-1" /> Add Catalog Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {catalogLoading && catalogItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Loading catalog...</p>
                ) : catalogItems.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-maroon/5">
                          <TableHead className="text-maroon font-semibold">Name</TableHead>
                          <TableHead className="text-maroon font-semibold">Analysis Type</TableHead>
                          <TableHead className="text-maroon font-semibold">Price</TableHead>
                          <TableHead className="text-maroon font-semibold">Original Price</TableHead>
                          <TableHead className="text-maroon font-semibold">Savings</TableHead>
                          <TableHead className="text-maroon font-semibold">Active</TableHead>
                          <TableHead className="text-maroon font-semibold">Sort</TableHead>
                          <TableHead className="text-maroon font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catalogItems.map((item) => {
                          const savings = savingsPercent(item.priceCents, item.originalPriceCents)
                          return (
                            <TableRow key={item.id} className="hover:bg-saffron/5">
                              <TableCell className="font-medium text-maroon">{item.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs border-saffron/30 font-mono">
                                  {item.analysisType}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold">{centsToDollar(item.priceCents)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {item.originalPriceCents ? (
                                  <span className="line-through">{centsToDollar(item.originalPriceCents)}</span>
                                ) : ('—')}
                              </TableCell>
                              <TableCell>
                                {savings > 0 ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs border-emerald-200">
                                    {savings}% OFF
                                  </Badge>
                                ) : ('—')}
                              </TableCell>
                              <TableCell>
                                {item.isActive === 1 ? (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-600"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-sm">{item.sortOrder}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openCatalogEdit(item)} className="text-saffron hover:bg-saffron/10">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleCatalogDelete(item.analysisType)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No catalog items yet. Click &quot;Add Catalog Item&quot; to get started.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ BUNDLES TAB ═══════════ */}
          <TabsContent value="bundles">
            {bundlesError && (
              <Card className="border-red-200 bg-red-50 mb-4">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Failed to load bundles</p>
                    <p className="text-xs text-red-600">{bundlesError}</p>
                  </div>
                  <Button onClick={fetchBundles} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <RefreshCw className={`w-3 h-3 mr-1 ${bundlesLoading ? 'animate-spin' : ''}`} /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-maroon flex items-center gap-2"><Gift className="w-5 h-5" /> Product Bundles</h2>
                <p className="text-sm text-muted-foreground">Group analysis types into discounted bundles</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={fetchBundles} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                  <RefreshCw className={`w-4 h-4 ${bundlesLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button onClick={openBundleCreate} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
                  <Plus className="w-4 h-4 mr-1" /> Create Bundle
                </Button>
              </div>
            </div>

            {bundlesLoading && bundles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Loading bundles...</p>
            ) : bundles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bundles.map((bundle) => {
                  const savings = savingsPercent(bundle.priceCents, bundle.originalPriceCents)
                  return (
                    <Card key={bundle.id} className="border-saffron/20 hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-maroon text-lg">{bundle.name}</CardTitle>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{bundle.slug}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openBundleEdit(bundle)} className="text-saffron hover:bg-saffron/10 h-8 w-8 p-0">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleBundleDelete(bundle.id)} className="text-red-500 hover:bg-red-50 h-8 w-8 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {bundle.description && (
                          <p className="text-sm text-muted-foreground mb-3">{bundle.description}</p>
                        )}
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-2xl font-bold text-maroon">{centsToDollar(bundle.priceCents)}</span>
                          {bundle.originalPriceCents && (
                            <>
                              <span className="text-sm text-muted-foreground line-through">{centsToDollar(bundle.originalPriceCents)}</span>
                              {savings > 0 && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-emerald-200">{savings}% OFF</Badge>
                              )}
                            </>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-maroon">Included Items:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {bundle.items.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs border-saffron/30 bg-saffron/5">
                                {ANALYSIS_LABELS[type] || type}
                              </Badge>
                            ))}
                            {bundle.items.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">No items</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          {bundle.isActive === 1 ? (
                            <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-red-300 text-red-600"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                          )}
                          <Badge variant="outline" className="text-xs text-muted-foreground">Sort: {bundle.sortOrder}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="border-saffron/20">
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">No bundles yet. Click &quot;Create Bundle&quot; to get started.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ PROMOS TAB ═══════════ */}
          <TabsContent value="promos">
            {promosError && (
              <Card className="border-red-200 bg-red-50 mb-4">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Failed to load promo codes</p>
                    <p className="text-xs text-red-600">{promosError}</p>
                  </div>
                  <Button onClick={fetchPromos} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <RefreshCw className={`w-3 h-3 mr-1 ${promosLoading ? 'animate-spin' : ''}`} /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2"><Tag className="w-5 h-5" /> Promo Codes</CardTitle>
                    <CardDescription>Manage promotional codes for discounts and free access</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={fetchPromos} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                      <RefreshCw className={`w-4 h-4 ${promosLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={openPromoCreate} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
                      <Plus className="w-4 h-4 mr-1" /> Create Promo Code
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {promosLoading && promos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Loading promo codes...</p>
                ) : promos.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-maroon/5">
                          <TableHead className="text-maroon font-semibold">Code</TableHead>
                          <TableHead className="text-maroon font-semibold">Type</TableHead>
                          <TableHead className="text-maroon font-semibold">Applicable</TableHead>
                          <TableHead className="text-maroon font-semibold">Max Uses</TableHead>
                          <TableHead className="text-maroon font-semibold">Used</TableHead>
                          <TableHead className="text-maroon font-semibold">Valid Until</TableHead>
                          <TableHead className="text-maroon font-semibold">Status</TableHead>
                          <TableHead className="text-maroon font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promos.map((promo) => {
                          const isExpired = promo.validUntil ? new Date(promo.validUntil) < new Date() : false
                          const isFullyUsed = promo.maxUses !== null && promo.useCount >= promo.maxUses
                          const isInactive = !promo.isActive

                          const promoLabel = promo.type === 'percent_off' ? `${promo.value}% Off`
                            : promo.type === 'fixed_off' ? `${centsToDollar(promo.value * 100)} Off`
                            : `${promo.value} Days Free`

                          return (
                            <TableRow key={promo.id} className="hover:bg-saffron/5">
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <code className="font-mono text-sm font-semibold text-maroon bg-saffron/10 px-2 py-0.5 rounded">{promo.code}</code>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(promo.code)} className="h-6 w-6 p-0 text-muted-foreground hover:text-saffron">
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${promo.type === 'percent_off' ? 'bg-amber-100 text-amber-800 border-amber-200' : promo.type === 'fixed_off' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'}`}>
                                  {promoLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {promo.applicableType === 'all' ? (
                                  <Badge variant="outline" className="text-xs">All Items</Badge>
                                ) : promo.applicableType === 'bundle' ? (
                                  <Badge variant="outline" className="text-xs border-gold/30">Bundle</Badge>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(promo.applicableItems || []).slice(0, 2).map((item) => (
                                      <Badge key={item} variant="outline" className="text-[10px] border-saffron/30">{ANALYSIS_LABELS[item] || item}</Badge>
                                    ))}
                                    {(promo.applicableItems || []).length > 2 && (
                                      <Badge variant="outline" className="text-[10px]">+{(promo.applicableItems || []).length - 2}</Badge>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-center">{promo.maxUses ?? '∞'}</TableCell>
                              <TableCell className="text-sm text-center">{promo.useCount}</TableCell>
                              <TableCell className="text-xs">
                                {promo.validUntil ? (
                                  <span className={isExpired ? 'text-red-500' : ''}>
                                    {new Date(promo.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">Never</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isInactive ? (
                                  <Badge variant="outline" className="text-xs border-gray-300 text-gray-500">Inactive</Badge>
                                ) : isExpired ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-600"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
                                ) : isFullyUsed ? (
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700"><Clock className="w-3 h-3 mr-1" />Fully Used</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openPromoEdit(promo)} className="text-saffron hover:bg-saffron/10">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handlePromoDelete(promo.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No promo codes yet. Click &quot;Create Promo Code&quot; to get started.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ ACCESS TAB ═══════════ */}
          <TabsContent value="access">
            {accessError && (
              <Card className="border-red-200 bg-red-50 mb-4">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Failed to load access grants</p>
                    <p className="text-xs text-red-600">{accessError}</p>
                  </div>
                  <Button onClick={fetchAccessGrants} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <RefreshCw className={`w-3 h-3 mr-1 ${accessLoading ? 'animate-spin' : ''}`} /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
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
                      <CardTitle className="text-maroon flex items-center gap-2"><Shield className="w-5 h-5" /> Grant Access</CardTitle>
                      <CardDescription>Give a device access to AI analyses</CardDescription>
                    </div>
                    <Button onClick={() => setGrantDialogOpen(true)} className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white">
                      <Plus className="w-4 h-4 mr-1" /> New Grant
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Legacy Access Grants Table */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-maroon flex items-center gap-2"><Shield className="w-5 h-5" /> Legacy Access Grants</CardTitle>
                      <CardDescription>Devices with Premium or Unlimited access (legacy system)</CardDescription>
                    </div>
                    <Button onClick={fetchAccessGrants} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                      <RefreshCw className={`w-4 h-4 ${accessLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {accessLoading && accessGrants.length === 0 && deviceAccessGrants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Loading access grants...</p>
                  ) : accessGrants.length > 0 ? (
                    <div className="max-h-[400px] overflow-auto">
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
                                  <Badge className="bg-gradient-to-r from-emerald-600 to-green-500 text-white text-xs">UNLIMITED</Badge>
                                ) : (
                                  <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-xs">PREMIUM</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{grant.reason || <span className="italic">No reason</span>}</TableCell>
                              <TableCell className="text-xs">{grant.grantedBy}</TableCell>
                              <TableCell className="text-xs">
                                {grant.expiresAt ? (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(grant.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">Never</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {grant.isExpired ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-600"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleRevokeAccess(grant.deviceId)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No legacy access grants.</p>
                  )}
                </CardContent>
              </Card>

              {/* Granular Access Grants Table */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon flex items-center gap-2"><Zap className="w-5 h-5" /> Granular Access Grants</CardTitle>
                  <CardDescription>Per-type access grants for specific analysis types</CardDescription>
                </CardHeader>
                <CardContent>
                  {deviceAccessGrants.length > 0 ? (
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-maroon/5">
                            <TableHead className="text-maroon font-semibold">Device ID</TableHead>
                            <TableHead className="text-maroon font-semibold">Analysis Type</TableHead>
                            <TableHead className="text-maroon font-semibold">Source</TableHead>
                            <TableHead className="text-maroon font-semibold">Reason</TableHead>
                            <TableHead className="text-maroon font-semibold">Expires</TableHead>
                            <TableHead className="text-maroon font-semibold">Status</TableHead>
                            <TableHead className="text-maroon font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deviceAccessGrants.map((grant) => (
                            <TableRow key={grant.id} className="hover:bg-saffron/5">
                              <TableCell className="font-mono text-xs">
                                <span className="cursor-pointer hover:text-saffron" title={grant.deviceId} onClick={() => navigator.clipboard?.writeText(grant.deviceId)}>
                                  {grant.deviceId.substring(0, 12)}...
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs border-saffron/30 bg-saffron/5">
                                  {grant.analysisType === 'all_premium' ? 'All Premium' : grant.analysisType === 'unlimited' ? 'Unlimited' : ANALYSIS_LABELS[grant.analysisType] || grant.analysisType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px]">{grant.source}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{grant.reason || <span className="italic">—</span>}</TableCell>
                              <TableCell className="text-xs">
                                {grant.expiresAt ? (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(grant.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">Never</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {grant.isExpired ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-600"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleRevokeAccess(grant.deviceId)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No granular access grants.</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Grant by Recent Device */}
              {effectiveStats.recentUsage.length > 0 && (
                <Card className="border-saffron/20">
                  <CardHeader>
                    <CardTitle className="text-maroon flex items-center gap-2 text-base"><Users className="w-5 h-5" /> Quick Grant from Recent Users</CardTitle>
                    <CardDescription>Click a device ID to quickly grant access</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {[...new Map(effectiveStats.recentUsage.map(u => [u.deviceId, u])).values()].slice(0, 20).map((u) => (
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
          {/* ═══════════ READINGS TAB ═══════════ */}
          <TabsContent value="readings">
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2"><BookOpen className="w-5 h-5" /> Reading Bookings</CardTitle>
                    <CardDescription>Manage live reading bookings</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={bookingStatusFilter} onValueChange={setBookingStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={fetchBookings} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                      <RefreshCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {bookingsError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700">{bookingsError}</span>
                    <Button onClick={fetchBookings} size="sm" variant="outline" className="ml-auto border-red-300 text-red-700 hover:bg-red-100">
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  </div>
                )}
                {bookingsLoading && bookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading bookings...
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No reading bookings found</p>
                    <p className="text-xs mt-1">Bookings will appear when customers purchase readings</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-maroon font-semibold">Ref</TableHead>
                          <TableHead className="text-maroon font-semibold">Tier</TableHead>
                          <TableHead className="text-maroon font-semibold">Customer</TableHead>
                          <TableHead className="text-maroon font-semibold">Email</TableHead>
                          <TableHead className="text-maroon font-semibold">Status</TableHead>
                          <TableHead className="text-maroon font-semibold">Astrologer</TableHead>
                          <TableHead className="text-maroon font-semibold">Price</TableHead>
                          <TableHead className="text-maroon font-semibold">Scheduled</TableHead>
                          <TableHead className="text-maroon font-semibold">Created</TableHead>
                          <TableHead className="text-maroon font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">{b.bookingRef.substring(0, 8)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{ANALYSIS_LABELS[b.tier] || b.tier}</Badge></TableCell>
                            <TableCell className="text-sm">{b.customerName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.customerEmail}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${
                                b.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                b.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                b.status === 'scheduled' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                b.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                                b.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                                'bg-gray-100 text-gray-800 border-gray-200'
                              }`}>{b.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{b.astrologerName || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                            <TableCell className="text-sm font-medium">{centsToDollar(b.priceCents)}</TableCell>
                            <TableCell className="text-xs">{b.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString() : '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openBookingDetail(b)} className="text-saffron hover:bg-saffron/10">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ ASTROLOGERS TAB ═══════════ */}
          <TabsContent value="astrologers">
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2"><UserCheck className="w-5 h-5" /> Astrologer Profiles</CardTitle>
                    <CardDescription>Manage astrologer profiles and availability</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={openAstrologerCreate} size="sm" className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
                      <Plus className="w-4 h-4 mr-1" /> Add Astrologer
                    </Button>
                    <Button onClick={fetchAstrologers} variant="ghost" size="sm" className="text-saffron hover:bg-saffron/10">
                      <RefreshCw className={`w-4 h-4 ${astrologersLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {astrologersError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700">{astrologersError}</span>
                    <Button onClick={fetchAstrologers} size="sm" variant="outline" className="ml-auto border-red-300 text-red-700 hover:bg-red-100">
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  </div>
                )}
                {astrologersLoading && astrologers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading astrologers...
                  </div>
                ) : astrologers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No astrologers yet</p>
                    <p className="text-xs mt-1">Add astrologers to assign them to reading bookings</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-maroon font-semibold">Name</TableHead>
                          <TableHead className="text-maroon font-semibold">Title</TableHead>
                          <TableHead className="text-maroon font-semibold">Specialties</TableHead>
                          <TableHead className="text-maroon font-semibold">Experience</TableHead>
                          <TableHead className="text-maroon font-semibold">Rating</TableHead>
                          <TableHead className="text-maroon font-semibold">Languages</TableHead>
                          <TableHead className="text-maroon font-semibold">Available</TableHead>
                          <TableHead className="text-maroon font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {astrologers.map((astro) => (
                          <TableRow key={astro.id}>
                            <TableCell className="font-medium text-sm">{astro.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{astro.title || '—'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {astro.specialties.split(',').map((s) => (
                                  <Badge key={s} variant="outline" className="text-xs">{ANALYSIS_LABELS[s.trim()] || s.trim()}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{astro.experienceYears} yr{astro.experienceYears !== 1 ? 's' : ''}</TableCell>
                            <TableCell className="text-sm">{astro.rating > 0 ? `⭐ ${astro.rating.toFixed(1)}` : '—'} <span className="text-xs text-muted-foreground">({astro.reviewCount})</span></TableCell>
                            <TableCell className="text-xs">{astro.languages}</TableCell>
                            <TableCell>
                              {astro.isAvailable === 1 ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Available</Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Offline</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openAstrologerEdit(astro)} className="text-saffron hover:bg-saffron/10">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAstrologerDelete(astro.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ MESSAGES TAB ═══════════ */}
          <TabsContent value="messages">
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2">
                      <Mail className="w-5 h-5 text-saffron" /> Contact Messages
                    </CardTitle>
                    <CardDescription>
                      {messagesUnreadCount > 0
                        ? `${messagesUnreadCount} unread of ${messagesTotalCount} total`
                        : `${messagesTotalCount} messages — all read`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={fetchMessages} size="sm" variant="outline" className="border-saffron/30 text-maroon">
                      <RefreshCw className={`w-3 h-3 mr-1 ${messagesLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Messages from the Contact page will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`border rounded-lg p-4 transition-all ${
                          msg.isRead ? 'border-saffron/10 bg-white' : 'border-saffron/30 bg-saffron/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!msg.isRead && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" title="Unread" />
                              )}
                              <span className="font-semibold text-sm text-maroon">{msg.name}</span>
                              <span className="text-xs text-muted-foreground">{msg.email}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(msg.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              onClick={() => markMessageRead(msg.id, !msg.isRead)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                            >
                              {msg.isRead ? (
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Mail className="w-3.5 h-3.5 text-blue-500" />
                              )}
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm('Delete this message?')) deleteMessage(msg.id)
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ WHOP TAB ═══════════ */}
          <TabsContent value="whop">
            <Card className="border-saffron/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-saffron" /> Whop Integration Status
                    </CardTitle>
                    <CardDescription>
                      Configuration, API health, and recent memberships for your private Whop payment system
                    </CardDescription>
                  </div>
                  <Button onClick={fetchWhopStatus} size="sm" variant="outline" className="border-saffron/30 text-maroon">
                    <RefreshCw className={`w-3 h-3 mr-1 ${whopLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {whopLoading && !whopStatus ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Checking Whop configuration…</p>
                  </div>
                ) : whopError ? (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Failed to load Whop status</p>
                    <p className="text-xs text-red-600 mt-1">{whopError}</p>
                  </div>
                ) : whopStatus ? (
                  <>
                    {/* Configuration status cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`border rounded-lg p-3 ${whopStatus.configured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {whopStatus.configured ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                          <span className="text-xs font-semibold text-maroon">Overall</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${whopStatus.configured ? 'text-green-700' : 'text-red-700'}`}>
                          {whopStatus.configured ? 'Configured' : 'Not Configured'}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${whopStatus.api.status === 200 ? 'border-green-200 bg-green-50' : whopStatus.api.status ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {whopStatus.api.status === 200 ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                          <span className="text-xs font-semibold text-maroon">API Health</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${whopStatus.api.status === 200 ? 'text-green-700' : whopStatus.api.status ? 'text-amber-700' : 'text-red-700'}`}>
                          {whopStatus.api.status ? `HTTP ${whopStatus.api.status}` : 'No response'}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${whopStatus.recentMemberships.length > 0 ? 'border-green-200 bg-green-50' : 'border-saffron/20 bg-saffron/5'}`}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-saffron" />
                          <span className="text-xs font-semibold text-maroon">Active Members</span>
                        </div>
                        <p className="text-sm font-bold mt-1 text-maroon">
                          {whopStatus.recentMemberships.length}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${whopStatus.hasCheckoutUrl ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex items-center gap-2">
                          {whopStatus.hasCheckoutUrl ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                          <span className="text-xs font-semibold text-maroon">Checkout URL</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${whopStatus.hasCheckoutUrl ? 'text-green-700' : 'text-amber-700'}`}>
                          {whopStatus.hasCheckoutUrl ? 'Set' : 'Auto-generated'}
                        </p>
                      </div>
                    </div>

                    {/* Environment variables checklist */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">Environment Variables</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {[
                          ['WHOP_APP_ID', whopStatus.hasAppId, whopStatus.fullConfig.appId],
                          ['WHOP_CLIENT_SECRET', whopStatus.hasClientSecret, whopStatus.hasClientSecret ? '•••••••• (hidden)' : null],
                          ['WHOP_API_KEY', whopStatus.hasApiKey, whopStatus.hasApiKey ? '•••••••• (hidden)' : null],
                          ['WHOP_PRODUCT_ID', whopStatus.hasProductId, whopStatus.fullConfig.productId],
                          ['WHOP_COMPANY_ID', whopStatus.hasCompanyId, whopStatus.fullConfig.companyId],
                          ['WHOP_EXPERIENCE_ID', whopStatus.hasExperienceId, whopStatus.fullConfig.experienceId],
                          ['WHOP_REDIRECT_URI', whopStatus.hasRedirectUri, whopStatus.fullConfig.redirectUri],
                          ['WHOP_CHECKOUT_URL', whopStatus.hasCheckoutUrl, whopStatus.checkoutUrl],
                        ].map(([name, set, value]) => (
                          <div key={name as string} className="flex items-start gap-2">
                            {set ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <code className="text-xs font-mono text-maroon">{name}</code>
                              {value ? (
                                <p className="text-xs text-muted-foreground break-all mt-0.5">{value}</p>
                              ) : (
                                <p className="text-xs text-red-500 mt-0.5">missing</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* API error if any */}
                    {whopStatus.api.error && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> API Warning
                        </p>
                        <p className="text-xs text-amber-700 mt-1 break-all">{whopStatus.api.error}</p>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-saffron/5">
                      <p className="text-sm font-semibold text-maroon mb-2">Quick Actions</p>
                      <div className="flex flex-wrap gap-2">
                        {whopStatus.checkoutUrl && (
                          <a
                            href={whopStatus.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-amber-600 text-white hover:bg-amber-500 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open Checkout
                          </a>
                        )}
                        {whopStatus.fullConfig.redirectUri && (
                          <a
                            href={whopStatus.fullConfig.redirectUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-amber-600/50 text-amber-700 hover:bg-amber-50 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Test Redirect URI
                          </a>
                        )}
                        <a
                          href="https://whop.com/dashboard/developer/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-saffron/30 text-maroon hover:bg-saffron/10 font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Whop Developer Dashboard
                        </a>
                        <a
                          href="/SETUP_WHOP.md"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-saffron/30 text-maroon hover:bg-saffron/10 font-medium"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Setup Guide
                        </a>
                      </div>
                    </div>

                    {/* Recent memberships table */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">
                        Recent Active Memberships {whopStatus.recentMemberships.length > 0 && `(${whopStatus.recentMemberships.length})`}
                      </p>
                      {whopStatus.recentMemberships.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No active memberships yet</p>
                          <p className="text-xs mt-1">When users buy your Whop product, they'll appear here.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Membership ID</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Plan ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {whopStatus.recentMemberships.map((m) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-mono text-xs">{m.id}</TableCell>
                                <TableCell>{m.productTitle || m.productId}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-green-700 border-green-300">{m.status}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{m.planId}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Help box */}
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Need help?</strong> See <code className="font-mono bg-blue-100 px-1 rounded">SETUP_WHOP.md</code> in the repo root
                        for step-by-step instructions on creating the Whop OAuth app, generating API keys, and configuring
                        your <code className="font-mono bg-blue-100 px-1 rounded">.env</code> file.
                        You can also hit <code className="font-mono bg-blue-100 px-1 rounded">/api/whop/setup</code> for a public
                        diagnostic check.
                      </p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ LEMON SQUEEZY TAB ═══════════ */}
          <TabsContent value="lemonsqueezy">
            <Card className="border-purple-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-600" /> Lemon Squeezy Integration
                    </CardTitle>
                    <CardDescription>
                      MoR payment provider — handles global VAT/tax automatically. Runs alongside Whop.
                    </CardDescription>
                  </div>
                  <Button onClick={fetchLsStatus} size="sm" variant="outline" className="border-purple-300 text-purple-700">
                    <RefreshCw className={`w-3 h-3 mr-1 ${lsLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lsLoading && !lsStatus ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Checking Lemon Squeezy configuration…</p>
                  </div>
                ) : lsError ? (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Failed to load LS status</p>
                    <p className="text-xs text-red-600 mt-1">{lsError}</p>
                  </div>
                ) : lsStatus ? (
                  <>
                    {/* Configuration status cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`border rounded-lg p-3 ${lsStatus.configured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {lsStatus.configured ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                          <span className="text-xs font-semibold text-maroon">Overall</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${lsStatus.configured ? 'text-green-700' : 'text-red-700'}`}>
                          {lsStatus.configured ? 'Configured' : 'Not Configured'}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${lsStatus.api.status === 200 ? 'border-green-200 bg-green-50' : lsStatus.api.status ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {lsStatus.api.status === 200 ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                          <span className="text-xs font-semibold text-maroon">API Health</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${lsStatus.api.status === 200 ? 'text-green-700' : lsStatus.api.status ? 'text-amber-700' : 'text-red-700'}`}>
                          {lsStatus.api.status ? `HTTP ${lsStatus.api.status}` : 'No response'}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${lsStatus.recentSubscriptions.length > 0 ? 'border-green-200 bg-green-50' : 'border-purple-200 bg-purple-50'}`}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-semibold text-maroon">Recent Subs</span>
                        </div>
                        <p className="text-sm font-bold mt-1 text-maroon">
                          {lsStatus.recentSubscriptions.length}
                        </p>
                      </div>
                      <div className={`border rounded-lg p-3 ${lsStatus.hasWebhookSecret ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {lsStatus.hasWebhookSecret ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                          <span className="text-xs font-semibold text-maroon">Webhook</span>
                        </div>
                        <p className={`text-sm font-bold mt-1 ${lsStatus.hasWebhookSecret ? 'text-green-700' : 'text-red-700'}`}>
                          {lsStatus.hasWebhookSecret ? 'Secret Set' : 'Missing!'}
                        </p>
                      </div>
                    </div>

                    {/* Environment variables checklist */}
                    <div className="border border-purple-200 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">Environment Variables</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {[
                          ['LEMONSQUEEZY_API_KEY', lsStatus.hasApiKey, lsStatus.apiKeyPreview],
                          ['LEMONSQUEEZY_STORE_ID', lsStatus.hasStoreId, lsStatus.fullConfig.storeId],
                          ['LEMONSQUEEZY_VARIANT_ID', lsStatus.hasVariantId, lsStatus.fullConfig.variantId],
                          ['LEMONSQUEEZY_WEBHOOK_SECRET', lsStatus.hasWebhookSecret, lsStatus.hasWebhookSecret ? '•••••••• (hidden)' : null],
                          ['LEMONSQUEEZY_CHECKOUT_URL', lsStatus.hasCheckoutUrl, lsStatus.fullConfig.checkoutUrl],
                        ].map(([name, set, value]) => (
                          <div key={name as string} className="flex items-start gap-2">
                            {set ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <code className="text-xs font-mono text-maroon">{name}</code>
                              {value ? (
                                <p className="text-xs text-muted-foreground break-all mt-0.5">{value}</p>
                              ) : (
                                <p className="text-xs text-red-500 mt-0.5">missing</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* API error if any */}
                    {lsStatus.api.error && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> API Warning
                        </p>
                        <p className="text-xs text-amber-700 mt-1 break-all">{lsStatus.api.error}</p>
                      </div>
                    )}

                    {/* Webhook URL prompt */}
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Webhook URL (paste this into Lemon Squeezy dashboard)</p>
                      <code className="text-xs font-mono bg-blue-100 px-2 py-1 rounded break-all block">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/lemonsqueezy/webhook` : '/api/lemonsqueezy/webhook'}
                      </code>
                      <p className="text-xs text-blue-700 mt-2">
                        Go to <a href="https://app.lemonsqueezy.com/settings/webhooks" target="_blank" rel="noopener noreferrer" className="underline font-medium">Lemon Squeezy → Settings → Webhooks</a> and add this URL.
                        Copy the signing secret they give you and set it as <code className="font-mono bg-blue-100 px-1 rounded">LEMONSQUEEZY_WEBHOOK_SECRET</code>.
                      </p>
                    </div>

                    {/* Quick actions */}
                    <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                      <p className="text-sm font-semibold text-maroon mb-2">Quick Actions</p>
                      <div className="flex flex-wrap gap-2">
                        {lsStatus.configured && (
                          <a
                            href="/api/lemonsqueezy/checkout"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-500 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Test Checkout
                          </a>
                        )}
                        <a
                          href="https://app.lemonsqueezy.com/products"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-purple-300 text-purple-700 hover:bg-purple-100 font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> LS Products
                        </a>
                        <a
                          href="https://app.lemonsqueezy.com/settings/api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-purple-300 text-purple-700 hover:bg-purple-100 font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> API Keys
                        </a>
                        <a
                          href="https://app.lemonsqueezy.com/settings/webhooks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-purple-300 text-purple-700 hover:bg-purple-100 font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Webhooks
                        </a>
                        <a
                          href="/SETUP_LEMONSQUEEZY.md"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-saffron/30 text-maroon hover:bg-saffron/10 font-medium"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Setup Guide
                        </a>
                      </div>
                    </div>

                    {/* Recent subscriptions table */}
                    <div className="border border-purple-200 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">
                        Recent Subscriptions {lsStatus.recentSubscriptions.length > 0 && `(${lsStatus.recentSubscriptions.length})`}
                      </p>
                      {lsStatus.recentSubscriptions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No subscriptions yet</p>
                          <p className="text-xs mt-1">When users pay via Lemon Squeezy, their subscription will appear here.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Renews / Ends</TableHead>
                              <TableHead>Updated</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lsStatus.recentSubscriptions.map((sub) => (
                              <TableRow key={sub.subscriptionId}>
                                <TableCell>
                                  <div className="text-sm">{sub.customerEmail}</div>
                                  {sub.customerName && <div className="text-xs text-muted-foreground">{sub.customerName}</div>}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      sub.status === 'active' || sub.status === 'on_trial'
                                        ? 'text-green-700 border-green-300'
                                        : 'text-red-700 border-red-300'
                                    }
                                  >
                                    {sub.statusFormatted || sub.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {sub.renewsAt ? `Renews ${new Date(sub.renewsAt).toLocaleDateString()}` : '—'}
                                  {sub.currentPeriodEnd ? <div className="text-muted-foreground">Ends ${new Date(sub.currentPeriodEnd).toLocaleDateString()}</div> : null}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(sub.updatedAt).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Help box */}
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>How Lemon Squeezy works alongside Whop:</strong> Both providers can be configured
                        at the same time. The front-end shows buttons for whichever providers are configured.
                        Users who pay via LS get a <code className="font-mono bg-blue-100 px-1 rounded">DeviceAccess</code>
                        grant with <code className="font-mono bg-blue-100 px-1 rounded">source='lemonsqueezy'</code> —
                        works with the existing premium-access gating, no code changes needed.
                        See <code className="font-mono bg-blue-100 px-1 rounded">SETUP_LEMONSQUEEZY.md</code> for the
                        full walkthrough.
                      </p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ SUBSCRIPTIONS TAB ═══════════ */}
          <TabsContent value="subscriptions">
            <Card className="border-emerald-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-maroon flex items-center gap-2">
                      <Crown className="w-5 h-5 text-emerald-600" /> Subscription Overview
                    </CardTitle>
                    <CardDescription>
                      All 9 subscription tiers, configuration status, active subscribers, and revenue
                    </CardDescription>
                  </div>
                  <Button onClick={fetchSubOverview} size="sm" variant="outline" className="border-emerald-300 text-emerald-700">
                    <RefreshCw className={`w-3 h-3 mr-1 ${subLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {subLoading && !subOverview ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Loading subscription overview…</p>
                  </div>
                ) : subError ? (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Failed to load</p>
                    <p className="text-xs text-red-600 mt-1">{subError}</p>
                  </div>
                ) : subOverview ? (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-maroon">Active Subs</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{subOverview.totalActiveSubs}</p>
                      </div>
                      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-maroon">MRR</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-700 mt-1">{subOverview.mrrLabel}</p>
                      </div>
                      <div className="border border-saffron/20 bg-saffron/5 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-saffron" />
                          <span className="text-xs font-semibold text-maroon">Pro Subs</span>
                        </div>
                        <p className="text-2xl font-bold text-maroon mt-1">{subOverview.subscriberCounts.pro || 0}</p>
                      </div>
                      <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-semibold text-maroon">Advanced Subs</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700 mt-1">{(subOverview.subscriberCounts.advanced || 0) + (subOverview.subscriberCounts.all_access || 0)}</p>
                      </div>
                    </div>

                    {/* Tier matrix table */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">Tier Configuration (9 tiers)</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tier</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Charts/Period</TableHead>
                            <TableHead>LS Variant</TableHead>
                            <TableHead>Whop Product</TableHead>
                            <TableHead>Active Subs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subOverview.tierMatrix.map((t) => (
                            <TableRow key={`${t.tier}-${t.period}`}>
                              <TableCell className="font-medium capitalize">{t.tier.replace('_', '-')}</TableCell>
                              <TableCell className="capitalize">{t.period}</TableCell>
                              <TableCell className="font-semibold">{t.priceLabel}</TableCell>
                              <TableCell>{t.chartsPerPeriod === 999999 ? '∞' : t.chartsPerPeriod}</TableCell>
                              <TableCell>
                                {t.lsConfigured ? (
                                  <Badge className="bg-green-100 text-green-800 text-[9px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" /> {t.lsVariantId}</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 text-[9px]"><XCircle className="w-2.5 h-2.5 mr-0.5" /> Missing</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {t.whopConfigured ? (
                                  <Badge className="bg-green-100 text-green-800 text-[9px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" /> {t.whopProductId}</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">Not set</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {/* Count subs matching this tier+period */}
                                {subOverview.recentSubscriptions.filter(s => s.tier === t.tier && s.period === t.period && s.status === 'active').length}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Env vars to set:</strong> LEMONSQUEEZY_VARIANT_&lt;TIER&gt;_&lt;PERIOD&gt; (e.g., LEMONSQUEEZY_VARIANT_PRO_MONTHLY=12345)
                      </p>
                    </div>

                    {/* Recent subscriptions table */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">
                        Recent Subscriptions {subOverview.recentSubscriptions.length > 0 && `(${subOverview.recentSubscriptions.length})`}
                      </p>
                      {subOverview.recentSubscriptions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No subscriptions yet</p>
                          <p className="text-xs mt-1">When users subscribe via Lemon Squeezy or Whop, they'll appear here.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Tier</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>Provider</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Charts Used</TableHead>
                              <TableHead>Period End</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subOverview.recentSubscriptions.map((s) => (
                              <TableRow key={s.subscriptionId}>
                                <TableCell className="text-sm">{s.customerEmail}</TableCell>
                                <TableCell className="capitalize">{s.tier.replace('_', '-')}</TableCell>
                                <TableCell className="capitalize">{s.period}</TableCell>
                                <TableCell>{s.provider}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={s.status === 'active' ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}>
                                    {s.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{s.chartsUsedThisPeriod} / {s.chartsPerPeriod === 999999 ? '∞' : s.chartsPerPeriod}</TableCell>
                                <TableCell className="text-xs">{s.periodEnd ? new Date(s.periodEnd).toLocaleDateString() : '∞'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Revenue by tier */}
                    <div className="border border-saffron/20 rounded-lg p-4 bg-white">
                      <p className="text-sm font-semibold text-maroon mb-3">Revenue by Tier (active subscriptions)</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-lg bg-saffron/5">
                          <p className="text-xs text-muted-foreground">Pro</p>
                          <p className="text-lg font-bold text-maroon">${((subOverview.revenueByTier.pro || 0) / 100).toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-purple-50">
                          <p className="text-xs text-muted-foreground">Advanced</p>
                          <p className="text-lg font-bold text-purple-700">${((subOverview.revenueByTier.advanced || 0) / 100).toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-emerald-50">
                          <p className="text-xs text-muted-foreground">All-Access</p>
                          <p className="text-lg font-bold text-emerald-700">${((subOverview.revenueByTier.all_access || 0) / 100).toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        MRR (Monthly Recurring Revenue): <strong>{subOverview.mrrLabel}</strong> — excludes lifetime (one-time) purchases.
                      </p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ═══════════ DIALOGS ═══════════ */}

      {/* Booking Detail / Update Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-saffron" /> Booking Details
            </DialogTitle>
            <DialogDescription>View and update reading booking</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              {/* Booking Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Booking Ref</Label>
                  <p className="font-mono text-sm font-medium">{selectedBooking.bookingRef}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tier</Label>
                  <p className="text-sm">{ANALYSIS_LABELS[selectedBooking.tier] || selectedBooking.tier}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer Name</Label>
                  <p className="text-sm">{selectedBooking.customerName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm">{selectedBooking.customerEmail}</p>
                </div>
                {selectedBooking.customerPhone && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm">{selectedBooking.customerPhone}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Language</Label>
                  <p className="text-sm">{selectedBooking.preferredLanguage}</p>
                </div>
                {selectedBooking.birthDate && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Birth Date</Label>
                    <p className="text-sm">{selectedBooking.birthDate}</p>
                  </div>
                )}
                {selectedBooking.birthTime && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Birth Time</Label>
                    <p className="text-sm">{selectedBooking.birthTime}</p>
                  </div>
                )}
                {selectedBooking.birthCity && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Birth City</Label>
                    <p className="text-sm">{selectedBooking.birthCity}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Price</Label>
                  <p className="text-sm font-medium">{centsToDollar(selectedBooking.priceCents)}</p>
                </div>
              </div>
              {selectedBooking.questions && (
                <div>
                  <Label className="text-xs text-muted-foreground">Questions</Label>
                  <p className="text-sm bg-amber-50 border border-amber-200 rounded p-2 mt-1">{selectedBooking.questions}</p>
                </div>
              )}
              {selectedBooking.focusAreas && (
                <div>
                  <Label className="text-xs text-muted-foreground">Focus Areas</Label>
                  <p className="text-sm bg-amber-50 border border-amber-200 rounded p-2 mt-1">{selectedBooking.focusAreas}</p>
                </div>
              )}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-maroon text-sm">Update Booking</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={bookingUpdateForm.status} onValueChange={(v) => setBookingUpdateForm(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Assign Astrologer</Label>
                    <Select value={bookingUpdateForm.astrologerId} onValueChange={(v) => setBookingUpdateForm(prev => ({ ...prev, astrologerId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {astrologers.filter(a => a.isAvailable === 1).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}{a.title ? ` — ${a.title}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Scheduled At</Label>
                    <Input type="datetime-local" value={bookingUpdateForm.scheduledAt} onChange={(e) => setBookingUpdateForm(prev => ({ ...prev, scheduledAt: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1"><Video className="w-3 h-3" /> Meeting Link</Label>
                    <Input value={bookingUpdateForm.meetingLink} onChange={(e) => setBookingUpdateForm(prev => ({ ...prev, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <Textarea value={bookingUpdateForm.notes} onChange={(e) => setBookingUpdateForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Internal notes about this booking..." rows={3} className="mt-1" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center gap-2">
            {selectedBooking && (
              <Button variant="destructive" size="sm" onClick={() => handleBookingDelete(selectedBooking.id)} className="mr-auto">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBookingUpdate} disabled={bookingUpdateSubmitting} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
              {bookingUpdateSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4 mr-1" /> Update Booking</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Astrologer Create/Edit Dialog */}
      <Dialog open={astrologerDialogOpen} onOpenChange={setAstrologerDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-saffron" /> {astrologerEditItem ? 'Edit Astrologer' : 'Add Astrologer'}
            </DialogTitle>
            <DialogDescription>{astrologerEditItem ? 'Update astrologer profile' : 'Add a new astrologer to the platform'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Name *</Label>
                <Input value={astrologerForm.name} onChange={(e) => setAstrologerForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Full name" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <Input value={astrologerForm.title} onChange={(e) => setAstrologerForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g., Vedic Astrologer" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Bio</Label>
              <Textarea value={astrologerForm.bio} onChange={(e) => setAstrologerForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="Brief biography..." rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Specialties (comma-separated)</Label>
                <Input value={astrologerForm.specialties} onChange={(e) => setAstrologerForm(prev => ({ ...prev, specialties: e.target.value }))} placeholder="vedic_reading,career" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Experience (years)</Label>
                <Input type="number" value={astrologerForm.experienceYears} onChange={(e) => setAstrologerForm(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Qualifications</Label>
                <Input value={astrologerForm.qualifications} onChange={(e) => setAstrologerForm(prev => ({ ...prev, qualifications: e.target.value }))} placeholder="Jyotish Acharya, etc." className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Languages (comma-separated)</Label>
                <Input value={astrologerForm.languages} onChange={(e) => setAstrologerForm(prev => ({ ...prev, languages: e.target.value }))} placeholder="English,Hindi" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Rating</Label>
                <Input type="number" step="0.1" min="0" max="5" value={astrologerForm.rating} onChange={(e) => setAstrologerForm(prev => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Review Count</Label>
                <Input type="number" min="0" value={astrologerForm.reviewCount} onChange={(e) => setAstrologerForm(prev => ({ ...prev, reviewCount: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Photo URL</Label>
              <Input value={astrologerForm.photoUrl} onChange={(e) => setAstrologerForm(prev => ({ ...prev, photoUrl: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={astrologerForm.isAvailable} onCheckedChange={(v) => setAstrologerForm(prev => ({ ...prev, isAvailable: v }))} />
                <Label className="text-sm font-medium">Available for bookings</Label>
              </div>
              <div>
                <Label className="text-sm font-medium">Sort Order</Label>
                <Input type="number" value={astrologerForm.sortOrder} onChange={(e) => setAstrologerForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAstrologerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAstrologerSubmit} disabled={astrologerSubmitting || !astrologerForm.name.trim()} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
              {astrologerSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><UserCheck className="w-4 h-4 mr-1" /> {astrologerEditItem ? 'Update' : 'Create'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Access Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" /> Grant Access
            </DialogTitle>
            <DialogDescription>Give a device access to AI analyses</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Device ID *</Label>
              <Input value={grantDeviceId} onChange={e => setGrantDeviceId(e.target.value)} placeholder="Paste device UUID here..." className="mt-1 font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Full UUID from the user&apos;s browser localStorage</p>
            </div>

            <div>
              <Label className="text-sm font-medium">Grant Mode</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="grantMode" checked={grantMode === 'granular'} onChange={() => setGrantMode('granular')} className="accent-saffron" />
                  <span className="text-sm font-medium">Granular (per-type)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="grantMode" checked={grantMode === 'legacy'} onChange={() => setGrantMode('legacy')} className="accent-saffron" />
                  <span className="text-sm font-medium">Legacy (Premium/Unlimited)</span>
                </label>
              </div>
            </div>

            {grantMode === 'legacy' ? (
              <div>
                <Label className="text-sm font-medium">Access Level</Label>
                <Select value={grantAccessLevel} onValueChange={(v: 'premium' | 'unlimited') => setGrantAccessLevel(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">
                      <span className="flex items-center gap-2">
                        <Badge className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-[10px] px-1.5">PREMIUM</Badge>
                        Unlock premium analysis types
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
            ) : (
              <div>
                <Label className="text-sm font-medium">Quick Options</Label>
                <div className="flex gap-2 mt-1.5 mb-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setGrantAnalysisTypes(catalogItems.map(c => c.analysisType))} className="text-xs border-saffron/30 hover:bg-saffron/10">
                    <Star className="w-3 h-3 mr-1" /> Select All Premium
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setGrantAnalysisTypes([])} className="text-xs">
                    Clear All
                  </Button>
                </div>
                <Label className="text-sm font-medium">Select Analysis Types</Label>
                <div className="mt-1.5 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-saffron/5">
                  {catalogItems.length > 0 ? catalogItems.map((item) => (
                    <label key={item.analysisType} className="flex items-center gap-2 cursor-pointer hover:bg-saffron/10 rounded px-1 py-0.5">
                      <Checkbox
                        checked={grantAnalysisTypes.includes(item.analysisType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setGrantAnalysisTypes(prev => [...prev, item.analysisType])
                          } else {
                            setGrantAnalysisTypes(prev => prev.filter(t => t !== item.analysisType))
                          }
                        }}
                      />
                      <span className="text-sm">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{centsToDollar(item.priceCents)}</span>
                    </label>
                  )) : (
                    <p className="text-xs text-muted-foreground">No catalog items. Add items in the Catalog tab first.</p>
                  )}
                </div>
                {grantAnalysisTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {grantAnalysisTypes.map(type => (
                      <Badge key={type} variant="outline" className="text-xs border-saffron/30 bg-saffron/10">
                        {ANALYSIS_LABELS[type] || type}
                        <button onClick={() => setGrantAnalysisTypes(prev => prev.filter(t => t !== type))} className="ml-1 text-red-400 hover:text-red-600">&times;</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Reason (optional)</Label>
              <Input value={grantReason} onChange={e => setGrantReason(e.target.value)} placeholder="e.g. free_trial, early_adopter, promo, beta_tester" className="mt-1" />
            </div>

            <div>
              <Label className="text-sm font-medium">Expiration (optional)</Label>
              <Input type="datetime-local" value={grantExpiresAt} onChange={e => setGrantExpiresAt(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for permanent access (never expires)</p>
            </div>

            {grantMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${grantMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {grantMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                {grantMessage.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setGrantDialogOpen(false); setGrantMessage(null) }}>Cancel</Button>
            <Button onClick={handleGrantAccess} disabled={grantSubmitting || !grantDeviceId.trim()} className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white">
              {grantSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Granting...</> : <><Shield className="w-4 h-4 mr-1" /> Grant Access</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Create/Edit Dialog */}
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <Package className="w-5 h-5 text-saffron" /> {catalogEditItem ? 'Edit Catalog Item' : 'Add Catalog Item'}
            </DialogTitle>
            <DialogDescription>
              {catalogEditItem ? 'Update the pricing and details for this analysis type' : 'Add a new premium analysis type to the catalog'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Analysis Type (slug) *</Label>
              <Input
                value={catalogForm.analysisType}
                onChange={e => setCatalogForm(prev => ({ ...prev, analysisType: e.target.value }))}
                placeholder="e.g. swot_5year, cosmic_blueprint"
                className="mt-1 font-mono text-sm"
                disabled={!!catalogEditItem}
              />
              <p className="text-xs text-muted-foreground mt-1">Unique identifier — cannot be changed after creation</p>
            </div>

            <div>
              <Label className="text-sm font-medium">Display Name *</Label>
              <Input
                value={catalogForm.name}
                onChange={e => setCatalogForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. 5-Year SWOT Analysis"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={catalogForm.description}
                onChange={e => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What this analysis includes..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Price (USD) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={catalogForm.priceDollars}
                  onChange={e => setCatalogForm(prev => ({ ...prev, priceDollars: e.target.value }))}
                  placeholder="4.99"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Stored as {catalogForm.priceDollars ? centsToDollar(dollarToCents(catalogForm.priceDollars)) : '$0.00'} ({dollarToCents(catalogForm.priceDollars || '0')} cents)</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Original Price (USD)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={catalogForm.originalPriceDollars}
                  onChange={e => setCatalogForm(prev => ({ ...prev, originalPriceDollars: e.target.value }))}
                  placeholder="9.99"
                  className="mt-1"
                />
                {catalogForm.originalPriceDollars && catalogForm.priceDollars && (
                  <p className="text-xs text-emerald-600 mt-1">
                    {savingsPercent(dollarToCents(catalogForm.priceDollars), dollarToCents(catalogForm.originalPriceDollars))}% savings
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Sort Order</Label>
                <Input
                  type="number" min="0"
                  value={catalogForm.sortOrder}
                  onChange={e => setCatalogForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch
                  checked={catalogForm.isActive}
                  onCheckedChange={(checked) => setCatalogForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label className="text-sm font-medium">{catalogForm.isActive ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>

            {/* Lemon Squeezy variant ID — for per-analysis one-time purchases.
                Leave blank to disable "Buy this analysis" for this type. */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                Lemon Squeezy Variant ID
                <span className="text-xs font-normal text-muted-foreground">(optional — enables per-analysis purchase)</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g. 12345 (from your LS product variant URL)"
                value={catalogForm.lsVariantId}
                onChange={e => setCatalogForm(prev => ({ ...prev, lsVariantId: e.target.value.trim() }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                When set, the front-end shows a <strong>"Buy this analysis"</strong> button (one-time purchase).
                The webhook automatically grants this analysisType to the buyer's device.
                Create the variant in <a href="https://app.lemonsqueezy.com/products" target="_blank" rel="noopener noreferrer" className="underline text-purple-600">LS Dashboard → Products</a> as a one-time payment variant.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCatalogSubmit} disabled={catalogSubmitting || !catalogForm.analysisType.trim() || !catalogForm.name.trim()} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
              {catalogSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><Package className="w-4 h-4 mr-1" /> {catalogEditItem ? 'Update' : 'Create'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bundle Create/Edit Dialog */}
      <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <Gift className="w-5 h-5 text-saffron" /> {bundleEditItem ? 'Edit Bundle' : 'Create Bundle'}
            </DialogTitle>
            <DialogDescription>
              {bundleEditItem ? 'Update this product bundle' : 'Group analysis types into a discounted bundle'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Slug *</Label>
                <Input
                  value={bundleForm.slug}
                  onChange={e => setBundleForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g. career-combo"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Display Name *</Label>
                <Input
                  value={bundleForm.name}
                  onChange={e => setBundleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Career Bundle"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={bundleForm.description}
                onChange={e => setBundleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What this bundle includes..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Price (USD) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={bundleForm.priceDollars}
                  onChange={e => setBundleForm(prev => ({ ...prev, priceDollars: e.target.value }))}
                  placeholder="12.99"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Original Price (USD)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={bundleForm.originalPriceDollars}
                  onChange={e => setBundleForm(prev => ({ ...prev, originalPriceDollars: e.target.value }))}
                  placeholder="24.99"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Included Analysis Types</Label>
              <div className="mt-1.5 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-saffron/5">
                {catalogItems.length > 0 ? catalogItems.map((item) => (
                  <label key={item.analysisType} className="flex items-center gap-2 cursor-pointer hover:bg-saffron/10 rounded px-1 py-0.5">
                    <Checkbox
                      checked={bundleForm.items.includes(item.analysisType)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setBundleForm(prev => ({ ...prev, items: [...prev.items, item.analysisType] }))
                        } else {
                          setBundleForm(prev => ({ ...prev, items: prev.items.filter(t => t !== item.analysisType) }))
                        }
                      }}
                    />
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{centsToDollar(item.priceCents)}</span>
                  </label>
                )) : (
                  <p className="text-xs text-muted-foreground">No catalog items. Add items in the Catalog tab first.</p>
                )}
              </div>
              {bundleForm.items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {bundleForm.items.map(type => (
                    <Badge key={type} variant="outline" className="text-xs border-saffron/30 bg-saffron/10">
                      {ANALYSIS_LABELS[type] || type}
                    </Badge>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 self-center">
                    Total individual: {centsToDollar(bundleForm.items.reduce((sum, type) => {
                      const item = catalogItems.find(c => c.analysisType === type)
                      return sum + (item?.priceCents || 0)
                    }, 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Sort Order</Label>
                <Input
                  type="number" min="0"
                  value={bundleForm.sortOrder}
                  onChange={e => setBundleForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch
                  checked={bundleForm.isActive}
                  onCheckedChange={(checked) => setBundleForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label className="text-sm font-medium">{bundleForm.isActive ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBundleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBundleSubmit} disabled={bundleSubmitting || !bundleForm.slug.trim() || !bundleForm.name.trim()} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
              {bundleSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><Gift className="w-4 h-4 mr-1" /> {bundleEditItem ? 'Update' : 'Create'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promo Create/Edit Dialog */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-maroon flex items-center gap-2">
              <Tag className="w-5 h-5 text-saffron" /> {promoEditItem ? 'Edit Promo Code' : 'Create Promo Code'}
            </DialogTitle>
            <DialogDescription>
              {promoEditItem ? 'Update this promotional code' : 'Create a new discount or free access code'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Code *</Label>
                <Input
                  value={promoForm.code}
                  onChange={e => setPromoForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. LAUNCH50"
                  className="mt-1 font-mono text-sm uppercase"
                  disabled={!!promoEditItem}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Input
                  value={promoForm.description}
                  onChange={e => setPromoForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Launch discount"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <Select value={promoForm.type} onValueChange={v => setPromoForm(prev => ({ ...prev, type: v, value: v === 'percent_off' ? 50 : v === 'free_access' ? 7 : 200 }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent_off">Percentage Off</SelectItem>
                    <SelectItem value="fixed_off">Fixed Amount Off</SelectItem>
                    <SelectItem value="free_access">Free Access Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">
                  {promoForm.type === 'percent_off' ? 'Discount %' : promoForm.type === 'fixed_off' ? 'Amount Off (USD)' : 'Free Days'}
                </Label>
                <Input
                  type="number" min="0"
                  step={promoForm.type === 'percent_off' ? '1' : '0.01'}
                  value={promoForm.value}
                  onChange={e => setPromoForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {promoForm.type === 'percent_off' ? `e.g. 50 = 50% off`
                    : promoForm.type === 'fixed_off' ? `e.g. 2 = $2.00 off`
                    : `e.g. 7 = 7 days free access`}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Applicable To</Label>
              <Select value={promoForm.applicableType} onValueChange={v => setPromoForm(prev => ({ ...prev, applicableType: v, applicableItems: [] }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="specific">Specific Items</SelectItem>
                  <SelectItem value="bundle">Bundles Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {promoForm.applicableType === 'specific' && (
              <div>
                <Label className="text-sm font-medium">Select Applicable Items</Label>
                <div className="mt-1.5 space-y-2 max-h-36 overflow-y-auto border rounded-lg p-3 bg-saffron/5">
                  {catalogItems.map((item) => (
                    <label key={item.analysisType} className="flex items-center gap-2 cursor-pointer hover:bg-saffron/10 rounded px-1 py-0.5">
                      <Checkbox
                        checked={promoForm.applicableItems.includes(item.analysisType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPromoForm(prev => ({ ...prev, applicableItems: [...prev.applicableItems, item.analysisType] }))
                          } else {
                            setPromoForm(prev => ({ ...prev, applicableItems: prev.applicableItems.filter(t => t !== item.analysisType) }))
                          }
                        }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Max Uses</Label>
                <Input
                  type="number" min="0"
                  value={promoForm.maxUses}
                  onChange={e => setPromoForm(prev => ({ ...prev, maxUses: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch
                  checked={promoForm.isActive}
                  onCheckedChange={(checked) => setPromoForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label className="text-sm font-medium">{promoForm.isActive ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Valid From</Label>
                <Input
                  type="datetime-local"
                  value={promoForm.validFrom}
                  onChange={e => setPromoForm(prev => ({ ...prev, validFrom: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Valid Until</Label>
                <Input
                  type="datetime-local"
                  value={promoForm.validUntil}
                  onChange={e => setPromoForm(prev => ({ ...prev, validUntil: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePromoSubmit} disabled={promoSubmitting || !promoForm.code.trim()} className="bg-gradient-to-r from-saffron to-gold text-white hover:from-saffron-light hover:to-gold-light">
              {promoSubmitting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><Tag className="w-4 h-4 mr-1" /> {promoEditItem ? 'Update' : 'Create'}</>}
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
