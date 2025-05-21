/* global requestAnimationFrame,_ */
import { shadowDOMHelper } from '@/utils/shadowDOMHelper'
import { eventBus } from '@/core/event-bus'
import { storageService } from '@/services/storage.service'
import { LoggerService } from '@/services/logger.service'
// import { SettingsComponent } from '@/components/settings.component'
// import { shadowDomSelectors, elementSelectors } from '@/shared/element-selectors'
import { executeFunctionsSequentially } from '@/utils/common'
// import { styles } from '@/shared/styles'
// import { getTemplates } from '@/shared/templates'
const logger = new LoggerService('FollowModule')
// const settingsComponent = new SettingsComponent()
export default {
    name: 'follow',
    version: '0.0.1',
    async install () {
        // insertStyleToDocument({ 'BodyOverflowHiddenStyle': styles.BodyOverflowHidden })
        eventBus.on('app:ready', async () => {
            logger.info('关注模块｜已加载')
            await this.preFunctions()
        })
    },
    handleExecuteFunctionsSequentially () {
        const functions = [
        ]
        executeFunctionsSequentially(functions)
    }
}
