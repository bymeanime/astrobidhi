'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Lock, Loader2, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        window.location.href = '/admin'
      } else {
        const data = await res.json()
        setError(data.detail || 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-maroon-dark to-maroon flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl text-gold animate-pulse-glow mb-3">ॐ</div>
          <h1 className="text-2xl font-bold text-gold-light tracking-wide">AstroBidhi Admin</h1>
          <p className="text-saffron-light/60 text-sm mt-1">Authentication Required</p>
        </div>

        <Card className="border-saffron/30 shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-saffron/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8 text-saffron" />
            </div>
            <CardTitle className="text-maroon text-xl">Admin Access</CardTitle>
            <CardDescription>Enter the admin password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="mt-1.5"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-temple-red text-sm bg-temple-red/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white font-semibold py-5"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authenticating...</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" /> Sign In</>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a href="/" className="text-sm text-saffron-light/60 hover:text-gold-light transition-colors">
                Back to AstroBidhi
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
