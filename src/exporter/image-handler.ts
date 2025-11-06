import { createImageProcessor, getAvailableStrategies } from './image-strategies'
import { base64ToBlob, getCurrentTimestamp, sanitizeFileName } from './image-utils'
import type {
    ExportFile,
    ExportMetadata,
    ImageContext,
    ImageHandler,
    ImageHandlingStrategy,
    ImageProcessor,
    LegacyImageData,
    ProcessedImage,
} from './image-types'

/**
 * Main image handler that coordinates different strategies
 */
export class DefaultImageHandler implements ImageHandler {
    private processor: ImageProcessor
    private currentStrategy: ImageHandlingStrategy

    constructor(initialStrategy?: ImageHandlingStrategy) {
        this.currentStrategy = initialStrategy || 'embed_base64'
        this.processor = createImageProcessor(this.currentStrategy)
    }

    getProcessor(): ImageProcessor {
        return this.processor
    }

    setStrategy(strategy: ImageHandlingStrategy): void {
        this.currentStrategy = strategy
        this.processor = createImageProcessor(strategy)
    }

    getStrategy(): ImageHandlingStrategy {
        return this.currentStrategy
    }

    /**
     * Process all images in a conversation and generate content with optional files
     */
    async processConversationImages(
        images: Array<{
            url: string
            context: ImageContext
        }>,
        format: 'markdown' | 'html' | 'json',
    ): Promise<{
        content: string
        files?: ExportFile[]
        metadata?: ExportMetadata
        processedImages: ProcessedImage[]
    }> {
        // Process all images with current strategy
        const processedImages = await Promise.all(
            images.map(async ({ url, context }) => {
                try {
                    return await this.processor.processImage(url, context)
                }
                catch (error) {
                    console.warn(`Failed to process image ${url}:`, error)
                    // Return error placeholder
                    return {
                        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        content: '[Image Processing Failed]',
                        metadata: {
                            originalUrl: url,
                            mimeType: 'image/png',
                            timestamp: context.timestamp,
                        },
                    }
                }
            }),
        )

        // Generate content based on strategy
        const result = await this.generateContentFromImages(processedImages, format)

        // Add metadata for Option 3
        if (this.currentStrategy === 'separate_files' && result.files && result.files.length > 0) {
            result.metadata = this.generateExportMetadata(processedImages)
        }

        return {
            ...result,
            processedImages,
        }
    }

    /**
     * Generate content string from processed images
     * This is a placeholder - actual content generation happens in export functions
     */
    private async generateContentFromImages(
        processedImages: ProcessedImage[],
        _format: 'markdown' | 'html' | 'json',
    ): Promise<{
        content: string
        files?: ExportFile[]
    }> {
        const content = '[CONTENT_PLACEHOLDER]' // This will be replaced by export functions
        const files: ExportFile[] = []

        // For Option 3, collect files
        if (this.currentStrategy === 'separate_files') {
            processedImages.forEach((image) => {
                if (image.originalData && image.fileName && image.metadata) {
                    const blob = base64ToBlob(image.originalData, image.metadata.mimeType)
                    files.push({
                        path: image.content, // This is the relative path
                        data: blob,
                        mimeType: image.metadata.mimeType,
                    })
                }
            })
        }

        return {
            content,
            files: files.length > 0 ? files : undefined,
        }
    }

    /**
     * Generate export metadata for Option 3
     */
    private generateExportMetadata(processedImages: ProcessedImage[]): ExportMetadata {
        const imageMetadata = processedImages
            .filter(img => img.metadata && img.fileName)
            .map(img => ({
                id: img.id,
                originalUrl: img.metadata!.originalUrl,
                fileName: img.fileName!,
                mimeType: img.metadata!.mimeType,
                size: img.metadata!.fileSize || 0,
                messageContext: img.metadata!.messageContext || {
                    messageId: '',
                    author: 'unknown',
                    role: 'unknown',
                },
            }))

        return {
            version: '1.0.0',
            exportDate: getCurrentTimestamp(),
            conversationTitle: '[CONVERSATION_TITLE]', // Will be filled by export function
            imageHandlingStrategy: this.currentStrategy,
            totalImages: processedImages.length,
            images: imageMetadata,
            settings: {
                // Will be filled with actual settings
                imageQuality: 85,
                maxImageSize: 2048,
                includeImageMetadata: true,
            },
        }
    }

    /**
     * Create image context from legacy conversation data
     */
    createImageContext(
        imageData: LegacyImageData,
        conversationId: string,
        messageId: string,
        imageIndex: number,
        author?: { role: string; name?: string },
        timestamp?: number,
    ): ImageContext {
        const url = imageData.image_url || imageData.asset_pointer || ''

        return {
            conversationId,
            messageId,
            imageIndex,
            mimeType: this.getMimeTypeFromImageData(imageData),
            originalUrl: url,
            contentType: imageData.content_type === 'multimodal_text' ? 'multimodal_text' : 'image_url',
            author,
            timestamp,
        }
    }

    /**
     * Extract MIME type from legacy image data
     */
    private getMimeTypeFromImageData(imageData: LegacyImageData): string {
        // Try to guess from URL or use default
        if (imageData.image_url) {
            const url = imageData.image_url
            const extension = url.split('.').pop()?.toLowerCase()
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
            }
        }

        return 'image/png' // Default fallback
    }

    /**
     * Replace image placeholders in content with actual processed image content
     */
    replaceImagePlaceholders(
        content: string,
        processedImages: ProcessedImage[],
        format: 'markdown' | 'html' | 'json',
    ): string {
        let result = content

        processedImages.forEach((image, index) => {
            const placeholder = `[IMAGE_${index}]`
            let replacement = ''

            switch (format) {
                case 'markdown':
                    if (this.currentStrategy === 'text_marker') {
                        replacement = image.content
                    }
                    else if (this.currentStrategy === 'embed_base64') {
                        replacement = `![image](${image.content})`
                    }
                    else if (this.currentStrategy === 'separate_files') {
                        replacement = `![image](${image.content})`
                    }
                    break

                case 'html':
                    if (this.currentStrategy === 'text_marker') {
                        replacement = `<div class="image-placeholder">${image.content}</div>`
                    }
                    else if (this.currentStrategy === 'embed_base64') {
                        replacement = `<img src="${image.content}" />`
                    }
                    else if (this.currentStrategy === 'separate_files') {
                        replacement = `<img src="${image.content}" />`
                    }
                    break

                case 'json':
                    // For JSON, we might want to include image metadata
                    replacement = JSON.stringify({
                        placeholder: image.content,
                        metadata: image.metadata,
                    })
                    break
            }

            result = result.replace(placeholder, replacement)
        })

        return result
    }
}

/**
 * Global image handler instance
 * This will be initialized with settings in the main application
 */
let globalImageHandler: ImageHandler | null = null

/**
 * Get or create global image handler
 */
export function getImageHandler(): ImageHandler {
    if (!globalImageHandler) {
        globalImageHandler = new DefaultImageHandler()
    }
    return globalImageHandler
}

/**
 * Initialize global image handler with strategy
 */
export function initializeImageHandler(strategy: ImageHandlingStrategy): void {
    globalImageHandler = new DefaultImageHandler(strategy)
}

/**
 * Get available image handling strategies
 */
export { getAvailableStrategies }
