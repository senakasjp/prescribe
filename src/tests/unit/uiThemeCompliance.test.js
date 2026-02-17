import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()

const readFile = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

const walkFiles = (relativeDir) => {
  const absoluteDir = path.join(ROOT, relativeDir)
  const results = []

  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      results.push(path.relative(ROOT, absolutePath).replace(/\\/g, '/'))
    }
  }

  walk(absoluteDir)
  return results
}

describe('UI Theme Compliance - Small Theme + Tailwind/Flowbite', () => {
  it('keeps Flowbite runtime and Tailwind plugin configuration aligned', () => {
    const tailwindConfig = readFile('tailwind.config.js')
    const mainJs = readFile('src/main.js')
    const indexHtml = readFile('index.html')

    expect(tailwindConfig).toMatch(/flowbite\/plugin/)
    expect(tailwindConfig).toMatch(/@tailwindcss\/forms/)
    expect(tailwindConfig).toMatch(/node_modules\/flowbite\/\*\*\/\*\.js/)

    expect(mainJs).toMatch(/flowbite\/dist\/flowbite\.min\.js/)
    expect(indexHtml).not.toMatch(/cdnjs\.cloudflare\.com\/ajax\/libs\/flowbite/i)
  })

  it('enforces dark mode infrastructure with light default and persisted selection', () => {
    const tailwindConfig = readFile('tailwind.config.js')
    const mainJs = readFile('src/main.js')
    const appSvelte = readFile('src/App.svelte')

    expect(tailwindConfig).toMatch(/darkMode:\s*['"]class['"]/)
    expect(mainJs).toMatch(/prescribe-theme-mode'\)\s*\|\|\s*'light'/)
    expect(mainJs).toMatch(/mode === 'dark'/)

    expect(appSvelte).toMatch(/THEME_MODE_STORAGE_KEY\s*=\s*'prescribe-theme-mode'/)
    expect(appSvelte).toMatch(/let themeMode = 'light'/)
    expect(appSvelte).toMatch(/localStorage\.getItem\(THEME_MODE_STORAGE_KEY\)\s*\|\|\s*'light'/)
    expect(appSvelte).toMatch(/localStorage\.setItem\(THEME_MODE_STORAGE_KEY,\s*mode\)/)
    expect(appSvelte).toMatch(/classList\.toggle\('dark',\s*isDarkTheme\)/)
  })

  it('keeps the global small-theme CSS contract for form controls and buttons', () => {
    const appCss = readFile('src/app.css')

    expect(appCss).toMatch(/body\s*\{[^}]*text-sm[^}]*\}/s)
    expect(appCss).toMatch(/input:not\(\[type='checkbox'\]\)/)
    expect(appCss).toMatch(/select,\s*textarea/s)
    expect(appCss).toMatch(/focus:ring-cyan-500/)
    expect(appCss).toMatch(/button\s*\{[^}]*text-sm[^}]*\}/s)
  })

  it('keeps global dark override tokens for light-first components', () => {
    const appCss = readFile('src/app.css')
    const requiredOverrides = [
      'html.dark .bg-white',
      'html.dark .bg-gray-50',
      'html.dark .bg-gray-100',
      'html.dark .text-gray-900',
      'html.dark .text-gray-800',
      'html.dark .text-gray-700',
      'html.dark .text-gray-600',
      'html.dark .text-gray-500',
      'html.dark .border-gray-200',
      'html.dark .border-gray-300'
    ]

    requiredOverrides.forEach((selector) => {
      expect(appCss).toContain(selector)
    })
  })

  it('requires light-first utility tokens to have dark support (component dark:* or global override)', () => {
    const appCss = readFile('src/app.css')
    const globallySupported = new Set([
      'bg-white',
      'bg-gray-50',
      'bg-gray-100',
      'text-gray-900',
      'text-gray-800',
      'text-gray-700',
      'text-gray-600',
      'text-gray-500',
      'border-gray-200',
      'border-gray-300'
    ])
    const files = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const tokenRegex = /\b(bg-white|bg-gray-50|bg-gray-100|text-gray-900|text-gray-800|text-gray-700|text-gray-600|text-gray-500|border-gray-200|border-gray-300)\b/g
    const offenders = []

    for (const file of files) {
      const content = readFile(file)
      const hasDarkUtility = /\bdark:/.test(content)
      const tokens = new Set(content.match(tokenRegex) || [])
      if (tokens.size === 0) continue
      if (hasDarkUtility) continue

      const unsupported = [...tokens].filter((token) => !globallySupported.has(token))
      if (unsupported.length > 0) {
        offenders.push(`${file} -> ${unsupported.join(',')}`)
      }
    }

    // Safety assertion so future edits don't silently remove the global contract.
    globallySupported.forEach((token) => {
      const tokenSelector = token.replace(/([[\]])/g, '\\$1')
      expect(appCss).toMatch(new RegExp(`html\\.dark \\.${tokenSelector}`))
    })

    expect(offenders).toEqual([])
  })

  it('requires responsive sm: usage across every Svelte component', () => {
    const svelteFiles = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const filesWithoutSm = svelteFiles.filter((file) => !readFile(file).includes('sm:'))
    expect(filesWithoutSm).toEqual([])
  })

  it('requires class-bearing components to include sm: responsive utilities', () => {
    const svelteFiles = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const offenders = []

    for (const file of svelteFiles) {
      const content = readFile(file)
      const hasClassAttribute = /class\s*=/.test(content)
      if (!hasClassAttribute) continue
      if (!/\bsm:/.test(content)) {
        offenders.push(file)
      }
    }

    expect(offenders).toEqual([])
  })

  it('requires class-bearing components to use Tailwind utility tokens', () => {
    const svelteFiles = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const offenders = []
    const tailwindUtilityPattern =
      /(^|\s)(sm:|md:|lg:|xl:|2xl:|text-|bg-|border|rounded|p[trblxy]?-[\d[]|m[trblxy]?-[\d[]|flex|grid|gap-|items-|justify-|w-|h-|min-|max-|overflow-|shadow|ring-|font-|leading-|tracking-|inline-flex|space-[xy]-|divide-)/

    for (const file of svelteFiles) {
      const content = readFile(file)
      const hasClassAttribute = /class\s*=/.test(content)
      if (!hasClassAttribute) continue
      if (!tailwindUtilityPattern.test(content)) {
        offenders.push(file)
      }
    }

    expect(offenders).toEqual([])
  })

  it('avoids legacy bootstrap layout tokens in class attributes', () => {
    const svelteFiles = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const offenders = []
    const classRegex = /class\s*=\s*"([^"]+)"/g

    for (const file of svelteFiles) {
      const content = readFile(file)
      const matches = content.matchAll(classRegex)

      for (const match of matches) {
        const tokens = new Set(String(match[1]).split(/\s+/).filter(Boolean))
        if (tokens.has('row') || [...tokens].some((token) => /^col-\d+$/.test(token))) {
          offenders.push(file)
          break
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('avoids legacy bootstrap utility tokens in class attributes and generated HTML fragments', () => {
    const svelteFiles = walkFiles('src').filter((file) => file.endsWith('.svelte'))
    const offenders = []
    const classRegex = /class\s*=\s*"([^"]+)"/g
    const forbiddenUtilities = new Set(['fw-bold', 'fw-semibold', 'fst-italic', 'small'])

    for (const file of svelteFiles) {
      const content = readFile(file)
      const matches = content.matchAll(classRegex)
      let fileHasForbiddenUtility = false

      for (const match of matches) {
        const tokens = String(match[1]).split(/\s+/).filter(Boolean)
        if (tokens.some((token) => forbiddenUtilities.has(token))) {
          fileHasForbiddenUtility = true
          break
        }
      }

      if (fileHasForbiddenUtility) {
        offenders.push(file)
      }
    }

    expect(offenders).toEqual([])
  })
})
