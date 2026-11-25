import { icons } from '@iconify-json/octicon/icons.json'

import type { StackNotice } from './stack-notice.ts'

export type Theme = 'light' | 'dark'

interface Palette {
  text: string
  muted: string
  border: string
  amber: string
}

// The same Tailwind shades the dashboard uses, so the button reads like its `btn-outline`.
const PALETTES: Record<Theme, Palette> = {
  light: { text: '#171717', muted: '#737373', border: '#d4d4d4', amber: '#d97706' },
  dark: { text: '#f5f5f5', muted: '#a3a3a3', border: '#404040', amber: '#fbbf24' }
}

const HEIGHT = 32
const PADDING = 12
const ICON_SIZE = 16
const GAP = 8
// An image can't measure text, so the width allows a little more than the average width of a 14px character.
const CHAR_WIDTH = 7.5

const SANS = "'Instrument Sans', system-ui, sans-serif"

// Draws an outline button whose label and icon follow the stack's state.
export function renderRestackButton(notice: StackNotice, theme: Theme): string {
  const palette = PALETTES[theme]
  const [icon, color] = noticeStyle(notice, palette)
  const textX = PADDING + ICON_SIZE + GAP
  const width = Math.ceil(textX + notice.label.length * CHAR_WIDTH + PADDING)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${HEIGHT - 1}" rx="8" fill="none" stroke="${palette.border}"/>`,
    renderIcon(icon, PADDING, (HEIGHT - ICON_SIZE) / 2, color),
    `<text x="${textX}" y="${HEIGHT / 2 + 5}" font-family="${SANS}" font-size="14" font-weight="500" fill="${color}">${escapeXml(notice.label)}</text>`,
    '</svg>'
  ].join('\n')
}

function noticeStyle(notice: StackNotice, palette: Palette): [icon: string, color: string] {
  switch (notice.kind) {
    case 'idle': {
      return ['sync-16', palette.text]
    }
    case 'running': {
      return ['clock-16', palette.muted]
    }
    // `problem`, the only kind left.
    default: {
      return ['alert-16', palette.amber]
    }
  }
}

// Octicon bodies paint with `currentColor`, so the nested SVG's `color` sets the icon's color.
function renderIcon(name: string, x: number, y: number, color: string) {
  const body = icons[name as keyof typeof icons].body
  return `<svg x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 16 16" color="${color}">${body}</svg>`
}

function escapeXml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
