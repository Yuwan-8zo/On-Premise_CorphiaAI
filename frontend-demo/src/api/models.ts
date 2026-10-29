/** Mock Models API */
import { DEMO_MODELS } from '../demo/mockData'
import type { ModelItem } from './models.types'

export type { ModelItem }

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

const mockModelsApi = {
    getModels: async () => {
        await sleep(300)
        return { models: DEMO_MODELS as ModelItem[], current_model: DEMO_MODELS[0].name, models_dir: 'ai_models' }
    },
    selectModel: async (name: string) => {
        await sleep(800)
        return { success: true, model: name }
    },
    refreshModels: async () => {
        await sleep(1000)
        return { models: DEMO_MODELS as ModelItem[], current_model: DEMO_MODELS[0].name, models_dir: 'ai_models' }
    },
}

export const getModels = mockModelsApi.getModels
export const selectModel = mockModelsApi.selectModel
export const refreshModels = mockModelsApi.refreshModels
export default mockModelsApi
