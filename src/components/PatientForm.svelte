<script>
  import { createEventDispatcher } from 'svelte'
  import { phoneCountryCodes } from '../data/phoneCountryCodes.js'
  import { getDialCodeForCountry } from '../utils/phoneCountryCode.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/doctor/doctorAuthService.js'
  import ThreeDots from './ThreeDots.svelte'
  import DateInput from './DateInput.svelte'
  
  const dispatch = createEventDispatcher()
  export let defaultCountry = ''
  
  let firstName = ''
  let lastName = ''
  let title = ''
  let email = ''
  let phone = ''
  let phoneCountryCode = ''
  let phoneCodeTouched = false
  let gender = ''
  let dateOfBirth = ''
  let ageYears = ''
  let ageMonths = ''
  let ageDays = ''
  let weight = ''
  let bloodGroup = ''
  let idNumber = ''
  let disableNotifications = false
  let address = ''
  let allergies = ''
  let longTermMedications = ''
  let emergencyContact = ''
  let emergencyPhone = ''
  let error = ''
  let loading = false
  let improvingFields = {
    address: false,
    allergies: false,
    longTermMedications: false
  }
  let improvedFields = {
    address: false,
    allergies: false,
    longTermMedications: false
  }
  let lastImprovedValues = {
    address: '',
    allergies: '',
    longTermMedications: ''
  }

  const focusField = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  const normalizePhoneInput = (value, dialCode) => {
    const digitsOnly = String(value || '').replace(/\D/g, '')
    if (dialCode === '+94') {
      return digitsOnly.slice(0, 9)
    }
    return digitsOnly
  }

  $: if (defaultCountry && !phoneCodeTouched && !phoneCountryCode) {
    const resolved = getDialCodeForCountry(defaultCountry)
    if (resolved) {
      phoneCountryCode = resolved
    }
  }
  
  const calculateAgeParts = (birthDate) => {
    if (!birthDate) return { years: '', months: '', days: '' }
    const today = new Date()
    const birth = new Date(birthDate)
    let years = today.getFullYear() - birth.getFullYear()
    let months = today.getMonth() - birth.getMonth()
    let days = today.getDate() - birth.getDate()

    if (days < 0) {
      months -= 1
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      days += prevMonth.getDate()
    }

    if (months < 0) {
      years -= 1
      months += 12
    }
    return {
      years: years.toString(),
      months: months.toString(),
      days: days.toString()
    }
  }
  
  // Handle date of birth change to auto-calculate age
  const handleDateOfBirthChange = (value) => {
    const resolved = typeof value === 'string' ? value : (value?.detail?.value || value?.detail || dateOfBirth)
    if (resolved) {
      dateOfBirth = resolved
      const parts = calculateAgeParts(resolved)
      ageYears = parts.years
      ageMonths = parts.months
      ageDays = parts.days
    }
  }

  $: if (dateOfBirth) {
    const parts = calculateAgeParts(dateOfBirth)
    ageYears = parts.years
    ageMonths = parts.months
    ageDays = parts.days
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields - only first name and age are mandatory
      if (!firstName.trim()) {
        focusField('firstName')
        throw new Error('First name is required')
      }
      
      if (dateOfBirth) {
        const parts = calculateAgeParts(dateOfBirth)
        ageYears = parts.years
        ageMonths = parts.months
        ageDays = parts.days
      } else {
        const hasYears = String(ageYears || '').trim() !== ''
        const hasDays = String(ageDays || '').trim() !== ''
        if (!hasYears && !hasDays) {
          focusField('ageYears')
          throw new Error('Years is required. If not available, enter days.')
        }
      }
      
      // Validate email format only if email is provided
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          focusField('email')
          throw new Error('Please enter a valid email address')
        }
      }
      
      // Validate date of birth only if provided
      if (dateOfBirth) {
        const birthDate = new Date(dateOfBirth)
        const today = new Date()
        if (birthDate >= today) {
          focusField('dateOfBirth')
          throw new Error('Date of birth must be in the past')
        }
      }
      
      const patientData = {
        title: title.trim() || '',
        firstName: (title.trim() ? `${title.trim()} ${firstName.trim()}` : firstName.trim()),
        lastName: lastName.trim() || '',
        email: email.trim() || '',
        phone: phone.trim() || '',
        phoneCountryCode: phoneCountryCode.trim() || '',
        gender: gender || '',
        dateOfBirth: dateOfBirth || '',
        age: ageYears?.toString().trim() || '',
        ageMonths: ageMonths?.toString().trim() || '',
        ageDays: ageDays?.toString().trim() || '',
        ageType: 'ymd',
        weight: weight?.toString().trim() || '',
        bloodGroup: bloodGroup.trim() || '',
        idNumber: idNumber.trim() || '',
        disableNotifications: Boolean(disableNotifications),
        address: address.trim() || '',
        allergies: allergies.trim() || '',
        longTermMedications: longTermMedications.trim() || '',
        emergencyContact: emergencyContact.trim() || '',
        emergencyPhone: emergencyPhone.trim() || ''
      }
      
      dispatch('patient-added', patientData)
      
      // Reset form
      firstName = ''
      lastName = ''
      title = ''
      email = ''
      phone = ''
      phoneCountryCode = ''
      phoneCodeTouched = false
      gender = ''
      dateOfBirth = ''
      ageYears = ''
      ageMonths = ''
      ageDays = ''
      weight = ''
      bloodGroup = ''
      idNumber = ''
      disableNotifications = false
      address = ''
      allergies = ''
      longTermMedications = ''
      emergencyContact = ''
      emergencyPhone = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }

  const getDoctorIdForImprove = () => {
    const currentDoctor = authService.getCurrentDoctor()
    return currentDoctor?.id || currentDoctor?.uid || 'default-user'
  }

  const handleFieldEdit = (fieldKey, value) => {
    if (lastImprovedValues[fieldKey] && value !== lastImprovedValues[fieldKey]) {
      lastImprovedValues = { ...lastImprovedValues, [fieldKey]: '' }
      improvedFields = { ...improvedFields, [fieldKey]: false }
    }
  }

  const handleImproveField = async (fieldKey, currentValue, setter) => {
    if (!currentValue || !currentValue.trim()) {
      error = 'Please enter some text to improve'
      return
    }

    try {
      improvingFields = { ...improvingFields, [fieldKey]: true }
      error = ''
      const doctorId = getDoctorIdForImprove()
      const result = await openaiService.improveText(currentValue, doctorId)
      setter(result.improvedText)

      const normalizedImproved = String(result.improvedText ?? '').trim()
      lastImprovedValues = { ...lastImprovedValues, [fieldKey]: normalizedImproved }
      improvedFields = { ...improvedFields, [fieldKey]: normalizedImproved !== '' }

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving text:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingFields = { ...improvingFields, [fieldKey]: false }
    }
  }

