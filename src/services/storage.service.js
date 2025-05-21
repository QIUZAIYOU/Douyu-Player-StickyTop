import { createIndexedDBService } from '@/services/indexdb.service'
import { LoggerService } from '@/services/logger.service'
export class StorageService {
    static #instance
    #dbs
    #logger
    #dbConfig = {
        user: {
            dbName: 'DouyuPlayerStickyTopConfigs',
            version: 2,
            storeConfig: [
                {
                    name: 'keyval',
                    keyPath: 'key',
                    indexes: [
                        {
                            name: 'by_timestamp',
                            keyPath: 'timestamp',
                            unique: false
                        }
                    ]
                }
            ]
        }
    }
    constructor () {
        if (!window.indexedDB) {
            throw new Error('浏览器不支持 IndexedDB')
        }
        if (StorageService.#instance) {
            return StorageService.#instance
        }
        this.#logger = new LoggerService('StorageService')
        this.#dbs = new Map()
        Object.entries(this.#dbConfig).forEach(([name, config]) => {
            this.#dbs.set(name, createIndexedDBService(config))
        })
        StorageService.#instance = this
    }
    async init () {
        try {
            for (const [name, db] of this.#dbs) {
                await db.connect()
                if (!db.isStoreExists('keyval')) {
                    throw new Error(`数据库 ${name} 初始化丨数据表不存在`)
                }
            }
            this.#logger.debug('数据库集群初始化丨成功')
        } catch (error) {
            this.#logger.error('数据库集群初始化丨失败', error)
            throw error
        }
    }
    async set (dbName, key, value) {
        const db = this.#dbs.get(dbName)
        await db.update('keyval', { key, value, timestamp: Date.now() })
    }
    async get (dbName, key) {
        const db = this.#dbs.get(dbName)
        return db.get('keyval', key).then(data => data?.value)
    }
    userSet (key, value) { return this.set('user', key, value) }
    userGet (key) { return this.get('user', key) }
    async getAll (dbName, indexName, queryRange, pageSize) {
        const db = this.#dbs.get(dbName)
        const result = await db.getAll('keyval', indexName, queryRange, pageSize)
        return result.results
    }
    async getAllRaw (dbName, indexName, queryRange, pageSize) {
        const db = this.#dbs.get(dbName)
        const result = await db._executeCursorQuery('keyval', indexName, queryRange, pageSize)
        return result.results.map(item => ({
            key: item.key,
            value: item.value,
            timestamp: item.timestamp
        }))
    }
    async getByTimeRange (startTime, endTime, pageSize = 100) {
        const range = IDBKeyRange.bound(startTime, endTime)
        return this.getAll('by_timestamp', range, pageSize)
    }
    async batchSet (dbName, configsArray) {
        const db = this.#dbs.get(dbName)
        for (const config of configsArray) {
            const { key, value } = config
            await db.update('keyval', { key, value, timestamp: Date.now() })
        }
    }
    async getCount (dbName, range) {
        const db = this.#dbs.get(dbName, range)
        return db.count('keyval')
    }
    async clear (dbName) {
        const db = this.#dbs.get(dbName)
        return db.clear('keyval')
    }
}
export const storageService = new StorageService()
