<script>
  import { createEventDispatcher } from 'svelte'

  export let value = ''
  export let id = ''
  export let name = ''
  export let type = 'text'
  export let className = ''
  export let disabled = false
  export let required = false
  export let placeholder = 'dd/mm/yyyy'
  export let min = ''
  export let max = ''
  export let ariaLabel = ''

  const dispatch = createEventDispatcher()
  let restProps = {}
  let restClass = ''
  let inputClass = ''
  let displayValue = ''

  const toDisplay = (iso) => {
    if (!iso) return ''
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [year, month, day] = iso.split('-')
      return `${day}/${month}/${year}`
    }
    return iso
  }

  const toIso = (value) => {
    if (value === null || value === undefined || value === '') return ''
    const normalized = typeof value === 'string' ? value : String(value)
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
    const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return ''
    const [, partA, partB, year] = match
    const numA = Number(partA)
    const numB = Number(partB)
    // If one part is > 12, infer day/month accordingly. Otherwise default to dd/mm.
    const day = numA > 12 ? partA : (numB > 12 ? partB : partA)
    const month = numA > 12 ? partB : (numB > 12 ? partA : partB)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  $: {
    const iso = toIso(displayValue)
    if (value !== iso) {
      displayValue = toDisplay(value)
    }
  }

  let dateValue = ''
  $: dateValue = toIso(value)

  $: ({ class: restClass = '', ...restProps } = $$restProps)
  $: inputClass = className || restClass || ''

  const handleInput = (event) => {
    displayValue = event.target.value
    const iso = toIso(displayValue)
    if (iso || displayValue === '') {
      dispatch('input', iso)
    }
  }

  const handleBlur = () => {
    const iso = toIso(displayValue)
    if (iso) {
      dispatch('change', { value: iso, display: displayValue })
    }
  }
</script>

{#if type === 'date'}
  <input
    type="date"
    {id}
    {name}
    {...restProps}
    class={inputClass}
    value={dateValue}
    {disabled}
    {required}
    {min}
    {max}
    placeholder={placeholder}
    aria-label={ariaLabel}
    on:input={(event) => dispatch('input', event.target.value)}
    on:blur={() => dispatch('change', { value: dateValue, display: dateValue })}
  />
{:else}
  <input
    type="text"
    {id}
    {name}
    {...restProps}
    class={inputClass}
    bind:value={displayValue}
    {disabled}
    {required}
    {min}
    {max}
    placeholder={placeholder}
    aria-label={ariaLabel}
    inputmode="numeric"
    pattern="\\d{2}/\\d{2}/\\d{4}"
    on:input={handleInput}
    on:blur={handleBlur}
  />
{/if}
