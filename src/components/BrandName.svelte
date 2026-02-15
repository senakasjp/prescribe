<script>
  export let className = ''
</script>

<span class={`brand-name sm:text-sm ${className}`.trim()}>
  <span class="brand-initial">M</span><span class="brand-rest">-PRESCRIBE</span>
</span>

<style>
  .brand-name {
    display: inline-flex;
    align-items: baseline;
    gap: 0;
  }

  .brand-initial {
    color: #dc2626;
    font-weight: 800;
  }

  .brand-rest {
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
