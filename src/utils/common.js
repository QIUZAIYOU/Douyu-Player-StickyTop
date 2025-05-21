/* global _ */
import { LoggerService } from '@/services/logger.service'
const logger = new LoggerService('Common')
export const detectivePageType = () => {
    const { host, pathname, origin } = window.location
    if (pathname.startsWith('/topic/')) return 'live'
    if (pathname.startsWith('/directory/MyFollow')) return 'follow'
    if (pathname.startsWith('/search/')) return 'search'
    return 'other'
}
export const isAsyncFunction = targetFunction => _.isFunction(targetFunction) && targetFunction[Symbol.toStringTag] === 'AsyncFunction'
export const executeFunctionsSequentially = async (
    functionsArray,
    options = { concurrency: 1, continueOnError: false }
) => {
    const { concurrency, continueOnError } = options
    const chunks = _.chunk(functionsArray, concurrency)
    const results = []
    for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
            chunk.map(async func => {
                try {
                    const result = isAsyncFunction(func)
                        ? await func()
                        : func()
                    if (result?.callback) {
                        await executeFunctionsSequentially(result.callback, options)
                    }
                    return result
                } catch (error) {
                    logger.error('函数执行失败:', error)
                    if (!continueOnError) throw error
                    return null
                }
            })
        )
        results.push(...chunkResults)
    }
    return results
}
