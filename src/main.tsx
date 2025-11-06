import { render } from 'preact'
import sentinel from 'sentinel-js'
import { fetchConversation, processConversation } from './api'
import { getChatIdFromUrl, isSharePage } from './page'
import { Menu } from './ui/Menu'
import {
    cleanupInjectedElements,
    createMenuContainer,
    createSafeObserver,
    safeInject,
    safeInjectTimestamp,
    waitForReactHydration,
} from './utils/react-safe'
import { onloadSafe } from './utils/utils'

import './i18n'
import './styles/missing-tailwind.css'

main()

function main() {
    onloadSafe(() => {
        // Create our own style element with safe naming
        const styleEl = document.createElement('style')
        styleEl.id = 'chatgpt-exporter-css'
        document.head.append(styleEl)

        // Initialize after React is fully hydrated
        waitForReactHydration(() => {
            initializeSafeInjection()
        })
    })

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanupInjectedElements)
}

function initializeSafeInjection() {
    // Track injected elements for cleanup
    const injectionMap = new Map<HTMLElement, HTMLElement>()

    // Use a safe observer with error handling
    createSafeObserver((mutations) => {
        // Handle DOM changes safely
        mutations.forEach((mutation) => {
            // Look for new nav elements to inject menu
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement
                    if (element.tagName === 'NAV') {
                        handleNavInjection(element)
                    }
                }
            })
        })
    })

    // Initial injection
    injectMenu()

    // Handle share pages separately
    if (isSharePage()) {
        injectSharePageMenu()
    }

    // Handle conversation timestamp injection
    initializeTimestampInjection()

    function handleNavInjection(nav: HTMLElement) {
        // Don't inject if we already have a container for this nav
        if (injectionMap.has(nav)) return

        // Create our own menu container - don't inject into React areas
        const menuContainer = createMenuContainer()
        injectionMap.set(nav, menuContainer)

        // Render our menu component
        render(<Menu container={menuContainer} />, menuContainer)

        // Try to find a safe injection point
        const chatList = nav.querySelector(':scope > div.sticky.bottom-0')
        if (chatList) {
            // Only inject if it's not likely to be managed by React
            if (!chatList.hasAttribute('data-react') && !chatList.querySelector('[data-testid]')) {
                safeInject(`nav:has(${getSelectorForElement(chatList)})`, menuContainer, 'after')
            }
        }
    }

    function injectMenu() {
        // Create our own floating menu instead of injecting into nav
        const menuContainer = createMenuContainer()
        menuContainer.style.cssText += `
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            padding: 8px;
        `

        // Render our menu
        render(<Menu container={menuContainer} />, menuContainer)
    }

    function injectSharePageMenu() {
        // For share pages, create a more prominent position
        const menuContainer = createMenuContainer()
        menuContainer.style.cssText += `
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            padding: 8px;
        `

        // Wait for share page content to be stable
        setTimeout(() => {
            const contentArea = document.querySelector('div[role="presentation"] > .w-full > div > .flex.w-full')
            if (contentArea) {
                // Create our own container, don't inject into existing elements
                render(<Menu container={menuContainer} />, menuContainer)
            }
        }, 1000)
    }

    function initializeTimestampInjection() {
        let chatId = ''
        let lastInjectionTime = 0

        // Use a safer observer for timestamp injection
        createSafeObserver((mutations) => {
            const now = Date.now()
            // Throttle timestamp injection to prevent performance issues
            if (now - lastInjectionTime < 1000) return

            // Only look for new message elements
            const newMessages = mutations
                .flatMap(m => Array.from(m.addedNodes))
                .filter(node =>
                    node.nodeType === Node.ELEMENT_NODE
                    && (node as Element).querySelector('[data-testid^="conversation-turn-"]'),
                )

            if (newMessages.length > 0) {
                handleTimestampInjection()
                lastInjectionTime = now
            }
        })

        // Initial timestamp injection
        handleTimestampInjection()

        function handleTimestampInjection() {
            const currentChatId = getChatIdFromUrl()
            if (!currentChatId || currentChatId === chatId) return
            chatId = currentChatId

            // Fetch conversation data with error handling
            fetchConversation(chatId, false)
                .then((rawConversation) => {
                    const { conversationNodes } = processConversation(rawConversation)
                    safeInjectTimestamps(conversationNodes)
                })
                .catch(() => {
                    // Silent fail for timestamp injection
                })
        }

        function safeInjectTimestamps(conversationNodes: any[]) {
            // Find thread elements more safely
            const threadElements = Array.from(document.querySelectorAll('main [data-testid^="conversation-turn-"] [data-message-id]'))

            threadElements.forEach((thread, index) => {
                const createTime = conversationNodes[index]?.message?.create_time
                if (!createTime) return

                // Only inject if we haven't already
                if (thread.querySelector('time[data-chatgpt-exporter]')) return

                try {
                    const date = new Date(createTime * 1000)

                    const timestamp = document.createElement('time')
                    timestamp.setAttribute('data-chatgpt-exporter', 'true')
                    timestamp.className = 'w-full text-gray-500 dark:text-gray-400 text-sm text-right'
                    timestamp.dateTime = date.toISOString()
                    timestamp.title = date.toLocaleString()

                    const hour12 = document.createElement('span')
                    hour12.setAttribute('data-time-format', '12')
                    hour12.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

                    const hour24 = document.createElement('span')
                    hour24.setAttribute('data-time-format', '24')
                    hour24.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

                    timestamp.append(hour12, hour24)

                    // Use our safe injection method
                    safeInjectTimestamp(thread as HTMLElement, timestamp)
                }
                catch {
                    // Silent fail for individual timestamp injection
                }
            })
        }
    }

    function getSelectorForElement(element: Element): string {
        // Create a basic selector for the element
        if (element.id) return `#${element.id}`
        if (element.className) return `.${element.className.split(' ')[0]}`
        return element.tagName.toLowerCase()
    }
}