</script>

<div class="bg-white rounded-lg shadow-lg border border-gray-200">
  <div class="bg-teal-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
    <h5 class="text-lg font-semibold mb-0">
      <i class="fas fa-user-plus mr-2"></i>
      Add New Patient
    </h5>
    <button on:click={handleCancel} class="text-white hover:text-gray-200">
      <i class="fas fa-times"></i>
    </button>
  </div>
  <div class="p-4">
    <form on:submit={handleSubmit}>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-user mr-1"></i>First Name <span class="text-red-600">*</span>
            </label>
            <div class="flex gap-2">
              <select
                id="title"
                class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={title}
                disabled={loading}
              >
                <option value="">Title</option>
                <option value="Mr">Mr</option>
                <option value="Ms">Ms</option>
                <option value="Master">Master</option>
                <option value="Baby">Baby</option>
              </select>
              <input 
                type="text" 
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="firstName" 
                bind:value={firstName}
                required
                disabled={loading}
              >
            </div>
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="lastName" 
              bind:value={lastName}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-envelope mr-1"></i>Email Address
            </label>
            <input 
              type="email" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="email" 
              bind:value={email}
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div class="grid grid-cols-3 gap-2">
              <select
                class="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={phoneCountryCode}
                on:change={() => { phoneCodeTouched = true }}
                disabled={loading}
              >
                <option value="">Code</option>
                {#each phoneCountryCodes as entry}
                  <option value={entry.dialCode}>{entry.name} ({entry.dialCode})</option>
                {/each}
              </select>
              <input 
                type="tel" 
                class="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="phone" 
                value={phone}
                on:input={(e) => phone = normalizePhoneInput(e.target.value, phoneCountryCode)}
                maxlength={phoneCountryCode === '+94' ? 9 : undefined}
                disabled={loading}
              >
            </div>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            class="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            bind:checked={disableNotifications}
            disabled={loading}
          />
          Don't send notifications
        </label>
        <div class="text-xs text-gray-500 mt-1">
          This will disable automated emails and reminders for this patient.
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="gender" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-venus-mars mr-1"></i>Gender
            </label>
            <select 
              class="form-select" 
              id="gender" 
              bind:value={gender}
              disabled={loading}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="dateOfBirth" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-calendar mr-1"></i>Date of Birth
            </label>
            <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="dateOfBirth" 
              bind:value={dateOfBirth}
              on:input={handleDateOfBirthChange}
              on:change={handleDateOfBirthChange}
              disabled={loading} />
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="age" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-birthday-cake mr-1"></i>Age <span class="text-red-600">*</span>
            </label>
            <div class="flex gap-2">
              <input 
                type="number" 
                class="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="ageYears" 
                bind:value={ageYears}
                min="0"
                max="150"
                placeholder="Years"
                disabled={loading}
                readonly={Boolean(dateOfBirth)}
              >
              <input 
                type="number" 
                class="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="ageMonths" 
                bind:value={ageMonths}
                min="0"
                max="11"
                placeholder="Months"
                disabled={loading}
                readonly={Boolean(dateOfBirth)}
              >
              <input 
                type="number" 
                class="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="ageDays" 
                bind:value={ageDays}
                min="0"
                max="31"
                placeholder="Days"
                disabled={loading}
                readonly={Boolean(dateOfBirth)}
              >
            </div>
            <small class="text-xs text-gray-500">
              {dateOfBirth ? 'Auto-calculated from date of birth' : 'Enter years, months, and days'}
            </small>
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="weight" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-weight mr-1"></i>Weight
            </label>
            <input 
              type="number" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="weight" 
              bind:value={weight}
              min="0"
              max="500"
              step="0.1"
              placeholder="kg"
              disabled={loading}
            >
            <small class="text-xs text-gray-500">Weight in kilograms</small>
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="bloodGroup" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-tint mr-1"></i>Blood Group
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="bloodGroup" 
              bind:value={bloodGroup}
              disabled={loading}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
            <small class="text-xs text-gray-500">Important for medical procedures</small>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="idNumber" class="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="idNumber" 
              bind:value={idNumber}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1">
          <label for="address" class="block text-sm font-medium text-gray-700">
            Address
            {#if improvedFields.address}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={() => handleImproveField('address', address, (value) => address = value)}
            disabled={loading || improvingFields.address || improvedFields.address || !address}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingFields.address}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014-12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English AI
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          id="address" 
          rows="3" 
          bind:value={address}
          on:input={(e) => handleFieldEdit('address', e.target.value)}
          disabled={loading}
        ></textarea>
      </div>
      
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1">
          <label for="allergies" class="block text-sm font-medium text-gray-700">
            <i class="fas fa-exclamation-triangle mr-1"></i>Allergies
            {#if improvedFields.allergies}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={() => handleImproveField('allergies', allergies, (value) => allergies = value)}
            disabled={loading || improvingFields.allergies || improvedFields.allergies || !allergies}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingFields.allergies}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014-12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English AI
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          id="allergies" 
          rows="3" 
          bind:value={allergies}
          on:input={(e) => handleFieldEdit('allergies', e.target.value)}
          placeholder="List any known allergies (e.g., Penicillin, Shellfish, Latex, etc.)"
          disabled={loading}
        ></textarea>
        <small class="text-xs text-gray-500">Important: List all known allergies to medications, foods, or other substances</small>
      </div>
      
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1">
          <label for="longTermMedications" class="block text-sm font-medium text-gray-700">
            <i class="fas fa-pills mr-1"></i>Long Term Medications
            {#if improvedFields.longTermMedications}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={() => handleImproveField('longTermMedications', longTermMedications, (value) => longTermMedications = value)}
            disabled={loading || improvingFields.longTermMedications || improvedFields.longTermMedications || !longTermMedications}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingFields.longTermMedications}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014-12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English AI
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          id="longTermMedications" 
          rows="3" 
          bind:value={longTermMedications}
          on:input={(e) => handleFieldEdit('longTermMedications', e.target.value)}
          placeholder="List current long-term medications (e.g., Lisinopril 10mg daily, Metformin 500mg twice daily, etc.)"
          disabled={loading}
        ></textarea>
        <small class="text-xs text-gray-500">List medications the patient is currently taking on a regular basis</small>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="emergencyContact" class="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="emergencyContact" 
              bind:value={emergencyContact}
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-span-full md:col-span-1">
          <div class="mb-3">
            <label for="emergencyPhone" class="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
            <input 
              type="tel" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="emergencyPhone" 
              bind:value={emergencyPhone}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      {#if error}
        <div class="flex items-center p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
          <svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
          </svg>
          <span class="sr-only">Info</span>
          <div>
            <span class="font-medium">Error!</span> {error}
          </div>
        </div>
      {/if}
      
      <div class="action-buttons">
        <button 
          type="submit" 
          class="action-button action-button-primary disabled:bg-gray-400 disabled:cursor-not-allowed" 
          disabled={loading}
          data-tour="patient-save"
        >
          {#if loading}
            <ThreeDots size="small" color="white" />
          {/if}
          <i class="fas fa-save mr-1"></i>Save Patient
        </button>
        <button 
          type="button" 
          class="action-button action-button-secondary disabled:bg-gray-100 disabled:cursor-not-allowed" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
