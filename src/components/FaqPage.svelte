<script>
  import BrandName from './BrandName.svelte'
  import PublicHeader from './PublicHeader.svelte'

  const faqItems = [
    {
      question: 'What are the advantages of this system over paper based method?',
      answerHtml: `Patient history management.<br>AI based treatment suggestions based on symptoms and reports.<br>AI based drug interaction check.<br>Barcode based patient identification.<br>Barcode based prescription identification.<br>Printing prescriptions, send prescription to own pharmacy assistant's phone/computer.<br>Maintaining a drug inventory.<br>Notification on drug finishing.<br>Send email and SMS notifications for next appointment.<br>Auto charge calculation for each patient.<br>Daily income and monthly income reports.`
    },
    {
      question: 'What is the minimum I need to start using this system?',
      answer: 'If you have a pharmacy assistant, you need a computer for you and at least a mobile phone for the pharmacy assistant, plus an internet connection. If you do not have a pharmacy assistant, you need a computer and a printer, plus an internet connection.'
    },
    {
      question: 'How much does it cost for me?',
      answerHtml: 'The first month is totally free with all facilities. From the second month, you will be charged according to the <a href=\"/?pricing=1\" class=\"text-teal-700 font-semibold underline\">pricing page</a>.'
    },
    {
      question: 'Where do I set procedure prices?',
      answer: 'Go to Settings → Procedures and update the default prices used during billing.'
    },
    {
      question: 'Why is the expected price different?',
      answer: 'Expected price uses your procedure pricing and discount rules. Final totals are calculated after pharmacy dispensing and rounding.'
    },
    {
      question: 'Can I send to multiple pharmacies?',
      answer: 'Yes. Connect pharmacies in the Pharmacies tab and choose the destination when sending a prescription.'
    },
    {
      question: 'How do I add my own pharmacy?',
      answer: 'Create the pharmacy account in the pharmacy portal (use the same email if you own it), then return to the doctor portal → Pharmacies tab and connect it.'
    },
    {
      question: 'Where can I see a patient’s history?',
      answer: 'Open the patient and use the Prescriptions and Reports tabs for full history.'
    }
  ]
</script>

<div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e6f7f4_0%,_#f9fafb_55%,_#f3f4f6_100%)]">
  <PublicHeader />
  <div class="max-w-5xl mx-auto px-6 py-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-teal-600 font-semibold">
          <BrandName className="text-teal-600" />
        </p>
        <h1 class="text-3xl sm:text-4xl font-semibold text-gray-900 font-hero">Frequently Asked Questions</h1>
        <p class="mt-2 text-sm text-gray-600">Quick answers for common workflow questions.</p>
      </div>
      <div></div>
    </div>

    <div class="space-y-4">
      {#each faqItems as item}
        <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 class="text-base font-semibold text-gray-900">{item.question}</h2>
          {#if item.answerHtml}
            <p class="mt-2 text-sm text-gray-600">{@html item.answerHtml}</p>
          {:else}
            <p class="mt-2 text-sm text-gray-600">{item.answer}</p>
          {/if}
        </div>
      {/each}
    </div>

    <footer class="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span>© Tronicgate Hardware and Software Services</span>
      <div class="flex items-center gap-4">
        <a href="/?privacy=1" class="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>
        <a href="/?pricing=1" class="text-blue-600 hover:text-blue-800 underline">Pricing</a>
        <a href="/?faq=1" class="text-blue-600 hover:text-blue-800 underline">FAQ</a>
        <a href="/?help=1" class="text-blue-600 hover:text-blue-800 underline">Help</a>
        <a href="/?contact=1" class="text-blue-600 hover:text-blue-800 underline">Contact us</a>
      </div>
    </footer>
  </div>
</div>
