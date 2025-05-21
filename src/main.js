import _ from 'lodash'
import { eventBus } from '@/core/event-bus'
import { ConfigService } from '@/services/config.service'
import { moduleSystem } from '@/core/module-system'
import { LoggerService } from '@/services/logger.service'
const logger = new LoggerService('Main')
import { detectivePageType } from '@/utils/common'
// import { styles } from '@/shared/styles'
import pkg from '../package.json' with { type: 'json' }
window._ = _
const initializeApp = () => {
    ConfigService.initialize().then(() => {
        logger.debug('ConfigService 初始化完成')
        return detectivePageType()
    }).then(currentModuleType => {
        logger.debug(`页面类型: ${currentModuleType}`)
        const moduleMap = {
            'live': () => import('@/modules/live/live.module.js'),
            'follow': () => import('@/modules/follow/follow.module.js'),
            'search': () => import('@/modules/search/search.module.js')
        }
        if (moduleMap[currentModuleType]) {
            return moduleMap[currentModuleType]().then(module => {
                const moduleConfig = module.default
                logger.debug(`注册模块: ${moduleConfig.name}`)
                moduleSystem.register(moduleConfig)
            })
        } else {
            logger.error(`No module found for type: ${currentModuleType}`)
        }
    }).then(() => moduleSystem.init()).then(() => {
        logger.info('应用初始化完成')
        eventBus.emit('app:ready')
    }).catch(error => {
        logger.error('应用初始化失败', error)
    })
}
// insertStyleToDocument({ 'BilibiliAdjustmentStyle': styles.BilibiliAdjustment })
initializeApp()
setTimeout(() => {
    // promptForUpdate(pkg.version, pkg.updates).catch(error => {
    //     logger.error('检查更新失败', error)
    // })
}, 0)
