import type { ImageContext } from './image-types'

/**
 * Load an image from URL and return as HTMLImageElement
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

/**
 * Convert HTMLImageElement to base64 data URL
 */
export function getBase64FromImg(el: HTMLImageElement): string {
    const canvas = document.createElement('canvas')
    canvas.width = el.naturalWidth
    canvas.height = el.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(el, 0, 0)
    return canvas.toDataURL('image/png')
}

/**
 * Convert image URL to base64 data
 */
export async function getBase64FromImageUrl(url: string): Promise<string> {
    const img = await loadImage(url)
    return getBase64FromImg(img)
}

/**
 * Extract MIME type from data URL or guess from URL
 */
export function getMimeType(dataUrlOrUrl: string): string {
    if (dataUrlOrUrl.startsWith('data:')) {
        const match = dataUrlOrUrl.match(/data:([^;]+);/)
        return match ? match[1] : 'image/png'
    }

    // Guess from URL extension
    const extension = dataUrlOrUrl.split('.').pop()?.toLowerCase()
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg'
        case 'png':
            return 'image/png'
        case 'gif':
            return 'image/gif'
        case 'webp':
            return 'image/webp'
        case 'svg':
            return 'image/svg+xml'
        default:
            return 'image/png'
    }
}

/**
 * Generate unique image ID
 */
export function generateImageId(context: ImageContext): string {
    const timestamp = context.timestamp || Date.now()
    const hash = btoa(`${context.conversationId}-${context.messageId}-${context.imageIndex}-${timestamp}`)
    return hash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
}

/**
 * Generate file name for images in Option 3
 */
export function generateImageFileName(
    context: ImageContext,
    extension: string = 'png',
): string {
    const { author } = context
    let prefix = 'image'

    if (author) {
        switch (author.role) {
            case 'assistant':
                prefix = 'chatgpt-response'
                break
            case 'user':
                prefix = 'user-upload'
                break
            case 'tool':
                prefix = author.name ? `tool-${author.name.toLowerCase()}` : 'tool-result'
                break
            default:
                prefix = author.role
        }
    }

    const paddedIndex = context.imageIndex.toString().padStart(3, '0')
    return `${prefix}-${paddedIndex}.${extension}`
}

/**
 * Convert base64 data to Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64.split(',')[1])
    const byteNumbers = [...byteCharacters].map(char => char.charCodeAt(0))
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
}

/**
 * Get file size from base64 data
 */
export function getFileSizeFromBase64(base64: string): number {
    const base64Data = base64.split(',')[1]
    return Math.ceil((base64Data.length * 3) / 4)
}

/**
 * Sanitize file names for cross-platform compatibility
 */
export function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '-')
        .toLowerCase()
}

/**
 * Create relative path for images in ZIP exports
 */
export function createImageRelativePath(fileName: string): string {
    return `images/${fileName}`
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
    return new Date().toISOString()
}

/**
 * Validate image URL (basic validation)
 */
export function isValidImageUrl(url: string): boolean {
    try {
        // eslint-disable-next-line no-new
        new URL(url)
        return true
    }
    catch {
        return false
    }
}

/**
 * Extract image dimensions from context or try to get from loaded image
 */
export async function getImageDimensions(
    imageUrl: string,
    context?: ImageContext,
): Promise<{ width: number; height: number } | null> {
    // If we have dimensions in context, use them
    if (context && context.metadata?.width !== undefined && context.metadata?.height !== undefined) {
        return {
            width: context.metadata.width,
            height: context.metadata.height,
        }
    }

    // Try to load and measure the image
    try {
        const img = await loadImage(imageUrl)
        return {
            width: img.naturalWidth,
            height: img.naturalHeight,
        }
    }
    catch {
        return null
    }
}
