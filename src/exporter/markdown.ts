import JSZip from 'jszip'
import { fetchConversation, getCurrentChatId, processConversation } from '../api'
import { KEY_IMAGE_CUSTOM_MARKER, KEY_IMAGE_HANDLING_STRATEGY, KEY_IMAGE_INCLUDE_METADATA, KEY_IMAGE_MAX_SIZE, KEY_IMAGE_QUALITY, KEY_TIMESTAMP_24H, KEY_TIMESTAMP_ENABLED, KEY_TIMESTAMP_MARKDOWN, baseUrl } from '../constants'
import i18n from '../i18n'
import { checkIfConversationStarted } from '../page'
import { downloadFile, getFileNameWithFormat } from '../utils/download'
import { fromMarkdown, toMarkdown } from '../utils/markdown'
import { ScriptStorage } from '../utils/storage'
import { standardizeLineBreaks } from '../utils/text'
import { dateStr, timestamp, unixTimestampToISOString } from '../utils/utils'
import { getImageHandler, initializeImageHandler } from './image-handler'
import { getCurrentTimestamp } from './image-utils'
import type { ExportFile, ExportMetadata, ImageContext, ProcessedImage } from './image-types'
import type { ApiConversationWithId, Citation, ConversationNodeMessage, ConversationResult } from '../api'
import type { ExportMeta } from '../ui/SettingContext'

export async function exportToMarkdown(fileNameFormat: string, metaList: ExportMeta[]) {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    const chatId = await getCurrentChatId()
    const rawConversation = await fetchConversation(chatId, true)
    const conversation = processConversation(rawConversation)

    // Initialize image handler with current settings
    const imageHandlingStrategy = ScriptStorage.get<string>(KEY_IMAGE_HANDLING_STRATEGY) || 'embed_base64'
    initializeImageHandler(imageHandlingStrategy as any)

    const { markdown, exportFiles, imageMetadata } = await conversationToMarkdown(conversation, metaList)

    // Handle ZIP creation for Option 3
    if (imageHandlingStrategy === 'separate_files' && exportFiles && exportFiles.length > 0) {
        // Create ZIP with content and images
        const { createExportZip } = await import('./zip-packager')

        const metadata = imageMetadata
        if (metadata) {
            metadata.conversationTitle = conversation.title
            metadata.settings = {
                imageQuality: ScriptStorage.get<number>(KEY_IMAGE_QUALITY) || 85,
                maxImageSize: ScriptStorage.get<number>(KEY_IMAGE_MAX_SIZE) || 2048,
                includeImageMetadata: ScriptStorage.get<boolean>(KEY_IMAGE_INCLUDE_METADATA) || true,
                customMarkerText: ScriptStorage.get<string>(KEY_IMAGE_CUSTOM_MARKER) || '[Image Omitted]',
            }
        }

        const zipBlob = await createExportZip(
            `${conversation.title}.md`,
            markdown,
            exportFiles,
            metadata!,
            'text/markdown',
        )

        const { generateZipFileName } = await import('./zip-packager')
        const zipFileName = generateZipFileName(conversation.title, imageHandlingStrategy)
        downloadFile(zipFileName, 'application/zip', zipBlob)
    }
    else {
        // Regular single file download
        const fileName = getFileNameWithFormat(fileNameFormat, 'md', {
            title: conversation.title,
            chatId,
            createTime: conversation.createTime,
            updateTime: conversation.updateTime,
        })
        downloadFile(fileName, 'text/markdown', standardizeLineBreaks(markdown))
    }

    return true
}

export async function exportAllToMarkdown(fileNameFormat: string, apiConversations: ApiConversationWithId[], metaList?: ExportMeta[]) {
    // Initialize image handler with current settings
    const imageHandlingStrategy = ScriptStorage.get<string>(KEY_IMAGE_HANDLING_STRATEGY) || 'embed_base64'
    initializeImageHandler(imageHandlingStrategy as any)

    const zip = new JSZip()
    const filenameMap = new Map<string, number>()
    const conversations = apiConversations.map(x => processConversation(x))

    for (const conversation of conversations) {
        let fileName = getFileNameWithFormat(fileNameFormat, 'md', {
            title: conversation.title,
            chatId: conversation.id,
            createTime: conversation.createTime,
            updateTime: conversation.updateTime,
        })
        if (filenameMap.has(fileName)) {
            const count = filenameMap.get(fileName) ?? 1
            filenameMap.set(fileName, count + 1)
            fileName = `${fileName.slice(0, -3)} (${count}).md`
        }
        else {
            filenameMap.set(fileName, 1)
        }
        const { markdown } = await conversationToMarkdown(conversation, metaList)
        zip.file(fileName, markdown)
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9,
        },
    })
    downloadFile('chatgpt-export-markdown.zip', 'application/zip', blob)

    return true
}

