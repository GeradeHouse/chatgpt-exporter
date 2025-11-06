/**
 * React-safe DOM injection utilities
 * Prevents conflicts with ChatGPT's React hydration
 */

import { onloadSafe } from './utils'

/**
 * Wait for React to be fully hydrated before injecting content
 */
export function waitForReactHydration(
    callback: () => void,
    maxWaitTime: number = 10000,
): void {
    const startTime = Date.now()
    let checkCount = 0
    const maxChecks = 50 // Prevent infinite loops

    function checkHydration() {
        checkCount++
        const elapsed = Date.now() - startTime

        // Check multiple indicators of React hydration
        const isHydrated = (
            // Check for React fiber nodes
            document.querySelector('[data-fiber]') !== null
            // Check for React component IDs
            || document.querySelector('[data-testid^="conversation-turn-"]') !== null
            // Check for React root containers
            || document.querySelector('[data-root]') !== null
            // Check that main content is present
            || document.querySelector('main') !== null
        )

        // Additional safety: check that React is likely active
        const reactActive = (
            typeof window.React !== 'undefined'
            || document.querySelector('[data-reactroot]') !== null
            || document.querySelector('[data-react-fiber]') !== null
        )

        if (isHydrated && reactActive) {
            // Additional delay to ensure React is fully stable
            setTimeout(() => {
                callback()
            }, 500)
            return
        }

        if (elapsed > maxWaitTime || checkCount >= maxChecks) {
            // Proceed anyway with error handling
            try {
                callback()
            }
            catch {
                // Silent fail
            }
            return
        }

        // Check again in 200ms
        setTimeout(checkHydration, 200)
    }

    // Start checking after initial load
    onloadSafe(() => {
        setTimeout(checkHydration, 100)
    })
}

/**
 * Create a safe container element that's not managed by React
 */
export function createSafeContainer(
    className: string = 'chatgpt-exporter-container',
): HTMLElement {
    const container = document.createElement('div')
    container.className = className
    container.setAttribute('data-chatgpt-exporter', 'true')

    // Add to body with high z-index to ensure visibility
    document.body.appendChild(container)

    // Ensure it doesn't interfere with React by being non-interactive
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
        pointer-events: none;
    `

    return container
}

/**
 * Safely inject element into DOM without interfering with React
 */
export function safeInject(
    targetSelector: string,
    element: HTMLElement,
    position: 'before' | 'after' | 'prepend' | 'append' = 'append',
    retryCount: number = 3,
): Promise<boolean> {
    return new Promise((resolve) => {
        let attempts = 0

        function attemptInjection() {
            attempts++

            const target = document.querySelector(targetSelector)
            if (!target) {
                if (attempts < retryCount) {
                    setTimeout(attemptInjection, 500)
                    return
                }
                else {
                    resolve(false)
                    return
                }
            }

            try {
                // Use safer injection methods
                switch (position) {
                    case 'before':
                        target.parentNode?.insertBefore(element, target)
                        break
                    case 'after':
                        target.parentNode?.insertBefore(element, target.nextSibling)
                        break
                    case 'prepend':
                        target.prepend(element)
                        break
                    case 'append':
                    default:
                        target.append(element)
                        break
                }

                resolve(true)
            }
            catch {
                if (attempts < retryCount) {
                    setTimeout(attemptInjection, 1000)
                }
                else {
                    resolve(false)
                }
            }
        }

        attemptInjection()
    })
}

/**
 * Create a React-safe menu container
 */
export function createMenuContainer(): HTMLElement {
    // Create our own container instead of injecting into React areas
    const container = createSafeContainer('chatgpt-exporter-menu')

    // Position it at the bottom right
    container.style.cssText += `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: auto;
    `

    return container
}

/**
 * React-safe timestamp injection
 */
export function safeInjectTimestamp(
    threadElement: HTMLElement,
    timestamp: HTMLElement,
): void {
    try {
        // Only inject if the element doesn't already have our timestamp
        if (!threadElement.querySelector('time[data-chatgpt-exporter]')) {
            threadElement.appendChild(timestamp)
        }
    }
    catch {
        // Silent fail
    }
}

/**
 * Safe DOM observer that respects React
 */
export function createSafeObserver(
    callback: (mutations: MutationRecord[]) => void,
    options: MutationObserverInit = { childList: true, subtree: true },
): MutationObserver {
    const observer = new MutationObserver((mutations) => {
        // Filter out our own changes to prevent infinite loops
        const relevantMutations = mutations.filter(mutation =>
            !Array.from(mutation.addedNodes).some(node =>
                node.nodeType === Node.ELEMENT_NODE
                && (node as Element).hasAttribute('data-chatgpt-exporter'),
            ),
        )

        if (relevantMutations.length > 0) {
            callback(relevantMutations)
        }
    })

    observer.observe(document.body, options)
    return observer
}

/**
 * Cleanup function to remove all our injected elements
 */
export function cleanupInjectedElements(): void {
    const elements = document.querySelectorAll('[data-chatgpt-exporter]')
    elements.forEach((element) => {
        if (element.parentNode) {
            element.parentNode.removeChild(element)
        }
    })
}
