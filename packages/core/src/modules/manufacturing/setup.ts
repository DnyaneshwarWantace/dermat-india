import type { ModuleSetupConfig } from '@wantace/shared/modules/setup'
import { ProductionStageTemplate } from './data/entities'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'manufacturing.*',
    ],
    employee: [
      'manufacturing.work_centers.view',
      'manufacturing.machines.view',
      'manufacturing.bom.view',
      'manufacturing.production_orders.view',
      'manufacturing.production_stages.view',
      'manufacturing.material_consumption.view',
      'manufacturing.quality_inspections.view',
      'manufacturing.stage_templates.view',
    ],
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    const existing = await em.count(ProductionStageTemplate, { organizationId, deletedAt: null })
    if (existing > 0) return

    const defaults = [
      { name: 'Preparation', code: 'PREP', sequenceNumber: 1, description: 'Material preparation and setup' },
      { name: 'Processing', code: 'PROC', sequenceNumber: 2, description: 'Main production processing' },
      { name: 'Quality Check', code: 'QC', sequenceNumber: 3, description: 'Quality inspection before completion', requiresQualityCheck: true },
    ]

    for (const tmpl of defaults) {
      em.create(ProductionStageTemplate, {
        ...tmpl,
        organizationId,
        tenantId,
        isActive: true,
        estimatedSetupMinutes: '0',
        estimatedRunMinutes: '0',
        requiresQualityCheck: tmpl.requiresQualityCheck ?? false,
      })
    }
    await em.flush()
  },

  async seedExamples({ em, tenantId, organizationId }) {
    // Demo BOMs and machines will be seeded here
  },
}

export default setup
