/**
 * Type definitions for image handling system
 */

export type ImageHandlingStrategy = 'embed_base64' | 'text_marker' | 'separate_files'

export type ImageContentType =
    | 'image_asset_pointer'
    | 'image_url'
    | 'multimodal_text'

export interface ImageContext {
    conversationId: string
    messageId: string
    imageIndex: number
    mimeType: string
    originalUrl: string
    contentType: ImageContentType
    author?: {
        role: string
        name?: string
    }
    timestamp?: number
}

export interface ProcessedImage {
    id: string
    content: string // For embed: base64 data URI, For marker: text, For separate: relative path
    originalData?: string // Base64 data
    metadata?: ImageMetadata
    fileName?: string // For Option 3
}

export interface ImageMetadata {
    originalUrl: string
    mimeType: string
    width?: number
    height?: number
    fileSize?: number
    timestamp?: number
    messageContext?: {
        author: string
        role: string
    }
}

export interface ExportFile {
    path: string // Relative path in ZIP
    data: Blob | string
    mimeType?: string
}

export interface ExportMetadata {
    version: string
    exportDate: string
    conversationTitle: string
    imageHandlingStrategy: ImageHandlingStrategy
    totalImages: number
    images: Array<{
        id: string
        originalUrl: string
        fileName: string
        mimeType: string
        size: number
        messageContext: {
            messageId: string
            author: string
            role: string
            timestamp?: number
        }
    }>
    settings: {
        imageQuality?: number
        maxImageSize?: number
        includeImageMetadata?: boolean
        customMarkerText?: string
    }
}

export interface ImageProcessor {
    processImage(
        imageUrl: string,
        context: ImageContext
    ): Promise<ProcessedImage>

    generateContent(
        processedImages: ProcessedImage[],
        originalContent: string,
        format: 'markdown' | 'html' | 'json'
    ): string | { content: string; files: ExportFile[] }

    getStrategyName(): ImageHandlingStrategy
}

export interface ImageHandler {
    getProcessor(): ImageProcessor
    setStrategy(strategy: ImageHandlingStrategy): void
    getStrategy(): ImageHandlingStrategy
    processConversationImages(
        images: Array<{
            url: string
            context: ImageContext
        }>,
        format: 'markdown' | 'html' | 'json'
    ): Promise<{
        content: string
        files?: ExportFile[]
        metadata?: ExportMetadata
    }>
}

// Legacy image data from existing conversation format
export interface LegacyImageData {
    image_url?: string
    asset_pointer?: string
    height?: number
    width?: number
    message_type?: string
    content_type?: string
}
