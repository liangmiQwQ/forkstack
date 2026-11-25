import { icons } from '@iconify-json/octicon/icons.json'

export type Theme = 'light' | 'dark'

interface Palette {
  text: string
  border: string
}

// The same Tailwind shades the dashboard uses, so the button reads like its `btn-outline`.
const PALETTES: Record<Theme, Palette> = {
  light: { text: '#171717', border: '#d4d4d4' },
  dark: { text: '#f5f5f5', border: '#404040' }
}

const HEIGHT = 32
const PADDING = 12
const ICON_SIZE = 16
const GAP = 8
// An image can't measure text, so the width allows a little more than the average width of a 14px character.
const CHAR_WIDTH = 7.5

const SANS = "'Instrument Sans', system-ui, sans-serif"

export function renderReviewButton(theme: Theme): string {
  return renderButton('Review diff', 'file-diff-16', PALETTES[theme])
}

export function renderStackButton(theme: Theme): string {
  return renderButton('View stack', 'stack-16', PALETTES[theme])
}

// Draws an outline button, like the dashboard's `btn-outline`.
function renderButton(label: string, icon: string, palette: Palette) {
  const textX = PADDING + ICON_SIZE + GAP
  const width = Math.ceil(textX + label.length * CHAR_WIDTH + PADDING)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${HEIGHT - 1}" rx="8" fill="none" stroke="${palette.border}"/>`,
    renderIcon(icon, PADDING, (HEIGHT - ICON_SIZE) / 2, palette.text),
    `<text x="${textX}" y="${HEIGHT / 2 + 5}" font-family="${SANS}" font-size="14" font-weight="500" fill="${palette.text}">${escapeXml(label)}</text>`,
    '</svg>'
  ].join('\n')
}

// Octicon bodies paint with `currentColor`, so the nested SVG's `color` sets the icon's color.
function renderIcon(name: string, x: number, y: number, color: string) {
  const body = icons[name as keyof typeof icons].body
  return `<svg x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 16 16" color="${color}">${body}</svg>`
}

function escapeXml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
