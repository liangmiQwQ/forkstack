import { icons } from '@iconify-json/octicon/icons.json'

import type { PullRequest } from './discovery.ts'
import type { StackNotice } from './stack-notice.ts'

export type Theme = 'light' | 'dark'

interface Palette {
  text: string
  muted: string
  selected: string
  green: string
  purple: string
  red: string
  amber: string
}

// The same Tailwind shades the dashboard uses, so a PR's status reads the same in both places.
const PALETTES: Record<Theme, Palette> = {
  light: {
    text: '#171717',
    muted: '#737373',
    selected: '#f5f5f5',
    green: '#16a34a',
    purple: '#9333ea',
    red: '#dc2626',
    amber: '#d97706'
  },
  dark: {
    text: '#f5f5f5',
    muted: '#a3a3a3',
    selected: '#262626',
    green: '#22c55e',
    purple: '#c084fc',
    red: '#f87171',
    amber: '#fbbf24'
  }
}

const WIDTH = 640
const ROW_HEIGHT = 32
// An image can't measure text, so long titles are cut at a length that fits beside the status in most fonts.
const TITLE_LENGTH = 52

const SANS = "'Instrument Sans', system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, monospace"

// Draws one row per PR, bottom of the stack first, with the PR the comment belongs to highlighted, and the notice below them.
export function renderStatusImage(
  prs: PullRequest[],
  current: number | null,
  notice: StackNotice | null,
  theme: Theme
): string {
  const palette = PALETTES[theme]
  const height = (prs.length + (notice ? 1 : 0)) * ROW_HEIGHT
  const rows = prs.map((pr, i) => renderRow(pr, i * ROW_HEIGHT, pr.number === current, palette))

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    ...rows,
    notice ? renderNotice(notice, prs.length * ROW_HEIGHT, palette) : '',
    '</svg>'
  ].join('\n')
}

function renderRow(pr: PullRequest, y: number, selected: boolean, palette: Palette) {
  const [stateIcon, stateColor] = prState(pr, palette)
  const [label, labelColor] = statusLabel(pr, palette)
  const checks = checksIcon(pr.checks, palette)
  const textY = y + ROW_HEIGHT / 2 + 4.5
  const labelX = WIDTH - 12

  return [
    selected
      ? `<rect x="0" y="${y + 2}" width="${WIDTH}" height="${ROW_HEIGHT - 4}" rx="6" fill="${palette.selected}"/>`
      : '',
    renderIcon(stateIcon, 12, y + 8, stateColor),
    `<text x="36" y="${textY}" font-family="${MONO}" font-size="13" fill="${palette.muted}">#${pr.number}</text>`,
    `<text x="96" y="${textY}" font-family="${SANS}" font-size="14" fill="${palette.text}" font-weight="${selected ? 600 : 400}">${escapeXml(truncate(pr.title))}</text>`,
    `<text x="${labelX}" y="${textY}" text-anchor="end" font-family="${SANS}" font-size="13" fill="${labelColor}">${label}</text>`,
    // The label's width is unknown, so the checks icon sits in a fixed column left of the widest label.
    checks ? renderIcon(checks[0], labelX - 140, y + 8, checks[1]) : ''
  ].join('\n')
}

function renderNotice(notice: StackNotice, y: number, palette: Palette) {
  const [icon, color] =
    notice.kind === 'running' ? ['sync-16', palette.muted] : ['alert-16', palette.amber]

  return [
    renderIcon(icon, 12, y + 8, color),
    `<text x="36" y="${y + ROW_HEIGHT / 2 + 4.5}" font-family="${SANS}" font-size="13" fill="${color}">${escapeXml(notice.text)}</text>`
  ].join('\n')
}

// Icons follow GitHub, matching `PrStateIcon` on the dashboard.
function prState(pr: PullRequest, palette: Palette): [icon: string, color: string] {
  if (pr.state === 'MERGED') {
    return ['git-merge-16', palette.purple]
  }
  if (pr.state === 'CLOSED') {
    return ['git-pull-request-closed-16', palette.red]
  }
  if (pr.isDraft) {
    return ['git-pull-request-draft-16', palette.muted]
  }
  return ['git-pull-request-16', palette.green]
}

function statusLabel(pr: PullRequest, palette: Palette): [label: string, color: string] {
  if (pr.state === 'MERGED') {
    return ['Merged', palette.purple]
  }
  if (pr.state === 'CLOSED') {
    return ['Closed', palette.red]
  }
  // A draft is not ready for review, so GitHub's review decision does not apply yet.
  if (pr.isDraft) {
    return ['Draft', palette.muted]
  }

  switch (pr.reviewDecision) {
    case 'APPROVED': {
      return ['Approved', palette.green]
    }
    case 'CHANGES_REQUESTED': {
      return ['Changes requested', palette.red]
    }
    case 'REVIEW_REQUIRED': {
      return ['Review required', palette.muted]
    }
    default: {
      return ['Open', palette.muted]
    }
  }
}

function checksIcon(
  checks: PullRequest['checks'],
  palette: Palette
): [icon: string, color: string] | null {
  switch (checks) {
    case 'passing': {
      return ['check-16', palette.green]
    }
    case 'failing': {
      return ['x-16', palette.red]
    }
    case 'running': {
      return ['dot-fill-16', palette.amber]
    }
    default: {
      return null
    }
  }
}

// Octicon bodies paint with `currentColor`, so the nested SVG's `color` sets the icon's color.
function renderIcon(name: string, x: number, y: number, color: string) {
  const body = icons[name as keyof typeof icons].body
  return `<svg x="${x}" y="${y}" width="16" height="16" viewBox="0 0 16 16" color="${color}">${body}</svg>`
}

function truncate(title: string) {
  return title.length > TITLE_LENGTH ? `${title.slice(0, TITLE_LENGTH - 1)}…` : title
}

function escapeXml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
