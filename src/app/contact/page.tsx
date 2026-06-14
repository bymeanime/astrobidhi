'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Mail, MessageCircle, Facebook, Instagram, Twitter,
  Send, Loader2, CheckCircle, MapPin, Youtube
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

const WHATSAPP_NUMBER = '9779709735537'

const socialLinks = [
  { icon: <MessageCircle className="w-5 h-5" />, label: 'WhatsApp', href: `https://wa.me/${WHATSAPP_NUMBER}`, color: 'hover:text-[#25D366]', detail: '+977 9709735537' },
  { icon: <Facebook className="w-5 h-5" />, label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61590513489073', color: 'hover:text-[#1877F2]', detail: 'AstroBidhi' },
  { icon: <Instagram className="w-5 h-5" />, label: 'Instagram', href: 'https://instagram.com/astrobidhi', color: 'hover:text-[#E4405F]', detail: '@astrobidhi' },
  { icon: <Send className="w-5 h-5" />, label: 'Telegram', href: 'https://t.me/astrobidhi', color: 'hover:text-[#0088CC]', detail: '@astrobidhi' },
  { icon: <Twitter className="w-5 h-5" />, label: 'Twitter / X', href: 'https://twitter.com/astrobidhi', color: 'hover:text-[#1DA1F2]', detail: '@astrobidhi' },
  { icon: <Youtube className="w-5 h-5" />, label: 'YouTube', href: 'https://www.youtube.com/@astrobidhi', color: 'hover:text-[#FF0000]', detail: '@astrobidhi' },
  { icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.79a8.18 8.18 0 004.76 1.52V6.86a4.84 4.84 0 01-1-.17z"/></svg>, label: 'TikTok', href: 'https://www.tiktok.com/@astrobidhi', color: 'hover:text-white', detail: '@astrobidhi' },
  { icon: <Mail className="w-5 h-5" />, label: 'Email', href: 'mailto:astrobidhi@gmail.com', color: 'hover:text-gold-light', detail: 'astrobidhi@gmail.com' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSent(true)
        setForm({ name: '', email: '', message: '' })
        toast({ title: 'Message sent!', description: 'We will get back to you soon.' })
      } else {
        toast({ title: 'Failed to send', description: 'Please try again or contact us via WhatsApp.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', description: 'Please check your connection and try again.', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-temple-bg">
      {/* Nav */}
      <nav className="bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="text-2xl text-gold animate-pulse-glow">ॐ</div>
              <div>
                <h1 className="text-xl font-bold text-gold-light tracking-wide">AstroBidhi</h1>
                <p className="text-[10px] text-saffron-light -mt-1 tracking-widest">वैदिक ज्योतिष</p>
              </div>
            </div>
            <a href="/">
              <Button variant="ghost" size="sm" className="text-saffron-light hover:text-gold-light">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to App
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-maroon-dark via-maroon to-saffron/10">
          <div className="relative max-w-4xl mx-auto px-4 py-12 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Mail className="w-12 h-12 text-gold mx-auto mb-4" />
              <h1 className="text-3xl md:text-5xl font-bold text-gold-light mb-4">Contact Us</h1>
              <div className="vedic-divider max-w-xs mx-auto my-4" />
              <p className="text-saffron-light/80 text-lg">We&apos;d love to hear from you. Reach out through any channel below.</p>
            </motion.div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              {/* Social Links */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon text-lg">Connect With Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {socialLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.href}
                        target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                        rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                        className={`flex items-center gap-3 p-3 rounded-lg bg-saffron/5 hover:bg-saffron/10 text-maroon transition-all ${link.color}`}
                      >
                        {link.icon}
                        <div>
                          <p className="font-semibold text-sm">{link.label}</p>
                          <p className="text-xs text-muted-foreground">{link.detail}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="border-saffron/20">
                <CardHeader>
                  <CardTitle className="text-maroon text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a href="/about" className="flex items-center gap-2 text-sm text-maroon hover:text-saffron transition-colors">
                    <MapPin className="w-4 h-4" /> About AstroBidhi
                  </a>
                  <a href="/policy" className="flex items-center gap-2 text-sm text-maroon hover:text-saffron transition-colors">
                    <Mail className="w-4 h-4" /> Privacy Policy
                  </a>
                  <a href="/refund" className="flex items-center gap-2 text-sm text-maroon hover:text-saffron transition-colors">
                    <Send className="w-4 h-4" /> Refund Policy
                  </a>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="border-saffron/20">
              <CardHeader>
                <CardTitle className="text-maroon text-lg">Send Us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                {sent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-maroon mb-2">Message Sent!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                    </p>
                    <Button
                      onClick={() => setSent(false)}
                      variant="outline"
                      className="border-saffron text-maroon hover:bg-saffron/10"
                    >
                      Send Another Message
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-maroon text-sm font-medium">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your full name"
                        className="mt-1 border-saffron/30 focus:border-saffron"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-maroon text-sm font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="your@email.com"
                        className="mt-1 border-saffron/30 focus:border-saffron"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="message" className="text-maroon text-sm font-medium">Message</Label>
                      <Textarea
                        id="message"
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="How can we help you?"
                        rows={5}
                        className="mt-1 border-saffron/30 focus:border-saffron"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={sending}
                      className="w-full bg-gradient-to-r from-saffron to-gold hover:from-saffron-light hover:to-gold-light text-maroon-dark font-semibold"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" /> Send Message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark text-saffron-light/60 pb-24">
        <div className="vedic-divider" />
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg text-gold animate-pulse-glow">ॐ</span>
              <span className="text-gold-light font-semibold text-xs">AstroBidhi</span>
              <span className="text-[10px] text-saffron-light/40">वैदिक ज्योतिष</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px]">
              <a href="/about" className="text-saffron-light/50 hover:text-gold-light transition-colors">About</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/contact" className="text-saffron-light/50 hover:text-gold-light transition-colors">Contact</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/policy" className="text-saffron-light/50 hover:text-gold-light transition-colors">Privacy Policy</a>
              <span className="text-saffron-light/20">&bull;</span>
              <a href="/refund" className="text-saffron-light/50 hover:text-gold-light transition-colors">Refund Policy</a>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-[9px] text-saffron-light/30">Powered by VedicAstro (Swiss Ephemeris) &bull; KP System &bull; Gemini AI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
