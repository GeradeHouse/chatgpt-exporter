import { Dialog } from '@radix-ui/react-dialog'
import { h } from 'preact'
import { useEffect, useState } from 'react'
import { getAvailableStrategies } from '../exporter/image-handler'
import { Divider } from './Divider'
import { useImageHandling } from './SettingContext-remote'
import { Toggle } from './Toggle'
import type { ImageHandlingStrategy } from '../exporter/image-types'

interface SettingDialogProps {
    isOpen: boolean
    onClose: () => void
}

export function SettingDialog({ isOpen, onClose }: SettingDialogProps) {
    const { settings, setSettings, resetSettings, isLoading } = useImageHandling()
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [customMarkerText, setCustomMarkerText] = useState(settings.customMarkerText)
    const [imageQuality, setImageQuality] = useState(settings.imageQuality)
    const [maxImageSize, setMaxImageSize] = useState(settings.maxImageSize)
    const [includeMetadata, setIncludeMetadata] = useState(settings.includeImageMetadata)

    // Update local state when settings change
    useEffect(() => {
        setCustomMarkerText(settings.customMarkerText)
        setImageQuality(settings.imageQuality)
        setMaxImageSize(settings.maxImageSize)
        setIncludeMetadata(settings.includeImageMetadata)
    }, [settings])

    const handleSave = () => {
        setSettings({
            strategy: settings.strategy,
            customMarkerText,
            imageQuality,
            maxImageSize,
            includeImageMetadata: includeMetadata,
        })
        onClose()
    }

    const handleReset = () => {
        resetSettings()
        setCustomMarkerText('[Image Omitted]')
        setImageQuality(85)
        setMaxImageSize(2048)
        setIncludeMetadata(true)
    }

    const getStrategyDescription = (strategy: ImageHandlingStrategy): string => {
        switch (strategy) {
            case 'embed_base64':
                return 'Embed images directly into the export file using base64 encoding'
            case 'text_marker':
                return 'Replace images with customizable text markers'
            case 'separate_files':
                return 'Save images as separate files with reference links'
            default:
                return ''
        }
    }

    const getStrategyPreview = (strategy: ImageHandlingStrategy): string => {
        switch (strategy) {
            case 'embed_base64':
                return '![image](data:image/png;base64,iVBORw0...)'
            case 'text_marker':
                return customMarkerText || '[Image Omitted]'
            case 'separate_files':
                return '![image](images/chatgpt-response-001.png)'
            default:
                return ''
        }
    }

    if (isLoading) {
        return (Dialog as any)(
            { open: isOpen, onOpenChange: onClose },
            h('div', { className: 'dialog-overlay' }),
            h('div', { className: 'dialog-content' }, h('div', { className: 'flex items-center justify-center p-8' }, h('div', { className: 'text-gray-500' }, 'Loading'))),
        )
    }

    return (Dialog as any)(
        { open: isOpen, onOpenChange: onClose },
        h('div', { className: 'dialog-overlay' }),
        h('div', { className: 'dialog-content setting-dialog' }, h('div', { className: 'dialog-header' }, h('h2', { className: 'text-xl font-semibold' }, 'Image Handling'), h('button', { className: 'dialog-close', onClick: onClose }, '×')), h('div', { className: 'dialog-body' }, h('div', { className: 'setting-section' }, h('p', { className: 'setting-description' }, 'Configure how images are handled during export'), h('div', { className: 'strategy-options' }, getAvailableStrategies().map(strategy =>
            h('div', { key: strategy, className: 'strategy-option' }, h('div', { className: 'strategy-radio' }, h('input', {
                type: 'radio',
                id: `strategy-${strategy}`,
                name: 'image-handling-strategy',
                value: strategy,
                checked: settings.strategy === strategy,
                onChange: () => setSettings({ strategy }),
            }), h('label', { htmlFor: `strategy-${strategy}`, className: 'strategy-label' }, h('div', { className: 'strategy-title' }, getStrategyTitle(strategy)), h('div', { className: 'strategy-description-text' }, getStrategyDescription(strategy)))), settings.strategy === strategy && h('div', { className: 'strategy-preview' }, h('div', { className: 'preview-label' }, 'Preview'), h('div', { className: 'preview-content' }, h('code', { className: 'preview-code' }, getStrategyPreview(strategy))))),
        ))), settings.strategy === 'text_marker' && h('div', { className: 'setting-section' }, h('label', { className: 'setting-label' }, 'Custom Marker Text'), h('input', {
            type: 'text',
            value: customMarkerText,
            onChange: e => setCustomMarkerText((e.target as HTMLInputElement).value),
            className: 'setting-input',
            placeholder: '[Image Omitted]',
            maxLength: 100,
        })), settings.strategy === 'separate_files' && h('div', {}, h(Divider, {}), h('div', { className: 'setting-section' }, h('button', {
            className: 'advanced-toggle',
            onClick: () => setShowAdvanced(!showAdvanced),
        }, 'Advanced Options', h('span', { className: `toggle-arrow ${showAdvanced ? 'expanded' : ''}` }, '▼')), showAdvanced && h('div', { className: 'advanced-options' }, h('div', { className: 'option-group' }, h('label', { className: 'setting-label' }, `Image Quality: ${imageQuality}%`), h('input', {
            type: 'range',
            min: '10',
            max: '100',
            value: imageQuality,
            onChange: e => setImageQuality(Number((e.target as HTMLInputElement).value)),
            className: 'setting-slider',
        }), h('div', { className: 'slider-labels' }, h('span', {}, '10%'), h('span', {}, '100%'))), h('div', { className: 'option-group' }, h('label', { className: 'setting-label' }, `Max Image Size: ${maxImageSize}px`), h('input', {
            type: 'range',
            min: '512',
            max: '4096',
            step: '128',
            value: maxImageSize,
            onChange: e => setMaxImageSize(Number((e.target as HTMLInputElement).value)),
            className: 'setting-slider',
        }), h('div', { className: 'slider-labels' }, h('span', {}, '512px'), h('span', {}, '4096px'))), h('div', { className: 'option-group' }, h('div', { className: 'flex items-center justify-between' }, h('label', { className: 'setting-label' }, 'Include Image Metadata'), h(Toggle, { checked: includeMetadata, onCheckedChange: setIncludeMetadata }))))))), h('div', { className: 'dialog-footer' }, h('button', { className: 'btn btn-secondary', onClick: handleReset }, 'Reset to Defaults'), h('div', { className: 'flex gap-3' }, h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Cancel'), h('button', { className: 'btn btn-primary', onClick: handleSave }, 'Save')))),
    )
}

function getStrategyTitle(strategy: ImageHandlingStrategy): string {
    switch (strategy) {
        case 'embed_base64':
            return 'Embed Images'
        case 'text_marker':
            return 'Text Markers'
        case 'separate_files':
            return 'Separate Files'
        default:
            return strategy
    }
}
