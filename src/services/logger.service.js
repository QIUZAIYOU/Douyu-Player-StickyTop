const getPageTypePrefix = () => {
    const { host, pathname, origin } = window.location
    const strategies = [
        { test: () => /^\/topic\//.test(pathname), type: '直播间页调整' },
        { test: () => /^\/MyFollow\//.test(pathname), type: '关注页调整' },
        { test: () => /^\/search\//.test(pathname), type: '搜索结果页调整' }
    ]
    const matched = strategies.find(s => s.test())
    return matched?.type || '其他页调整'
}
export class LoggerService {
    static LEVELS = {
        info: 'color:white;background:#006aff;padding:2px;border-radius:2px',
        error: 'color:white;background:#f33;padding:2px;border-radius:2px',
        warn: 'color:white;background:#ff6d00;padding:2px;border-radius:2px',
        debug: 'color:white;background:#cc00ff;padding:2px;border-radius:2px'
    }
    static ENABLED_LEVELS = {
        info: true,
        error: true,
        warn: true,
        debug: import.meta.env.DEV
    }
    static PAGE_TYPE_PREFIX = getPageTypePrefix()
    constructor (module) {
        this.module = module
    }
    log (level, ...args) {
        if (LoggerService.ENABLED_LEVELS[level]) {
            console.log(`%c${LoggerService.PAGE_TYPE_PREFIX}${level === 'debug' ? `(调试)丨${this.module}` : import.meta.env.DEV ? ` ${this.module}` : ''}`, LoggerService.LEVELS[level], ...args)
        }
    }
    info (...args) {
        this.log('info', ...args)
    }
    error (...args) {
        this.log('error', ...args)
    }
    warn (...args) {
        this.log('warn', ...args)
    }
    debug (...args) {
        this.log('debug', ...args)
    }
}
