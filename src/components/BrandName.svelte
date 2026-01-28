<script>
  export let className = ''
</script>

<span class={`brand-name ${className}`.trim()}>
  <span class="brand-initial">M</span>-Prescribe
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
</style>
