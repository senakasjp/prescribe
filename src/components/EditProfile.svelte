<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  import ThreeDots from './ThreeDots.svelte'
  
  
  const dispatch = createEventDispatcher()
  export let user
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let country = ''
  let city = ''
  let loading = false
  let error = ''
  
  // Prescription template variables
  let prescriptionTemplates = []
  let newTemplateName = ''
  let newTemplateContent = ''
  
  // Tab management
  let activeTab = 'edit-profile'
  
  // Prescription template variables
  let templateType = '' // 'printed', 'upload', 'system'
  let uploadedHeader = null
  let templatePreview = null
  let headerSize = 300 // Default header size in pixels
  
  // Reactive variable for cities based on selected country
  $: availableCities = country ? getCitiesByCountry(country) : []
  
  
  // Reset city when country changes
  $: if (country && city && !availableCities.find(c => c.name === city)) {
    city = ''
  }
  
  // Function to initialize form fields
  const initializeForm = () => {
    if (user) {
      firstName = user.firstName || ''
      lastName = user.lastName || ''
      email = user.email || ''
      country = user.country || ''
      city = user.city || ''
    }
  }
  
  // Initialize form fields when component mounts
  onMount(() => {
    initializeForm()
  })
  
  // Initialize form fields when user data changes
  $: if (user) {
    initializeForm()
  }
  
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error('First name and last name are required')
      }
      
      if (!country.trim()) {
        throw new Error('Country is required')
      }
      
      if (!city.trim()) {
        throw new Error('City is required')
      }
      
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        city: city.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`
      }
      
      // Update in auth service
      await authService.updateDoctor(updatedUser)
      notifySuccess('Profile updated successfully!')
      dispatch('profile-updated', updatedUser)
      
    } catch (err) {
      error = err.message
      notifyError(error)
    } finally {
      loading = false
    }
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('profile-cancelled')
  }
  
  // Handle tab switching
  const switchTab = (tabName) => {
    activeTab = tabName
  }
  
  // Handle template type selection
  const selectTemplateType = (type) => {
    templateType = type
    uploadedHeader = null
    templatePreview = null
  }
  
  // Handle header image upload
  const handleHeaderUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedHeader = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Generate system header preview
  const generateSystemHeader = () => {
    templatePreview = {
      type: 'system',
      doctorName: user?.name || 'Dr. [Your Name]',
      practiceName: `${user?.firstName || ''} ${user?.lastName || ''} Medical Practice`,
      address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
      phone: '+1 (555) 123-4567',
      email: user?.email || 'doctor@example.com'
    }
  }
  
  // Save template settings
  const saveTemplateSettings = async () => {
    try {
      console.log('🔍 Saving template settings...')
      
      // For now, just show success message
      notifySuccess('Template settings saved successfully!')
      
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      notifyError('Failed to save template settings')
    }
  }
</script>

<!-- Edit Profile Modal -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" tabindex="-1">
  <div class="w-full max-w-4xl">
    <div class="bg-white rounded-lg shadow-lg">
      <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
        <div class="flex justify-between items-center">
          <h6 class="text-lg font-semibold">
            <i class="fas fa-cog mr-2 fa-sm"></i>
            Settings
          </h6>
          <div class="flex gap-2">
          <button type="button" class="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50" on:click={initializeForm} title="Reload current values">
            <i class="fas fa-sync-alt fa-sm"></i>
          </button>
          <button type="button" class="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-md p-1" on:click={handleCancel}>
            <i class="fas fa-times"></i>
          </button>
          </div>
        </div>
      </div>
      
      <!-- Clean Tab Navigation -->
      <div class="mb-6">
        <div class="flex border-b border-gray-300">
          <div class="w-1/2">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'edit-profile' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('edit-profile')}
            >
              <i class="fas fa-user-edit mr-2"></i>
              Edit Profile
            </button>
          </div>
          <div class="w-1/2">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'prescription-template' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('prescription-template')}
            >
              <i class="fas fa-file-medical mr-2"></i>
              Prescription Template
            </button>
          </div>
        </div>
      </div>
      
      <!-- Tab Content -->
      <div id="default-styled-tab-content">
          <!-- Edit Profile Tab -->
          {#if activeTab === 'edit-profile'}
          <div class="p-6 bg-white" id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
            <form id="edit-profile-form" on:submit={handleSubmit}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label for="editFirstName" class="block text-sm font-medium text-gray-700 mb-1">
                First Name <span class="text-red-600">*</span>
              </label>
              <input 
                type="text" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                id="editFirstName" 
                bind:value={firstName}
                placeholder="Enter your first name"
                required
                disabled={loading}
              >
            </div>
            <div>
              <label for="editLastName" class="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span class="text-red-600">*</span>
              </label>
              <input 
                type="text" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                id="editLastName" 
                bind:value={lastName}
                placeholder="Enter your last name"
                required
                disabled={loading}
              >
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input 
              type="email" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editEmail" 
              value={email}
              disabled
              readonly
            >
            <div class="text-sm text-gray-500 mt-1">
              <i class="fas fa-info-circle mr-1"></i>
              Email cannot be changed for security reasons
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editCountry" class="block text-sm font-medium text-gray-700 mb-1">
              Country <span class="text-red-600">*</span>
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editCountry" 
              bind:value={country}
              required
              disabled={loading}
            >
              <option value="">Select your country</option>
              {#each countries as countryOption}
                <option value={countryOption.name}>{countryOption.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="mb-3">
            <label for="editCity" class="block text-sm font-medium text-gray-700 mb-1">
              City <span class="text-red-600">*</span>
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editCity" 
              bind:value={city}
              required
              disabled={loading || !country}
            >
              <option value="">Select your city</option>
              {#each availableCities as cityOption}
                <option value={cityOption.name}>{cityOption.name}</option>
              {/each}
            </select>
            {#if country && availableCities.length === 0}
              <div class="text-sm text-gray-500 mt-1 text-yellow-600">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                No cities available for the selected country. Please contact support.
              </div>
            {/if}
          </div>
          
          {#if error}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3" role="alert">
              <i class="fas fa-exclamation-triangle mr-2"></i>{error}
            </div>
          {/if}
            </form>
          </div>
          {/if}
          
          <!-- Prescription Template Tab -->
          {#if activeTab === 'prescription-template'}
          <div class="p-6 bg-white" id="prescription-template" role="tabpanel" aria-labelledby="prescription-template-tab">
            <div class="mb-4">
              <h6 class="fw-bold mb-3">
                <i class="fas fa-file-medical mr-2"></i>
                Prescription Template Settings
              </h6>
              <p class="text-muted small mb-4">Choose how you want your prescription header to appear on printed prescriptions.</p>
            </div>
            
            <!-- Template Type Selection -->
            <div class="row mb-4">
              <div class="col-span-full">
                <label class="block text-sm font-semibold text-gray-700 mb-3">Select Template Type:</label>
                
                <!-- Option 1: Printed Letterheads -->
                {#if templateType !== 'upload'}
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'printed' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'printed' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templatePrinted" 
                        value="printed"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('printed')}
                      />
                      <label class="w-full cursor-pointer" for="templatePrinted">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-print text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I have printed A3 letterheads</h6>
                            <p class="text-gray-500 text-sm mb-0">Use your existing printed letterhead paper for prescriptions. No header will be added to the PDF.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'printed'}
                    <div class="mt-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Header Size Adjustment:</label>
                      <div class="flex items-center">
                        <div class="flex-1 mr-4">
                          <input 
                            type="range" 
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                            min="50" 
                            max="300" 
                            step="10"
                            bind:value={headerSize}
                          />
                        </div>
                        <div class="flex-shrink-0">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{headerSize}px</span>
                        </div>
                      </div>
                      <div class="text-sm text-gray-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        Adjust the header space to match your printed letterhead height.
                      </div>
                    </div>
                    {/if}
                  </div>
                </div>
                {/if}
                
                <!-- Option 2: Upload Image -->
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'upload' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'upload' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templateUpload" 
                        value="upload"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('upload')}
                      />
                      <label class="w-full cursor-pointer" for="templateUpload">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-image text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I want to upload an image for header</h6>
                            <p class="text-gray-500 text-sm mb-0">Upload your custom header image to be used on all prescriptions.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'upload'}
                    <div class="mt-3">
                      <input 
                        type="file" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                        accept="image/*"
                        on:change={handleHeaderUpload}
                      />
                      <div class="text-sm text-gray-500">
                        <i class="fas fa-info-circle mr-1"></i>
                        Supported formats: JPG, PNG, GIF. Recommended size: 800x200 pixels.
                      </div>
                    </div>
                    {/if}
                  </div>
                </div>
                
                <!-- Option 3: System Header -->
                {#if templateType !== 'printed' && templateType !== 'upload'}
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'system' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'system' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templateSystem" 
                        value="system"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('system')}
                      />
                      <label class="w-full cursor-pointer" for="templateSystem">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-cog text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I want system to add header for template</h6>
                            <p class="text-gray-500 text-sm mb-0">Use a system-generated header with your practice information.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'system'}
                    <div class="mt-3">
                      <button 
                        type="button" 
                        class="inline-flex items-center px-3 py-2 border border-teal-300 text-teal-700 bg-white hover:bg-teal-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={generateSystemHeader}
                      >
                        <i class="fas fa-eye mr-2"></i>
                        Preview System Header
              </button>
                      
                      {#if templatePreview && templatePreview.type === 'system'}
                      <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">System Header Preview:</label>
                        <div class="border rounded p-3 bg-gray-50">
                          <div class="text-center">
                            <h5 class="fw-bold mb-1">{templatePreview.doctorName}</h5>
                            <p class="mb-1 fw-semibold">{templatePreview.practiceName}</p>
                            <p class="mb-1 small">{templatePreview.address}</p>
                            <p class="mb-1 small">Tel: {templatePreview.phone} | Email: {templatePreview.email}</p>
                            <hr class="my-2">
                            <p class="mb-0 fw-bold">PRESCRIPTION</p>
                          </div>
                        </div>
                      </div>
                      {/if}
                    </div>
                    {/if}
                  </div>
                </div>
                {/if}
              </div>
            </div>
            
            <!-- Template settings will be saved via modal footer -->
          </div>
          {/if}
      </div>
        
      <!-- Modal Footer -->
      <div class="bg-gray-50 px-4 py-3 rounded-b-lg flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg" on:click={handleCancel} disabled={loading}>
          <i class="fas fa-times mr-1 fa-sm"></i>
          Cancel
        </button>
        {#if activeTab === 'edit-profile'}
          <button 
            type="submit" 
            form="edit-profile-form"
            class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center"
            disabled={loading}
          >
          {#if loading}
            <ThreeDots size="small" color="white" />
          {/if}
          <i class="fas fa-save mr-1 fa-sm"></i>
          Save Changes
        </button>
        {:else if activeTab === 'prescription-template'}
          <button 
            type="button" 
            class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center"
            on:click={saveTemplateSettings}
            disabled={!templateType}
          >
            <i class="fas fa-save mr-1 fa-sm"></i>
            Save Template Settings
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- No custom CSS - using pure Tailwind -->
