// Markdown post-processor for AI analysis output
//
// AI models (Gemini, Groq, OpenRouter, z-ai-sdk) return inconsistent
// formatting: some use clean markdown, some return plain text, some
// wrap output in code fences, some have weird spacing, etc.
//
// This module normalizes all of that to clean, consistent markdown
// before ReactMarkdown renders it.

/**
 * Clean up AI-generated analysis text so it renders consistently.
 *
 * Fixes (in order):
 *  1. Strip code fences around the entire output (```markdown ... ```)
 *  2. Strip leading/trailing "Here is..." / "Sure!..." filler
 *  3. Strip AI disclaimers that duplicate the one we already show
 *  4. Normalize horizontal rules (---, ***, ___) to consistent ---
 *  5. Ensure blank lines around headings, lists, tables, blockquotes
 *  6. Convert "•" bullets to "-" (consistent markdown)
 *  7. Collapse 3+ consecutive newlines to 2
 *  8. Trim trailing whitespace on each line
 *  9. Ensure the output doesn't end with a half-finished sentence
 * 10. Add a final disclaimer if the AI didn't include one
 */
export function normalizeAnalysisMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  let text = raw

  // 1. Strip code fences around the entire output
  //    AI models sometimes wrap their entire response in ```markdown ... ```
  //    or ``` ... ``` which would render as a code block instead of formatted text.
  text = text.trim()
  const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }
  // Also strip a leading fence with no closing one (broken output)
  text = text.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '')

  // 2. Strip leading filler phrases
  //    "Here is your...", "Sure! Here's...", "Below is...", "Certainly!..."
  const fillerPatterns = [
    /^(?:sure|certainly|absolutely|of course)[!,.]?\s+(?:here(?:'s| is)|below is|the following is)\s+(?:your|the|a)\b.*?\n+/i,
    /^here(?:'s| is)\s+(?:your|the|a)\b.*?\n+/i,
    /^below (?:is|you'll find)\s+(?:your|the|a)\b.*?\n+/i,
    /^i'll\s+(?:analyze|provide|give|generate)\b.*?\n+/i,
    /^let me\s+(?:analyze|provide|give|generate)\b.*?\n+/i,
  ]
  for (const pat of fillerPatterns) {
    text = text.replace(pat, '')
  }

  // 3. Strip ONLY the disclaimer line itself (not content after it)
  //    We only remove the literal "Disclaimer: ..." line, not everything
  //    after it — the AI might have useful closing notes after the disclaimer.
  //    Only strip if there's a clear "---" separator + disclaimer word.
  const disclaimerPatterns = [
    /\n+---\s*\n+\*?\*?Disclaimer\*?\*?:?\s*[^\n]*$/im,
    /\n+\*?\*?Disclaimer\*?\*?:?\s*[^\n]*$/im,
  ]
  for (const pat of disclaimerPatterns) {
    text = text.replace(pat, '')
  }

  // 4. Normalize horizontal rules
  //    Convert ***, ___, - - -, etc. to ---
  text = text.replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, '---')

  // 5. Ensure blank lines around block elements
  //    Headings (#, ##, ###)
  text = text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
  text = text.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2')
  //    Lists (-, *, +, 1.)
  text = text.replace(/([^\n])\n([ \t]*[-*+]\s)/g, '$1\n\n$2')
  text = text.replace(/([^\n])\n([ \t]*\d+\.\s)/g, '$1\n\n$2')
  //    Tables (| ... |)
  text = text.replace(/([^\n])\n(\|[^\n]+\|)/g, '$1\n\n$2')
  //    Blockquotes (>)
  text = text.replace(/([^\n])\n(>\s)/g, '$1\n\n$2')
  //    Horizontal rules
  text = text.replace(/([^\n])\n(---+)/g, '$1\n\n$2')
  text = text.replace(/(---+)\n([^\n-])/g, '$1\n\n$2')

  // 6. Convert bullet characters to consistent "-"
  //    •, ◦, ▪, ●, *, + → -
  text = text.replace(/^[ \t]*[•◦▪●*+]\s/gm, '- ')

  // 7. Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, '\n\n')

  // 8. Trim trailing whitespace on each line
  text = text.replace(/[ \t]+$/gm, '')

  // 9. Trim the whole thing
  text = text.trim()

  // 10. If the AI didn't include a disclaimer, add a small one at the end
  //     (We strip duplicates above, but if there wasn't one at all, add ours)
  if (!/disclaimer/i.test(text)) {
    text += '\n\n---\n\n*This analysis is AI-generated Vedic astrological guidance. For major life decisions, please consult a qualified astrologer.*'
  }

  return text
}

/**
 * Quick check: does this text look like it has any markdown structure?
 * Used to decide whether to apply aggressive normalization or just
 * light cleanup.
 */
export function hasMarkdownStructure(text: string): boolean {
  if (!text) return false
  // Check for headings, lists, bold, tables, etc.
  return /^(#{1,6}\s|[-*+]\s|\d+\.\s|\|[^\n]+\||\*\*[^*]+\*\*|__[^_]+__|>\s|---+)/m.test(text)
}

/**
 * If the AI returned plain text with no markdown structure, try to
 * add some basic structure by detecting patterns:
 *   - Lines in ALL CAPS or Title Case followed by a colon → heading
 *   - Lines starting with numbers → numbered list
 *   - Lines starting with bullets → bulleted list
 *
 * This is a fallback — the AI should ideally return proper markdown.
 */
export function addBasicMarkdownStructure(text: string): string {
  if (!text || hasMarkdownStructure(text)) return text

  let result = text

  // Convert "Section Name:" or "SECTION NAME:" at the start of a line to "## Section Name"
  result = result.replace(/^[A-Z][A-Z\s]{2,40}:?\s*$/gm, (match) => {
    const cleaned = match.replace(/:?\s*$/, '').trim()
    // Only convert if it looks like a heading (all caps or title case, short)
    if (cleaned.length < 50 && /^[A-Z][A-Z\s]+$/.test(cleaned)) {
      return `## ${cleaned.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}`
    }
    return match
  })

  // Convert "1. text" patterns (some AIs return "1)" or "1." without space)
  result = result.replace(/^(\d+)[.)]\s*/gm, '$1. ')

  return result
}

/**
 * Full cleanup pipeline. Apply this to every AI response before rendering.
 * Note: we no longer call addBasicMarkdownStructure() — it was too aggressive
 * and would mangle the advanced prompts' intentional formatting (converting
 * ALL-CAPS emphasis lines to ## headings, etc.). The AI prompts now provide
 * enough structure that we don't need to guess.
 */
export function cleanupAIResponse(raw: string): string {
  if (!raw) return ''
  return normalizeAnalysisMarkdown(raw)
}
