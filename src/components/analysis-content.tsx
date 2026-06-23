'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cleanupAIResponse } from '@/lib/markdown-utils'

interface AnalysisContentProps {
  children: string
  /** Visual theme — matches the analysis type's color scheme */
  variant?: 'default' | 'cosmic' | 'shadow' | 'swot'
  /** Size of text — 'sm' for inline panels, 'xs' for chat messages */
  size?: 'sm' | 'xs'
  className?: string
}

/**
 * Renders AI-generated analysis text as properly formatted markdown.
 *
 * - Cleans up common AI output issues (code fences, missing blank lines,
 *   inconsistent bullets, duplicate disclaimers)
 * - Uses remark-gfm for GitHub-flavored markdown (tables, strikethrough,
 *   task lists, autolinked URLs)
 * - Custom renderers for headings, lists, tables, etc. so they look
 *   consistent regardless of which AI provider generated the text
 *
 * Use this everywhere we render AI analysis output:
 *   <AnalysisContent>{analysis}</AnalysisContent>
 */
export function AnalysisContent({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: AnalysisContentProps) {
  // Clean up the AI output before rendering
  const cleaned = cleanupAIResponse(children)

  // Theme classes
  const themeClasses =
    variant === 'cosmic'
      ? 'prose-invert prose-headings:text-indigo-200 prose-headings:font-semibold prose-p:text-indigo-100/90 prose-p:leading-relaxed prose-li:text-indigo-100/90 prose-strong:text-amber-300 prose-h2:text-lg prose-h2:border-b prose-h2:border-indigo-700/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-indigo-300 prose-a:text-amber-300'
      : variant === 'shadow'
      ? 'prose-invert prose-headings:text-red-300 prose-headings:font-semibold prose-p:text-red-100/90 prose-p:leading-relaxed prose-li:text-red-100/90 prose-strong:text-amber-400 prose-h2:text-lg prose-h2:border-b prose-h2:border-red-800/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-red-400 prose-a:text-amber-400'
      : variant === 'swot'
      ? 'prose-invert prose-headings:text-blue-200 prose-headings:font-semibold prose-p:text-blue-100/90 prose-p:leading-relaxed prose-li:text-blue-100/90 prose-strong:text-amber-300 prose-h2:text-lg prose-h2:border-b prose-h2:border-blue-700/30 prose-h2:pb-2 prose-h3:text-base prose-h3:text-blue-300 prose-a:text-amber-300'
      : 'prose-headings:text-maroon prose-headings:font-semibold prose-p:text-foreground prose-p:leading-relaxed prose-li:text-foreground prose-strong:text-maroon prose-h2:text-lg prose-h2:border-b prose-h2:border-saffron/20 prose-h2:pb-2 prose-h3:text-base'

  const sizeClass = size === 'xs' ? 'prose-xs' : 'prose-sm'

  return (
    <div className={`prose ${sizeClass} max-w-none ${themeClasses} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings — ensure consistent spacing
          h1: ({ node, ...props }) => <h2 className="text-xl mt-6 mb-3" {...props} />,
          h2: ({ node, ...props }) => <h2 {...props} />,
          h3: ({ node, ...props }) => <h3 {...props} />,
          h4: ({ node, ...props }) => <h4 {...props} />,
          // Lists — proper bullet styling
          ul: ({ node, ...props }) => <ul className="list-disc pl-6 my-2 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-6 my-2 space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          // Paragraphs — proper spacing
          p: ({ node, ...props }) => <p className="my-2 leading-relaxed" {...props} />,
          // Strong/bold — already styled via .prose strong, but add explicit class
          strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
          // Emphasis
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          // Horizontal rule — styled via CSS
          hr: ({ node, ...props }) => <hr className="my-4 border-saffron/20" {...props} />,
          // Blockquote
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-saffron/40 pl-4 my-3 italic opacity-85" {...props} />
          ),
          // Tables — responsive scroll wrapper
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full text-sm border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-saffron/10" {...props} />,
          th: ({ node, ...props }) => (
            <th className="border border-saffron/20 px-3 py-2 text-left font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-saffron/15 px-3 py-2 align-top" {...props} />
          ),
          // Code — inline vs block
          code: ({ node, className, children, ...props }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code
                  className="bg-saffron/10 px-1.5 py-0.5 rounded text-[0.875em] font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return <code className={className} {...props}>{children}</code>
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-maroon-dark/5 p-3 rounded-md overflow-x-auto my-3" {...props} />
          ),
          // Links
          a: ({ node, ...props }) => (
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="text-saffron underline hover:text-saffron-light"
              {...props}
            />
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  )
}

export default AnalysisContent
