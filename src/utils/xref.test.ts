import { describe, expect, it } from 'vitest'

import { detectAxiomRefs } from './xref'

describe('detectAxiomRefs', () => {
  it('finds A1..A9 single-digit ids', () => {
    expect(detectAxiomRefs('see A1, A2, A9 for details', 'A14')).toEqual([
      'A1',
      'A2',
      'A9'
    ])
  })

  it('finds A10..A16 two-digit ids', () => {
    expect(detectAxiomRefs('related: A10, A14, A15, A16', 'A1')).toEqual([
      'A10',
      'A14',
      'A15',
      'A16'
    ])
  })

  it('excludes self-references', () => {
    expect(detectAxiomRefs('A1 talks about A1 and A14 only', 'A1')).toEqual([
      'A14'
    ])
  })

  it('de-duplicates repeated mentions', () => {
    expect(
      detectAxiomRefs('A14 mentioned, then A14 again, plus A15', 'A1')
    ).toEqual(['A14', 'A15'])
  })

  it('sorts numerically (A2 before A10)', () => {
    expect(detectAxiomRefs('A10, A2, A1', 'A16')).toEqual(['A1', 'A2', 'A10'])
  })

  it('respects word boundaries', () => {
    // `axiomA1Spec` should NOT match because of `\b`.
    expect(detectAxiomRefs('axiomA1Spec and A14 only', 'A1')).toEqual(['A14'])
  })

  it('ignores out-of-range ids like A17 and A99', () => {
    expect(detectAxiomRefs('A17 A99 A0 A14', 'A1')).toEqual(['A14'])
  })

  it('returns an empty array when no axioms appear', () => {
    expect(detectAxiomRefs('no refs here', 'A1')).toEqual([])
  })
})
