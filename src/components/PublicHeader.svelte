<script>
  import BrandName from './BrandName.svelte'
</script>

<header class="w-full">
  <div class="max-w-6xl mx-auto px-6 py-3">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <a href="/" class="inline-flex items-center gap-2 text-teal-700 font-semibold">
        <img
          src="/favicon-32x32.png"
          alt="M-Prescribe"
          class="h-6 w-6"
          loading="lazy"
        />
        <BrandName className="text-teal-600" />
      </a>
      <nav class="flex flex-wrap items-center gap-2 sm:gap-3 text-sm font-semibold text-gray-600">
        <a href="/" class="hover:text-teal-700">Home</a>
        <a href="/?pricing=1" class="hover:text-teal-700">Pricing</a>
        <a href="/?faq=1" class="hover:text-teal-700">FAQ</a>
        <a href="/?contact=1" class="hover:text-teal-700">Contact us</a>
        <a
          href="/?register=1#signin"
          class="hidden sm:inline-flex rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
        >
          Login
        </a>
        <a
          href="/?register=1#signin"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:text-teal-700 hover:border-teal-200 sm:hidden"
          aria-label="Login"
          title="Login"
        >
          <i class="fas fa-sign-in-alt"></i>
        </a>
      </nav>
    </div>
  </div>
</header>
