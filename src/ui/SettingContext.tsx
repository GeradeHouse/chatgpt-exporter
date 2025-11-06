import { createContext, useContext } from 'preact/compat'
import { useCallback } from 'preact/hooks'
import {
    KEY_EXPORT_ALL_LIMIT,
    KEY_FILENAME_FORMAT,
    KEY_IMAGE_CUSTOM_MARKER,
    KEY_IMAGE_HANDLING_STRATEGY,
    KEY_IMAGE_INCLUDE_METADATA,
    KEY_IMAGE_MAX_SIZE,
    KEY_IMAGE_QUALITY,
    KEY_META_ENABLED,
    KEY_META_LIST,
    KEY_TIMESTAMP_24H,
    KEY_TIMESTAMP_ENABLED,
    KEY_TIMESTAMP_HTML,
    KEY_TIMESTAMP_MARKDOWN,
} from '../constants'
import { useGMStorage } from '../hooks/useGMStorage'
import type { ImageHandlingStrategy } from '../exporter/image-types'
import type { FC } from 'preact/compat'

const defaultFormat = 'ChatGPT-{title}'
const defaultExportAllLimit = 1000

// Default image handling settings
const defaultImageHandlingStrategy = 'embed_base64' as ImageHandlingStrategy
const defaultCustomMarkerText = '[Image Omitted]'
const defaultImageQuality = 85
const defaultMaxImageSize = 2048
const defaultIncludeImageMetadata = true

export interface ExportMeta {
    name: string
    value: string
}

const defaultExportMetaList: ExportMeta[] = [
    { name: 'title', value: '{title}' },
    { name: 'source', value: '{source}' },
]

const SettingContext = createContext({
    format: defaultFormat,
    setFormat: (_: string) => {},

    enableTimestamp: false,
    setEnableTimestamp: (_: boolean) => {},
    timeStamp24H: false,
    setTimeStamp24H: (_: boolean) => {},
    enableTimestampHTML: false,
    setEnableTimestampHTML: (_: boolean) => {},
    enableTimestampMarkdown: false,
    setEnableTimestampMarkdown: (_: boolean) => {},

    enableMeta: false,
    setEnableMeta: (_: boolean) => {},
    exportMetaList: defaultExportMetaList,
    setExportMetaList: (_: ExportMeta[]) => {},
    exportAllLimit: defaultExportAllLimit,
    setExportAllLimit: (_: number) => {},

    // Image handling settings
    imageHandlingStrategy: defaultImageHandlingStrategy,
    setImageHandlingStrategy: (_: ImageHandlingStrategy) => {},
    imageCustomMarker: defaultCustomMarkerText,
    setImageCustomMarker: (_: string) => {},
    imageQuality: defaultImageQuality,
    setImageQuality: (_: number) => {},
    imageMaxSize: defaultMaxImageSize,
    setImageMaxSize: (_: number) => {},
    imageIncludeMetadata: defaultIncludeImageMetadata,
    setImageIncludeMetadata: (_: boolean) => {},

    resetDefault: () => {},
})

export const SettingProvider: FC = ({ children }) => {
    const [format, setFormat] = useGMStorage(KEY_FILENAME_FORMAT, defaultFormat)

    const [enableTimestamp, setEnableTimestamp] = useGMStorage(KEY_TIMESTAMP_ENABLED, false)
    const [timeStamp24H, setTimeStamp24H] = useGMStorage(KEY_TIMESTAMP_24H, false)
    const [enableTimestampHTML, setEnableTimestampHTML] = useGMStorage(KEY_TIMESTAMP_HTML, false)
    const [enableTimestampMarkdown, setEnableTimestampMarkdown] = useGMStorage(KEY_TIMESTAMP_MARKDOWN, false)

    const [enableMeta, setEnableMeta] = useGMStorage(KEY_META_ENABLED, false)

    const [exportMetaList, setExportMetaList] = useGMStorage(KEY_META_LIST, defaultExportMetaList)
    const [exportAllLimit, setExportAllLimit] = useGMStorage(KEY_EXPORT_ALL_LIMIT, defaultExportAllLimit)

    // Image handling settings
    const [imageHandlingStrategy, setImageHandlingStrategy] = useGMStorage(
        KEY_IMAGE_HANDLING_STRATEGY,
        defaultImageHandlingStrategy,
    )
    const [imageCustomMarker, setImageCustomMarker] = useGMStorage(
        KEY_IMAGE_CUSTOM_MARKER,
        defaultCustomMarkerText,
    )
    const [imageQuality, setImageQuality] = useGMStorage(
        KEY_IMAGE_QUALITY,
        defaultImageQuality,
    )
    const [imageMaxSize, setImageMaxSize] = useGMStorage(
        KEY_IMAGE_MAX_SIZE,
        defaultMaxImageSize,
    )
    const [imageIncludeMetadata, setImageIncludeMetadata] = useGMStorage(
        KEY_IMAGE_INCLUDE_METADATA,
        defaultIncludeImageMetadata,
    )

    const resetDefault = useCallback(() => {
        setFormat(defaultFormat)
        setEnableTimestamp(false)
        setEnableMeta(false)
        setExportMetaList(defaultExportMetaList)
        setExportAllLimit(defaultExportAllLimit)

        // Reset image handling settings
        setImageHandlingStrategy(defaultImageHandlingStrategy)
        setImageCustomMarker(defaultCustomMarkerText)
        setImageQuality(defaultImageQuality)
        setImageMaxSize(defaultMaxImageSize)
        setImageIncludeMetadata(defaultIncludeImageMetadata)
    }, [
        setFormat,
        setEnableTimestamp,
        setEnableMeta,
        setExportMetaList,
        setExportAllLimit,
        setImageHandlingStrategy,
        setImageCustomMarker,
        setImageQuality,
        setImageMaxSize,
        setImageIncludeMetadata,
    ])

    return (
        <SettingContext.Provider
            value={{
                format,
                setFormat,

                enableTimestamp,
                setEnableTimestamp,
                timeStamp24H,
                setTimeStamp24H,
                enableTimestampHTML,
                setEnableTimestampHTML,
                enableTimestampMarkdown,
                setEnableTimestampMarkdown,

                enableMeta,
                setEnableMeta,
                exportMetaList,
                setExportMetaList,

                exportAllLimit,
                setExportAllLimit,

                // Image handling settings
                imageHandlingStrategy,
                setImageHandlingStrategy,
                imageCustomMarker,
                setImageCustomMarker,
                imageQuality,
                setImageQuality,
                imageMaxSize,
                setImageMaxSize,
                imageIncludeMetadata,
                setImageIncludeMetadata,

                resetDefault,
            }}
        >
            {children}
        </SettingContext.Provider>
    )
}

export const useSettingContext = () => useContext(SettingContext)
