class ShadowDOMHelper {
    static #shadowRoots = new WeakMap()
    static #observers = new WeakMap()
    static #selectorCache = new Map()
    static #processedElements = new WeakSet()
    static #MAX_CACHE_SIZE = 100
    // ==================== 核心初始化 ====================
    static init () {
        if (this.initialized) return
        if (Element.prototype.attachShadow?.__monkeyPatched) return
        const originalAttachShadow = Element.prototype.attachShadow
        Element.prototype.attachShadow = function (options) {
            const shadowRoot = originalAttachShadow.call(this, options)
            ShadowDOMHelper.#shadowRoots.set(this, shadowRoot)
            return shadowRoot
        }
        Element.prototype.attachShadow.__monkeyPatched = true
        this.initialized = true
        this.#processExistingElements()
    }
    static #processExistingElements () {
        const walker = document.createTreeWalker(
            document.documentElement,
            NodeFilter.SHOW_ELEMENT
        )
        let currentNode
        while ((currentNode = walker.nextNode())) {
            if (currentNode.shadowRoot && !this.#shadowRoots.has(currentNode)) {
                this.#shadowRoots.set(currentNode, currentNode.shadowRoot)
            }
        }
    }
    // ==================== DOM 查询 ====================
    static getShadowRoot (host) {
        return host.shadowRoot ?? this.#shadowRoots.get(host) ?? null
    }
    static querySelector (host, selector) {
        return this.#query(host, selector, false)[0] || null
    }
    static querySelectorAll (host, selector) {
        return this.#query(host, selector, true)
    }
    static #filterElement (node) {
        return (
            node.nodeType === Node.ELEMENT_NODE &&
            node.namespaceURI === 'http://www.w3.org/1999/xhtml'
        )
    }
    static batchQuery (host, queries, options = {}) {
        const { deconstruct = false } = options
        const results = {}
        const queryEntries = Object.entries(queries)
        queryEntries.forEach(([key, selector]) => {
            results[key] = this.querySelectorAll(host, selector)
        })
        return deconstruct ? results : [...new Set(Object.values(results).flat())]
    }
    static #query (host, selector, findAll) {
        this.#validateSelector(selector)
        const parts = this.#parseSelector(selector)
        let elements = [host]
        for (const part of parts) {
            const newElements = []
            for (const el of elements) {
                if (!this.#filterElement(el)) break
                const contexts = this.#getQueryContexts(el, part)
                contexts.forEach(context => {
                    try {
                        const root = this.getShadowRoot(context)
                        const matches = root?.querySelectorAll(part.selector) ?? context.querySelectorAll(part.selector)
                        newElements.push(...matches)
                    } catch (error) {
                        console.error(`选择器错误: "${part.selector}"`, error)
                        throw error
                    }
                })
            }
            elements = [...new Set(newElements)]
            if (!findAll && elements.length === 0) break
        }
        return findAll ? elements : elements.slice(0, 1)
    }
    static #getQueryContexts (el, part) {
        const contexts = []
        if (part.isShadow) {
            const result = this.#deepQueryAll(el)
            contexts.push(el, ...result)
        } else {
            contexts.push(el)
        }
        return contexts
    }
    // ==================== 实时监控增强 ====================
    static watchQuery (host, selector, callback, options = {}) {
        const {
            nodeNameFilter,
            checkHostTree = true,
            observeExisting = true,
            debounce = 50,
            maxRetries = 3,
            scanInterval = 0,
            allowReprocess = false
        } = options
        if (!nodeNameFilter && !selector) {
            throw new Error('必须提供 selector 或 nodeNameFilter')
        }
        let observer
        try {
            observer = new MutationObserver(this.#debounceHandler(debounce, mutations => {
                mutations.flatMap(m => [...m.addedNodes])
                    .forEach(node => this.#processNode(node, host, selector, callback, {
                        nodeNameFilter,
                        checkHostTree,
                        maxRetries,
                        allowReprocess
                    }))
            }))
        } catch (error) {
            console.error('创建MutationObserver失败:', error)
            throw error
        }
        let intervalId
        if (scanInterval > 0) {
            intervalId = setInterval(() => {
                this.#deepScanExisting(host, selector, callback, {
                    nodeNameFilter,
                    checkHostTree,
                    allowReprocess
                })
            }, scanInterval)
        }
        const cleanup = () => {
            observer.disconnect()
            intervalId && clearInterval(intervalId)
            this.#observers.delete(host)
            if (!allowReprocess) {
                this.#processedElements = new WeakSet()
            }
        }
        this.#observers.set(host, { observer, callback, cleanup })
        observer.observe(this.getShadowRoot(host) ?? host, {
            childList: true,
            subtree: true
        })
        if (observeExisting) {
            this.#deepScanExisting(host, selector, callback, {
                nodeNameFilter,
                checkHostTree,
                allowReprocess
            })
        }
        return cleanup
    }
    /**
     * 深度扫描现有元素（新增方法）
     */
    static #deepScanExisting (host, selector, callback, options) {
        const { nodeNameFilter, checkHostTree, allowReprocess } = options
        const scanner = root => {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: node => {
                        if (!this.#filterElement(node)) return NodeFilter.FILTER_REJECT
                        if (this.#isAlreadyProcessed(node, allowReprocess)) return NodeFilter.FILTER_REJECT
                        const nameMatch = nodeNameFilter &&
                            node.nodeName === nodeNameFilter.toUpperCase()
                        const selectorMatch = selector && node.matches(selector)
                        return (nameMatch || selectorMatch)
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_SKIP
                    }
                }
            )
            let currentNode
            while ((currentNode = walker.nextNode())) {
                if (checkHostTree && !this.#isInHostTree(currentNode, host)) continue
                this.#markAsProcessed(currentNode)
                this.#safeCallback(callback, currentNode)
            }
        }
        scanner(host.shadowRoot ?? host)
        this.#getAllShadowRoots(host).forEach(root => scanner(root))
    }
    /**
     * 获取所有嵌套的Shadow Root（新增方法）
     */
    static #getAllShadowRoots (host) {
        const roots = new Set()
        const stack = [host]
        while (stack.length > 0) {
            const current = stack.pop()
            const shadowRoot = this.getShadowRoot(current)
            if (!shadowRoot) continue
            roots.add(shadowRoot)
            stack.push(...shadowRoot.querySelectorAll('*'))
        }
        return [...roots]
    }
    static #processNode (node, host, selector, callback, options) {
        const { nodeNameFilter, allowReprocess } = options
        if (!this.#filterElement(node)) return
        if (this.#isAlreadyProcessed(node, allowReprocess)) return
        this.#markAsProcessed(node)
        if (nodeNameFilter) {
            if (node.nodeName === nodeNameFilter.toUpperCase()) {
                this.#safeCallback(callback, node)
            }
            return
        }
        if (this.#isFullMatch(node, host, selector)) {
            this.#safeCallback(callback, node)
        }
    }
    // 优化后的 #deepQueryAll 方法
    static #deepQueryAll (element) {
        const results = []
        const visited = new WeakSet()
        const stack = [element]
        while (stack.length > 0) {
            const el = stack.pop()
            if (!this.#filterElement(el) || visited.has(el)) continue
            visited.add(el)
            const shadowRoot = this.getShadowRoot(el)
            if (!shadowRoot) continue
            const children = Array.from(shadowRoot.children).filter(this.#filterElement)
            results.push(...children)
            stack.push(...children)
        }
        return results
    }
    static cleanup () {
        this.#shadowRoots = new WeakMap()
        this.#observers = new WeakMap()
        this.#selectorCache.clear()
        this.#processedElements = new WeakSet()
    }
    static #isFullMatch (element, host, selector) {
        try {
            const parts = [...this.#parseSelector(selector)].reverse()
            let current = element
            for (const part of parts) {
                const parent = part.isShadow ? current.getRootNode().host : current.parentElement
                if (!parent?.matches(part.selector)) return false
                current = parent
            }
            return current === host
        } catch {
            return false
        }
    }
    // ==================== 样式操作 ====================
    static addStyle (host, selector, styles, options = {}) {
        const { isolate = true, mode = 'append', priority = 'low' } = options
        const targets = this.querySelectorAll(host, selector)
        if (targets.length === 0) return false
        const styleStr = this.#parseStyles(styles)
        targets.forEach(target => {
            const styleTag = this.#getStyleTag(target, isolate)
            const rule = isolate ? `[${styleTag.dataset.uniqueAttr}] { ${styleStr} }` : styleStr
            this.#applyStyle(styleTag, rule, mode, priority)
        })
        return true
    }
    static #applyStyle (styleTag, rule, mode, priority) {
        if (mode === 'replace') {
            styleTag.textContent = rule
        } else {
            const method = priority === 'high' ? 'insertBefore' : 'appendChild'
            const textNode = document.createTextNode(rule)
            styleTag[method](textNode, styleTag.firstChild)
        }
    }
    static #parseStyles (styles) {
        if (typeof styles === 'string') {
            return styles.replace(/^\s*\{|\}\s*$/g, '').replace(/;(\s*})/g, '$1').trim()
        }
        if (typeof styles === 'object') {
            return Object.entries(styles)
                .map(([prop, value]) => `${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
                .join('; ')
        }
        throw new TypeError('样式必须是字符串或对象')
    }
    // ==================== 调试工具 ====================
    static debugQuery (host, selector) {
        console.groupCollapsed('[ShadowDOMHelper] 查询路径调试')
        const result = this.querySelector(host, selector)
        const parts = this.#parseSelector(selector)
        parts.forEach((part, index) => {
            console.group(`层级 ${index + 1}: ${part.isShadow ? 'Shadow' : 'DOM'} 选择器 "${part.selector}"`)
            console.info('上下文元素:', part.contexts)
            console.info('匹配元素:', part.results)
            console.groupEnd()
        })
        console.info('最终结果:', result)
        console.groupEnd()
        return result
    }
    static debugShadowRoot (host) {
        console.groupCollapsed('[ShadowDOMHelper] ShadowRoot 诊断')
        try {
            const root = this.getShadowRoot(host)
            console.info('宿主:', host)
            console.info('模式:', host.shadowRoot ? 'open' : 'closed')
            console.info('内容摘要:', root?.innerHTML?.slice(0, 200) + (root?.innerHTML?.length > 200 ? '...' : ''))
        } catch (error) {
            console.error('诊断失败:', error)
        }
        console.groupEnd()
    }
    // ==================== 私有工具方法 ====================
    static #parseSelector (selector) {
        if (this.#selectorCache.has(selector)) return this.#selectorCache.get(selector)
        const tokens = selector.split(/(\s*>>\s*|\s*>\s*)/g).map(t => t.trim()).filter(Boolean)
        const parts = []
        let isShadow = false, currentSelector = ''
        if (tokens.length === 1 && !['>>', '>'].includes(tokens[0])) {
            parts.push({ selector: tokens[0], isShadow: true })
        } else {
            tokens.forEach(token => {
                if (token === '>>') {
                    if (currentSelector) parts.push({ selector: currentSelector, isShadow: true })
                    currentSelector = ''
                    isShadow = true
                } else if (token === '>') {
                    if (currentSelector) parts.push({ selector: currentSelector, isShadow: false })
                    currentSelector = ''
                    isShadow = false
                } else currentSelector += token
            })
            if (currentSelector) parts.push({ selector: currentSelector, isShadow })
        }
        if (this.#selectorCache.size >= this.#MAX_CACHE_SIZE) {
            this.#selectorCache.delete(this.#selectorCache.keys().next().value)
        }
        this.#selectorCache.set(selector, parts)
        return parts
    }
    static #isInHostTree (element, host) {
        let root = element.getRootNode()
        while (root) {
            if (root === host.getRootNode()) return true
            root = root.host?.getRootNode()
        }
        return false
    }
    static #debounceHandler (delay, fn) {
        let timer
        return (...args) => {
            clearTimeout(timer)
            timer = setTimeout(() => fn(...args), delay)
        }
    }
    static #safeCallback (callback, el) {
        try {
            el?.isConnected && callback(el)
        } catch (error) {
            console.error('回调执行失败:', error)
        }
    }
    static #getStyleTag (element, isolate) {
        if (!this.#filterElement(element)) return null
        const shadowRoot = this.getShadowRoot(element) ?? element.attachShadow({ mode: 'open' });
        [...shadowRoot.childNodes].filter(c => c.nodeType === Node.COMMENT_NODE).forEach(c => c.remove())
        let styleTag = shadowRoot.querySelector('style[data-shadow-style]')
        if (!styleTag) {
            styleTag = document.createElement('style')
            styleTag.dataset.shadowStyle = true
            shadowRoot.prepend(styleTag)
            if (isolate) {
                const uniqueAttr = `s-${Math.random().toString(36).slice(2, 8)}`
                styleTag.dataset.uniqueAttr = uniqueAttr
                element.setAttribute(uniqueAttr, '')
            }
        }
        return styleTag
    }
    static #validateSelector (selector) {
        if (typeof selector !== 'string' || !selector.trim()) throw new TypeError('选择器必须是有效的非空字符串')
    }
    static #isAlreadyProcessed (node, allowReprocess) {
        return !allowReprocess && this.#processedElements.has(node)
    }
    static #markAsProcessed (node) {
        this.#processedElements.add(node)
    }
    // ==================== 辅助方法 ====================
    static async queryUntil (host, selector, options = {}) {
        const { timeout = 1000, findAll = false, interval = 50, forever = false } = options
        let elapsed = 0
        const start = Date.now()
        let lastResult = findAll ? [] : null
        while (forever || elapsed < timeout) {
            const result = findAll ?
                this.querySelectorAll(host, selector) :
                this.querySelector(host, selector)
            if (findAll ? result.length > 0 : result) {
                lastResult = result
                if (!forever) return result // 非永久模式立即返回
            }
            await new Promise(r => setTimeout(r, interval))
            elapsed = Date.now() - start
            if (forever && lastResult) break
        }
        if ((findAll && lastResult.length > 0) || (!findAll && lastResult)) {
            return lastResult
        }
        // console.warn(`查询超时: ${selector}，已尝试 ${(elapsed / 1000).toFixed(1)} 秒`)
        return findAll ? [] : null
    }
}
export const shadowDOMHelper = Object.freeze({
    querySelector: (host, selector) => ShadowDOMHelper.querySelector(host, selector),
    querySelectorAll: (host, selector) => ShadowDOMHelper.querySelectorAll(host, selector),
    batchQuery: (host, selector, callback) => ShadowDOMHelper.batchQuery(host, selector, callback),
    watchQuery: (host, selector, callback, options) => ShadowDOMHelper.watchQuery(host, selector, callback, options),
    addStyle: (host, selector, styles, options) => ShadowDOMHelper.addStyle(host, selector, styles, options),
    queryUntil: (host, selector, options) => ShadowDOMHelper.queryUntil(host, selector, options),
    debugQuery: (host, selector) => ShadowDOMHelper.debugQuery(host, selector),
    debugShadowRoot: host => ShadowDOMHelper.debugShadowRoot(host)
})
ShadowDOMHelper.init()
