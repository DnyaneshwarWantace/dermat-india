import { asValue } from 'awilix'
import type { AppContainer } from '@wantace/shared/lib/di/container'
import {
  WorkCenter,
  Machine,
  BillOfMaterials,
  BOMLine,
  BOMOperation,
} from './data/entities'

export function register(container: AppContainer) {
  container.register({
    WorkCenter: asValue(WorkCenter),
    Machine: asValue(Machine),
    BillOfMaterials: asValue(BillOfMaterials),
    BOMLine: asValue(BOMLine),
    BOMOperation: asValue(BOMOperation),
  })
}
