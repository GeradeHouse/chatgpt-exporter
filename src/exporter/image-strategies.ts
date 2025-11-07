import { KEY_IMAGE_CUSTOM_MARKER } from '../constants'
import { ScriptStorage } from '../utils/storage'
import {
    createImageRelativePath,
    generateImageFileName,
    generateImageId,
    getBase64FromImageUrl,
    getFileSizeFromBase64,
    getMimeType,
    sanitizeFileName,
} from './image-utils'
import type {
    ImageContext,
    ImageHandlingStrategy,
    ImageProcessor,
    ProcessedImage,
} from './image-types'

/**
 * Base class for image processing strategies
 */
abstract class BaseImageProcessor implements ImageProcessor {
    abstract getStrategyName(): ImageHandlingStrategy

    async processImage(imageUrl: string, context: ImageContext): Promise<ProcessedImage> {
        const id = generateImageId(context)
        const mimeType = getMimeType(imageUrl)

        return {
            id,
            content: '',
            originalData: undefined,
            metadata: {
                originalUrl: imageUrl,
                mimeType,
                timestamp: context.timestamp,
            },
        }
    }

    generateContent(
        _processedImages: ProcessedImage[],
        originalContent: string,
    ): string {
        // Base implementation - should be overridden by subclasses
        return originalContent
    }
}

/**
 * Strategy 1: Embed images as base64 data URIs (current behavior)
 */
class EmbedBase64Strategy extends BaseImageProcessor {
    getStrategyName(): ImageHandlingStrategy {
        return 'embed_base64'
    }

    async processImage(imageUrl: string, context: ImageContext): Promise<ProcessedImage> {
        const id = generateImageId(context)
        const mimeType = getMimeType(imageUrl)

        try {
            const base64Data = await getBase64FromImageUrl(imageUrl)
            const dataUri = `data:${mimeType};base64,${base64Data.split(',')[1]}`

            return {
                id,
                content: dataUri,
                originalData: base64Data,
                metadata: {
                    originalUrl: imageUrl,
                    mimeType,
                    fileSize: getFileSizeFromBase64(base64Data),
                    timestamp: context.timestamp,
                },
            }
        }
        catch (error) {
            console.warn(`Failed to process image ${imageUrl}:`, error)
            // Return placeholder for failed images
            return {
                id,
                content: '[Image Processing Failed]',
                metadata: {
                    originalUrl: imageUrl,
                    mimeType,
                    timestamp: context.timestamp,
                },
            }
        }
    }

    generateContent(
        _processedImages: ProcessedImage[],
        originalContent: string,
    ): string {
        // This is a simplified version - the actual replacement will be done in the integration layer
        return originalContent
    }
}

/**
 * Strategy 2: Replace images with text markers
 */
class TextMarkerStrategy extends BaseImageProcessor {
    getStrategyName(): ImageHandlingStrategy {
        return 'text_marker'
    }

    async processImage(imageUrl: string, context: ImageContext): Promise<ProcessedImage> {
        const id = generateImageId(context)
        const mimeType = getMimeType(imageUrl)

        // Get custom marker text from settings (fallback to default)
        const customMarker = this.getCustomMarkerText()

        return {
            id,
            content: customMarker,
            metadata: {
                originalUrl: imageUrl,
                mimeType,
                timestamp: context.timestamp,
                messageContext: context.author
                    ? {
                            author: context.author.name || context.author.role,
                            role: context.author.role,
                        }
                    : undefined,
            },
        }
    }

    private getCustomMarkerText(): string {
        // Get custom marker text from settings
        const customMarker = ScriptStorage.get<string>(KEY_IMAGE_CUSTOM_MARKER) || '[Image Omitted]'
        return customMarker
    }

    generateContent(
        _processedImages: ProcessedImage[],
        originalContent: string,
    ): string {
        return originalContent
    }
}

/**
 * Strategy 3: Separate images into files with relative links
 */
class SeparateFilesStrategy extends BaseImageProcessor {
    getStrategyName(): ImageHandlingStrategy {
        return 'separate_files'
    }

    async processImage(imageUrl: string, context: ImageContext): Promise<ProcessedImage> {
        const id = generateImageId(context)
        const mimeType = getMimeType(imageUrl)

        try {
            const base64Data = await getBase64FromImageUrl(imageUrl)
            const extension = mimeType.split('/')[1] || 'png'
            const fileName = sanitizeFileName(generateImageFileName(context, extension))
            const relativePath = createImageRelativePath(fileName)

            return {
                id,
                content: relativePath, // Relative path for linking
                originalData: base64Data,
                fileName,
                metadata: {
                    originalUrl: imageUrl,
                    mimeType,
                    fileSize: getFileSizeFromBase64(base64Data),
                    timestamp: context.timestamp,
                    messageContext: context.author
                        ? {
                                author: context.author.name || context.author.role,
                                role: context.author.role,
                            }
                        : undefined,
                },
            }
        }
        catch (error) {
            console.warn(`Failed to process image ${imageUrl}:`, error)
            // Return error marker for failed images
            return {
                id,
                content: '[Image Processing Failed]',
                metadata: {
                    originalUrl: imageUrl,
                    mimeType,
                    timestamp: context.timestamp,
                },
            }
        }
    }

    generateContent(
        _processedImages: ProcessedImage[],
        originalContent: string,
    ): string {
        return originalContent
    }
}

/**
 * Factory function to create image processors
 */
export function createImageProcessor(strategy: ImageHandlingStrategy): ImageProcessor {
    switch (strategy) {
        case 'embed_base64':
            return new EmbedBase64Strategy()
        case 'text_marker':
            return new TextMarkerStrategy()
        case 'separate_files':
            return new SeparateFilesStrategy()
        default:
            throw new Error(`Unknown image handling strategy: ${strategy}`)
    }
}

/**
 * Get all available strategies
 */
export function getAvailableStrategies(): ImageHandlingStrategy[] {
    return ['embed_base64', 'text_marker', 'separate_files']
}
