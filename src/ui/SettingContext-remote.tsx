import { createContext, useContext, useEffect, useState } from 'react'
import {
    KEY_IMAGE_CUSTOM_MARKER,
    KEY_IMAGE_HANDLING_STRATEGY,
    KEY_IMAGE_INCLUDE_METADATA,
    KEY_IMAGE_MAX_SIZE,
    KEY_IMAGE_QUALITY,
} from '../constants'
import { ScriptStorage } from '../utils/storage'
import type { ImageHandlingStrategy } from '../exporter/image-types'

export interface ImageHandlingSettings {
    strategy: ImageHandlingStrategy
    customMarkerText: string
    imageQuality: number
    maxImageSize: number
    includeImageMetadata: boolean
}

interface ImageHandlingContextType {
    settings: ImageHandlingSettings
    setSettings: (settings: Partial<ImageHandlingSettings>) => void
    resetSettings: () => void
    isLoading: boolean
}

const defaultSettings: ImageHandlingSettings = {
    strategy: 'embed_base64',
    customMarkerText: '[Image Omitted]',
    imageQuality: 85,
    maxImageSize: 2048,
    includeImageMetadata: true,
}

const ImageHandlingContext = createContext<ImageHandlingContextType | undefined>(undefined)

export function ImageHandlingProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettingsState] = useState<ImageHandlingSettings>(defaultSettings)
    const [isLoading, setIsLoading] = useState(true)

    const loadSettings = async () => {
        try {
            const loadedSettings: Partial<ImageHandlingSettings> = {}

            // Load strategy
            const strategy = ScriptStorage.get<ImageHandlingStrategy>(KEY_IMAGE_HANDLING_STRATEGY)
            if (strategy && ['embed_base64', 'text_marker', 'separate_files'].includes(strategy)) {
                loadedSettings.strategy = strategy
            }

            // Load custom marker text
            const customMarker = ScriptStorage.get<string>(KEY_IMAGE_CUSTOM_MARKER)
            if (typeof customMarker === 'string' && customMarker.trim()) {
                loadedSettings.customMarkerText = customMarker
            }

            // Load image quality
            const quality = ScriptStorage.get<number>(KEY_IMAGE_QUALITY)
            if (typeof quality === 'number' && quality >= 10 && quality <= 100) {
                loadedSettings.imageQuality = quality
            }

            // Load max image size
            const maxSize = ScriptStorage.get<number>(KEY_IMAGE_MAX_SIZE)
            if (typeof maxSize === 'number' && maxSize >= 512 && maxSize <= 4096) {
                loadedSettings.maxImageSize = maxSize
            }

            // Load metadata include flag
            const includeMetadata = ScriptStorage.get<boolean>(KEY_IMAGE_INCLUDE_METADATA)
            if (typeof includeMetadata === 'boolean') {
                loadedSettings.includeImageMetadata = includeMetadata
            }

            // Merge with defaults
            const mergedSettings = { ...defaultSettings, ...loadedSettings }
            setSettingsState(mergedSettings)
        }
        catch (error) {
            console.warn('Failed to load image handling settings:', error)
            // Use defaults on error
            setSettingsState(defaultSettings)
        }
        finally {
            setIsLoading(false)
        }
    }

    const saveSettings = (newSettings: ImageHandlingSettings) => {
        try {
            ScriptStorage.set(KEY_IMAGE_HANDLING_STRATEGY, newSettings.strategy)
            ScriptStorage.set(KEY_IMAGE_CUSTOM_MARKER, newSettings.customMarkerText)
            ScriptStorage.set(KEY_IMAGE_QUALITY, newSettings.imageQuality)
            ScriptStorage.set(KEY_IMAGE_MAX_SIZE, newSettings.maxImageSize)
            ScriptStorage.set(KEY_IMAGE_INCLUDE_METADATA, newSettings.includeImageMetadata)
        }
        catch (error) {
            console.warn('Failed to save image handling settings:', error)
        }
    }

    // Load settings from storage on mount
    useEffect(() => {
        loadSettings()
    }, [])

    // Save settings to storage whenever they change
    useEffect(() => {
        if (!isLoading) {
            saveSettings(settings)
        }
    }, [settings, isLoading])

    const setSettings = (updates: Partial<ImageHandlingSettings>) => {
        setSettingsState(prev => ({ ...prev, ...updates }))
    }

    const resetSettings = () => {
        setSettingsState(defaultSettings)
    }

    return (
        (ImageHandlingContext.Provider as any)(
            { value: { settings, setSettings, resetSettings, isLoading } },
            children,
        )
    )
}

export function useImageHandling() {
    const context = useContext(ImageHandlingContext)
    if (context === undefined) {
        throw new Error('useImageHandling must be used within an ImageHandlingProvider')
    }
    return context
}

export { defaultSettings }
