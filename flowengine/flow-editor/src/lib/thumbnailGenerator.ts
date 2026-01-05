/**
 * Thumbnail Generator
 * Generates thumbnails from React Flow canvas for flow previews
 */

import type { FlowModel, FlowNode } from '@/types/flow'
import { NODE_COLORS } from '@/types/flow'

/**
 * Thumbnail options
 */
export interface ThumbnailOptions {
  width?: number
  height?: number
  backgroundColor?: string
  padding?: number
  quality?: number
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  width: 320,
  height: 200,
  backgroundColor: '#1a1a2e',
  padding: 20,
  quality: 0.8,
}

/**
 * Calculate bounding box of nodes
 */
function calculateBounds(nodes: FlowNode[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const nodeWidth = 150
  const nodeHeight = 60

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + nodeWidth)
    maxY = Math.max(maxY, node.position.y + nodeHeight)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Generate SVG representation of the flow
 */
export function generateFlowSVG(flow: FlowModel, options: ThumbnailOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { nodes, edges } = flow

  if (nodes.length === 0) {
    return generateEmptySVG(opts)
  }

  const bounds = calculateBounds(nodes)
  const viewBoxPadding = 20

  // Calculate scale to fit
  const contentWidth = bounds.width + viewBoxPadding * 2
  const contentHeight = bounds.height + viewBoxPadding * 2
  const scaleX = (opts.width - opts.padding * 2) / contentWidth
  const scaleY = (opts.height - opts.padding * 2) / contentHeight
  const scale = Math.min(scaleX, scaleY, 1)

  const nodeWidth = 150 * scale
  const nodeHeight = 60 * scale

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">`

  // Background
  svg += `<rect width="100%" height="100%" fill="${opts.backgroundColor}"/>`

  // Add a subtle grid pattern
  svg += `<defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)"/>`

  // Center the content
  const offsetX = opts.padding + (opts.width - opts.padding * 2 - bounds.width * scale) / 2
  const offsetY = opts.padding + (opts.height - opts.padding * 2 - bounds.height * scale) / 2

  svg += `<g transform="translate(${offsetX}, ${offsetY})">`

  // Draw edges first (behind nodes)
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    if (sourceNode && targetNode) {
      const x1 = (sourceNode.position.x - bounds.minX + 75) * scale
      const y1 = (sourceNode.position.y - bounds.minY + 30) * scale
      const x2 = (targetNode.position.x - bounds.minX + 75) * scale
      const y2 = (targetNode.position.y - bounds.minY + 30) * scale

      // Draw a curved path
      const midY = (y1 + y2) / 2
      svg += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`
    }
  }

  // Draw nodes
  for (const node of nodes) {
    const x = (node.position.x - bounds.minX) * scale
    const y = (node.position.y - bounds.minY) * scale
    const color = NODE_COLORS[node.data.nodeType] || '#8b5cf6'

    // Node rectangle with rounded corners
    svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${color}" opacity="0.9"/>`

    // Node label (simplified)
    const label = node.data.label || node.data.nodeType
    const fontSize = Math.max(8, 10 * scale)
    svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + fontSize / 3}" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="rgba(0,0,0,0.8)" text-anchor="middle">${escapeXml(label.slice(0, 15))}</text>`
  }

  svg += '</g>'
  svg += '</svg>'

  return svg
}

/**
 * Generate empty flow SVG
 */
function generateEmptySVG(opts: Required<ThumbnailOptions>): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">
    <rect width="100%" height="100%" fill="${opts.backgroundColor}"/>
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="14" fill="rgba(255,255,255,0.3)" text-anchor="middle" dominant-baseline="middle">空流程</text>
  </svg>`
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Convert SVG to Data URL
 */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

/**
 * Convert SVG to PNG Data URL using Canvas
 */
export async function svgToPngDataUrl(
  svg: string,
  options: ThumbnailOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgDataUrl = svgToDataUrl(svg)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = opts.width
      canvas.height = opts.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, opts.width, opts.height)
      const pngDataUrl = canvas.toDataURL('image/png', opts.quality)
      resolve(pngDataUrl)
    }

    img.onerror = () => {
      reject(new Error('Failed to load SVG image'))
    }

    img.src = svgDataUrl
  })
}

/**
 * Generate thumbnail for a flow
 */
export async function generateThumbnail(
  flow: FlowModel,
  options: ThumbnailOptions = {}
): Promise<string> {
  const svg = generateFlowSVG(flow, options)
  return svgToPngDataUrl(svg, options)
}

/**
 * Generate thumbnail as SVG Data URL (faster, no canvas needed)
 */
export function generateThumbnailSVG(
  flow: FlowModel,
  options: ThumbnailOptions = {}
): string {
  const svg = generateFlowSVG(flow, options)
  return svgToDataUrl(svg)
}
