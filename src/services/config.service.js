import { LoggerService } from '@/services/logger.service'
import { storageService } from '@/services/storage.service'
export class ConfigService {
    static #logger = new LoggerService('ConfigService')
    static #initialized = false
    static #cache = new Map()
    static DEFAULT_VALUES = new Map([
        ['current_screen_mod', 'normal'],
        ['selected_screen_mod', 'webfullscreen'],
        ['auto_web_full_screen', true],
        ['auto_select_video_highest_quality', true],
        ['auto_select_danmu_options', true],
        ['auto_block_gift_effect', true]
    ])
    static async initialize () {
        if (this.#initialized) return
        try {
            await storageService.init()
            this.#initialized = true
        } catch (error) {
            this.#logger.error('配置服务初始化失败', error)
            throw error
        }
    }
    static async initializeDefaults () {
        if (!this.#initialized) {
            await this.initialize()
        }
        try {
            for (const [key, defaultValue] of this.DEFAULT_VALUES.entries()) {
                const currentValue = await storageService.userGet(key)
                if (currentValue === null || currentValue === undefined) {
                    await this.setValue(key, defaultValue)
                }
            }
            this.#logger.debug('默认配置初始化完成')
        } catch (error) {
            this.#logger.error('默认配置初始化失败', error)
            throw error
        }
    }
    static async getValue (name) {
        if (!this.#initialized) {
            await this.initialize()
        }
        try {
            if (this.#cache.has(name)) {
                return this.#cache.get(name)
            }
            const value = await storageService.userGet(name)
            if (value === null || value === undefined) {
                const defaultValue = this.DEFAULT_VALUES.get(name)
                if (defaultValue !== undefined) {
                    await this.setValue(name, defaultValue)
                    return defaultValue
                }
                return null
            }
            this.#cache.set(name, value)
            return value
        } catch (error) {
            this.#logger.error('配置读取失败', error)
            return null
        }
    }
    static async setValue (name, value) {
        if (!this.#initialized) {
            await this.initialize()
        }
        try {
            this.#cache.set(name, value)
            await storageService.userSet(name, value)
        } catch (error) {
            this.#cache.delete(name)
            this.#logger.error('配置存储失败', error)
            throw error
        }
    }
    static clearCache () {
        this.#cache.clear()
    }
}
export const configService = new ConfigService()
