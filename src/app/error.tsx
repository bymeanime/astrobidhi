'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-temple-bg flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="text-6xl mb-4 text-temple-red">
          <AlertCircle className="w-16 h-16 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold text-maroon mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">
          AstroBidhi encountered an unexpected error. This might be a temporary issue.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-gradient-to-r from-saffron to-maroon hover:from-saffron-light hover:to-maroon text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="border-saffron text-maroon"
          >
            Go Home
          </Button>
        </div>
        {error.message && (
          <p className="text-xs text-muted-foreground mt-4 bg-saffron/5 p-2 rounded">
            Error: {error.message}
          </p>
        )}
      </div>
    </div>
  )
}
