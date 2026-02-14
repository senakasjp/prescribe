import { describe, expect, it } from 'vitest'
import { splitTitleFromName } from '../../utils/patientName.js'

describe('splitTitleFromName', () => {
  it('extracts Dr title', () => {
    expect(splitTitleFromName('Dr Silva')).toEqual({ title: 'Dr', firstName: 'Silva' })
  })

  it('extracts Prof title', () => {
    expect(splitTitleFromName('Prof Perera')).toEqual({ title: 'Prof', firstName: 'Perera' })
  })

  it('extracts Rev. title', () => {
    expect(splitTitleFromName('Rev. Fernando')).toEqual({ title: 'Rev.', firstName: 'Fernando' })
  })

  it('accepts dotted aliases for doctor and professor', () => {
    expect(splitTitleFromName('Dr. Jayasuriya')).toEqual({ title: 'Dr.', firstName: 'Jayasuriya' })
    expect(splitTitleFromName('Prof. Dias')).toEqual({ title: 'Prof.', firstName: 'Dias' })
  })
})

