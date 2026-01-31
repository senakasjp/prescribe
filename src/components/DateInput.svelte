<script>
  import { createEventDispatcher } from 'svelte'

  export let value = ''
  export let id = ''
  export let name = ''
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
    if (!value) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return ''
    const [, day, month, year] = match
    return `${year}-${month}-${day}`
  }

  $: {
    const iso = toIso(displayValue)
    if (value !== iso) {
      displayValue = toDisplay(value)
    }
  }

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
  pattern="\d{2}/\d{2}/\d{4}"
  on:input={handleInput}
  on:blur={handleBlur}
/>