const LatexRegex = /(\s\$\$.+\$\$\s|\s\$.+\$\s|\\\[.+\\\]|\\\(.+\\\))|(^\$$[\S\s]+^\$$)|(^\$\$[\S\s]+^\$\$$)/gm

/**
 * Extract all images from conversation nodes for processing
 */
function extractImagesFromConversation(conversation: ConversationResult): Array<{
    url: string
    context: ImageContext
}> {
    const images: Array<{ url: string; context: ImageContext }> = []

    conversation.conversationNodes.forEach((node, nodeIndex) => {
        const message = node.message
        if (!message || !message.content) return

        let imageIndex = 0

        // Process different content types that may contain images
        if (message.content.content_type === 'execution_output' && message.metadata?.aggregate_result?.messages) {
            message.metadata.aggregate_result.messages.forEach((msg) => {
                if (msg.message_type === 'image' && msg.image_url) {
                    const imageContext: ImageContext = {
                        conversationId: conversation.id,
                        messageId: message.id || `node-${nodeIndex}`,
                        imageIndex: imageIndex++,
                        mimeType: 'image/png', // Will be detected properly
                        originalUrl: msg.image_url,
                        contentType: 'image_url',
                        author: message.author,
                        timestamp: message.create_time,
                    }

                    images.push({
                        url: msg.image_url,
                        context: imageContext,
                    })
                }
            })
        }
        else if (message.content.content_type === 'multimodal_text' && message.content.parts) {
            message.content.parts.forEach((part) => {
                if (part.content_type === 'image_asset_pointer' && part.asset_pointer) {
                    const imageContext: ImageContext = {
                        conversationId: conversation.id,
                        messageId: message.id || `node-${nodeIndex}`,
                        imageIndex: imageIndex++,
                        mimeType: 'image/png', // Will be detected properly
                        originalUrl: part.asset_pointer,
                        contentType: 'multimodal_text',
                        author: message.author,
                        timestamp: message.create_time,
                    }

                    images.push({
                        url: part.asset_pointer,
                        context: imageContext,
                    })
                }
            })
        }
    })

    return images
}

