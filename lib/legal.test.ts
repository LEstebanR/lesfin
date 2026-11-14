import { describe, expect, test } from 'bun:test'

import { legalDocuments } from './legal'

describe('legal documents', () => {
  for (const [kind, byLanguage] of Object.entries(legalDocuments)) {
    test(`${kind} has the same structure in English and Spanish`, () => {
      const shape = (doc: (typeof byLanguage)['en']) =>
        doc.sections.map((section) =>
          section.blocks.map((block) =>
            Array.isArray(block) ? block.length : 'p'
          )
        )

      expect(shape(byLanguage.es)).toEqual(shape(byLanguage.en))
    })
  }
})
