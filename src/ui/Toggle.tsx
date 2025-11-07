import { Switch } from '@headlessui/react'

interface ToggleProps {
    label?: string
    checked?: boolean
    onCheckedUpdate?: (checked: boolean) => void
    onChange?: (checked: boolean) => void
}

/**
 * Mimics the style of OpenAI's toggle switches.
 */
export function Toggle({ label, checked = true, onCheckedUpdate, onChange }: ToggleProps) {
    const handleChange = onChange || onCheckedUpdate
    return (
        <div className="inline-flex items-center">
            <Switch
                checked={checked}
                onChange={handleChange}
                data-state={checked ? 'checked' : 'unchecked'}
                className="toggle-switch"
            >
                <span
                    data-state={checked ? 'checked' : 'unchecked'}
                    className="toggle-switch-handle"
                >
                </span>
            </Switch>
            {label && <span className="toggle-switch-label">{label}</span>}
        </div>
    )
}