async function conversationToMarkdown(conversation: ConversationResult, metaList?: ExportMeta[]) {
    const { id, title, model, modelSlug, createTime, updateTime, conversationNodes } = conversation
    const source = `${baseUrl}/c/${id}`

    const _metaList = metaList
        ?.filter(x => !!x.name)
        .map(({ name, value }) => {
            const val = value
                .replace('{title}', title)
                .replace('{date}', dateStr())
                .replace('{timestamp}', timestamp())
                .replace('{source}', source)
                .replace('{model}', model)
                .replace('{model_name}', modelSlug)
                .replace('{create_time}', unixTimestampToISOString(createTime))
                .replace('{update_time}', unixTimestampToISOString(updateTime))

            return `${name}: ${val}`
        })
    ?? []
    const frontMatter = _metaList.length > 0
        ? `---\n${_metaList.join('\n')}\n---\n\n`
        : ''

    const enableTimestamp = ScriptStorage.get<boolean>(KEY_TIMESTAMP_ENABLED) ?? false
    const timeStampMarkdown = ScriptStorage.get<boolean>(KEY_TIMESTAMP_MARKDOWN) ?? false
    const timeStamp24H = ScriptStorage.get<boolean>(KEY_TIMESTAMP_24H) ?? false

    // Get image handler and extract all images
    const imageHandler = getImageHandler()
    const images = extractImagesFromConversation(conversation)

    // Process images with current strategy
    let processedImages: ProcessedImage[] = []
    let exportFiles: ExportFile[] = []
    let imageMetadata: ExportMetadata | undefined
    if (images.length > 0) {
        const imageResult = await imageHandler.processConversationImages(images, 'markdown')
        processedImages = imageResult.processedImages || []
        exportFiles = imageResult.files || []
        imageMetadata = imageResult.metadata
    }

    const content = []
    let imageIndex = 0

    for (const { message } of conversationNodes) {
        if (!message || !message.content) continue

        // ChatGPT is talking to tool
        if (message.recipient !== 'all') continue

        // Skip tool's intermediate message.
        if (message.author.role === 'tool') {
            if (
                // HACK: we special case the content_type 'multimodal_text' here because it is used by
                // the dalle tool to return the image result, and we do want to show that.
                message.content.content_type !== 'multimodal_text'
                // Code execution result with image
            && !(
                message.content.content_type === 'execution_output'
                && message.metadata?.aggregate_result?.messages?.some(msg => msg.message_type === 'image')
            )
            ) {
                continue
            }
        }

        const timestamp = message?.create_time ?? ''
        const showTimestamp = enableTimestamp && timeStampMarkdown && timestamp
        let timestampHtml = ''
        if (showTimestamp) {
            const date = new Date(timestamp * 1000)
            // format: 20:12 / 08:12 PM
            const conversationTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: !timeStamp24H })
            timestampHtml = `<time datetime="${date.toISOString()}" title="${date.toLocaleString()}">${conversationTime}</time>\n\n`
        }

        const author = transformAuthor(message.author)

        const postSteps: Array<(input: string) => string> = []
        if (message.author.role === 'assistant') {
            postSteps.push(input => transformFootNotes(input, message.metadata))
        }
        // Only message from assistant will be reformatted
        if (message.author.role === 'assistant') {
            postSteps.push((input) => {
                // Replace mathematical formula annotation
                input = input
                    .replace(/^\\\[(.+)\\\]$/gm, '$$$$$1$$$$')
                    .replace(/\\\[/g, '$')
                    .replace(/\\\]/g, '$')
                    .replace(/\\\(/g, '$')
                    .replace(/\\\)/g, '$')
                const matches = input.match(LatexRegex)
                // Skip code block as the following steps can potentially break the code
                const isCodeBlock = /```/.test(input)
                if (!isCodeBlock && matches) {
                    let index = 0
                    input = input.replace(LatexRegex, () => {
                        // Replace it with `╬${index}╬` to avoid markdown processor ruin the formula
                        return `╬${index++}╬`
                    })
                }

                let transformed = toMarkdown(fromMarkdown(input))

                if (!isCodeBlock && matches) {
                    // Replace `╬${index}╬` back to the original latex
                    transformed = transformed.replace(/╬(\d+)╬/g, (_, index) => {
                        return matches[+index]
                    })
                }

                return transformed
            })
        }
        const postProcess = (input: string) => postSteps.reduce((acc, fn) => fn(acc), input)
        const messageContent = await transformContent(message.content, message.metadata, postProcess, processedImages, imageIndex)

        // Update image index for next message
        imageIndex += countImagesInMessage(message)

        content.push(`#### ${author}:\n${timestampHtml}${messageContent}`)
    }

    const markdown = `${frontMatter}# ${title}\n\n${content.join('\n\n')}`

    return {
        markdown,
        exportFiles,
        imageMetadata,
    }
}

function transformAuthor(author: ConversationNodeMessage['author']): string {
    switch (author.role) {
        case 'assistant':
            return 'ChatGPT'
        case 'user':
            return 'You'
        case 'tool':
            return `Plugin${author.name ? ` (${author.name})` : ''}`
        default:
            return author.role
    }
}

/**
 * Transform foot notes in assistant's message
 */
function transformFootNotes(
    input: string,
    metadata: ConversationNodeMessage['metadata'],
) {
    // 【11†(PrintWiki)】
    const footNoteMarkRegex = /【(\d+)†\((.+?)\)】/g

    const citationList: Citation[] = []
    const output = input.replace(footNoteMarkRegex, (match, citeIndex, _evidenceText) => {
        const citation = metadata?.citations?.find(cite => cite.metadata?.extra?.cited_message_idx === +citeIndex)
        if (citation) {
            citationList.push(citation)
            // Use markdown caret to represent foot note ([^1])
            return `[^${citeIndex}]`
        }

        return match
    })
    const citationText = citationList.map((citation) => {
        const citeIndex = citation.metadata?.extra?.cited_message_idx ?? 1
        const citeTitle = citation.metadata?.title ?? 'No title'
        return `[^${citeIndex}]: ${citeTitle}`
    }).join('\n')

    // Foot notes are placed at the end of the conversation node, not the end of the whole document
    return `${output}\n\n${citationText}`
}

/**
 * Helper function to count images in a message
 */
function countImagesInMessage(message: ConversationNodeMessage): number {
    if (!message.content) return 0

    let count = 0

    if (message.content.content_type === 'execution_output' && message.metadata?.aggregate_result?.messages) {
        count += message.metadata.aggregate_result.messages.filter(msg => msg.message_type === 'image').length
    }
    else if (message.content.content_type === 'multimodal_text' && message.content.parts) {
        count += message.content.parts.filter(part => part.content_type === 'image_asset_pointer').length
    }

    return count
}

/**
 * Convert the content based on the type of message
 */
async function transformContent(
    content: ConversationNodeMessage['content'],
    metadata: ConversationNodeMessage['metadata'],
    postProcess: (input: string) => string,
    processedImages: ProcessedImage[],
    imageStartIndex: number,
) {
    switch (content.content_type) {
        case 'text':
            return postProcess(content.parts?.join('\n') || '')
        case 'code':
            return `Code:\n\`\`\`\n${content.text}\n\`\`\`` || ''
        case 'execution_output':
            if (metadata?.aggregate_result?.messages) {
                const imageMessages = metadata.aggregate_result.messages.filter(msg => msg.message_type === 'image')
                if (imageMessages.length > 0) {
                    const imageContent = imageMessages.map((_, index) => {
                        const globalIndex = imageStartIndex + index
                        const processedImage = processedImages[globalIndex]

                        if (processedImage && processedImage.content) {
                            return `![image](${processedImage.content})`
                        }
                        else {
                            return `[IMAGE_${globalIndex}]`
                        }
                    }).join('\n\n')

                    return postProcess(`Result:\n\`\`\`\n${content.text}\n\`\`\`${imageContent ? `\n\n${imageContent}` : ''}`)
                }
            }
            return postProcess(`Result:\n\`\`\`\n${content.text}\n\`\`\`` || '')
        case 'tether_quote':
            return postProcess(`> ${content.title || content.text || ''}`)
        case 'tether_browsing_code':
            return postProcess('') // TODO: implement
        case 'tether_browsing_display': {
            const metadataList = metadata?._cite_metadata?.metadata_list
            if (Array.isArray(metadataList) && metadataList.length > 0) {
                return postProcess(metadataList.map(({ title, url }) => `> [${title}](${url})`).join('\n'))
            }
            return postProcess('')
        }
        case 'multimodal_text': {
            const parts = content.parts?.map((part, partIndex) => {
                if (typeof part === 'string') return postProcess(part)
                if (part.content_type === 'image_asset_pointer') {
                    // Calculate the correct global image index for this specific image
                    const imageIndexInMessage = content.parts?.slice(0, partIndex).filter(p =>
                        typeof p === 'object' && p.content_type === 'image_asset_pointer',
                    ).length || 0
                    const globalImageIndex = imageStartIndex + imageIndexInMessage

                    const processedImage = processedImages[globalImageIndex]

                    if (processedImage && processedImage.content) {
                        return `![image](${processedImage.content})`
                    }

                    return `[IMAGE_${globalImageIndex}]`
                }
                if (part.content_type === 'audio_transcription') return `[audio] ${part.text}`
                if (part.content_type === 'audio_asset_pointer') return null
                if (part.content_type === 'real_time_user_audio_video_asset_pointer') return null
                return postProcess('[Unsupported multimodal content]')
            }) || []

            // Filter out null values and join
            return parts.filter(part => part !== null).join('\n')
        }
        default:
            return postProcess('[Unsupported Content]')
    }
}
