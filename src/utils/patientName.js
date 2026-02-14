export const splitTitleFromName = (rawName) => {
  const TITLE_OPTIONS = ['Mr', 'Ms', 'Master', 'Baby', 'Dr', 'Prof', 'Rev.', 'Dr.', 'Prof.', 'Rev']
  const trimmed = String(rawName || '').trim()
  for (const title of TITLE_OPTIONS) {
    if (trimmed.startsWith(`${title} `)) {
      return { title, firstName: trimmed.slice(title.length + 1).trim() }
    }
  }
  return { title: '', firstName: trimmed }
}
