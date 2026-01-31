<script>
  import { createEventDispatcher } from 'svelte'
  import { formatDate, calculateAge } from '../../utils/dataProcessing.js'
  import { getIconClass, getBadgeClasses } from '../../utils/uiHelpers.js'
  import { GENDER_OPTIONS, BLOOD_TYPES } from '../../utils/constants.js'
  import DateInput from '../DateInput.svelte'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let isEditingPatient = false
  export let editPatientData = {}
  
  // Reactive age calculation
  $: patientAge = selectedPatient ? calculateAge(selectedPatient.dateOfBirth) : null
  
  // Handle edit mode toggle
  function toggleEditMode() {
    if (!isEditingPatient) {
      // Initialize edit data
      editPatientData = {
        firstName: selectedPatient?.firstName || '',
        lastName: selectedPatient?.lastName || '',
        dateOfBirth: selectedPatient?.dateOfBirth || '',
        gender: selectedPatient?.gender || '',
        bloodType: selectedPatient?.bloodType || '',
        phone: selectedPatient?.phone || '',
        email: selectedPatient?.email || '',
        address: selectedPatient?.address || '',
        emergencyContact: selectedPatient?.emergencyContact || '',
        medicalHistory: selectedPatient?.medicalHistory || '',
        allergies: selectedPatient?.allergies || '',
        medications: selectedPatient?.medications || ''
      }
    }
    isEditingPatient = !isEditingPatient
    dispatch('toggle-edit', { isEditing: isEditingPatient })
  }
  
  // Handle save patient data
  function savePatientData() {
    dispatch('save-patient', editPatientData)
  }
  
  // Handle cancel edit
  function cancelEdit() {
    isEditingPatient = false
    editPatientData = {}
    dispatch('cancel-edit')
  }
  
  // Get gender label
  function getGenderLabel(gender) {
    const option = GENDER_OPTIONS.find(opt => opt.value === gender)
    return option ? option.label : gender
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        {selectedPatient?.firstName} {selectedPatient?.lastName}
      </h2>
      <div class="flex items-center space-x-4 text-sm text-gray-600">
        <span class="flex items-center">
          <i class="{getIconClass('calendar')} mr-1"></i>
          {patientAge ? `${patientAge} years old` : 'Age unknown'}
        </span>
        <span class="flex items-center">
          <i class="{getIconClass('user')} mr-1"></i>
          {getGenderLabel(selectedPatient?.gender)}
        </span>
        {#if selectedPatient?.bloodType}
          <span class="flex items-center">
            <i class="{getIconClass('heartbeat')} mr-1"></i>
            Blood Type: {selectedPatient.bloodType}
          </span>
        {/if}
      </div>
    </div>
    
    <button
      on:click={toggleEditMode}
      class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
    >
      <i class="{getIconClass('edit')} mr-2"></i>
      {isEditingPatient ? 'Cancel' : 'Edit Profile'}
    </button>
  </div>

  {#if isEditingPatient}
    <!-- Edit Mode -->
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="editFirstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            id="editFirstName"
            type="text"
            bind:value={editPatientData.firstName}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Enter first name"
          />
        </div>
        <div>
          <label for="editLastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            id="editLastName"
            type="text"
            bind:value={editPatientData.lastName}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Enter last name"
          />
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="editDateOfBirth" class="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <DateInput id="editDateOfBirth"
            type="date" lang="en-GB" placeholder="dd/mm/yyyy"
            bind:value={editPatientData.dateOfBirth}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
        </div>
        <div>
          <label for="editGender" class="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            id="editGender"
            bind:value={editPatientData.gender}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Select gender</option>
            {#each GENDER_OPTIONS as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="editBloodType" class="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
          <select
            id="editBloodType"
            bind:value={editPatientData.bloodType}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Select blood type</option>
            {#each BLOOD_TYPES as bloodType}
              <option value={bloodType}>{bloodType}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="editPhone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            id="editPhone"
            type="tel"
            bind:value={editPatientData.phone}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Enter phone number"
          />
        </div>
      </div>
      
      <div>
        <label for="editEmail" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="editEmail"
          type="email"
          bind:value={editPatientData.email}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter email address"
        />
      </div>
      
      <div>
        <label for="editAddress" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea
          id="editAddress"
          bind:value={editPatientData.address}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter address"
        ></textarea>
      </div>
      
      <div>
        <label for="editEmergencyContact" class="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
        <input
          id="editEmergencyContact"
          type="text"
          bind:value={editPatientData.emergencyContact}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter emergency contact information"
        />
      </div>
      
      <div>
        <label for="editMedicalHistory" class="block text-sm font-medium text-gray-700 mb-1">Medical History</label>
        <textarea
          id="editMedicalHistory"
          bind:value={editPatientData.medicalHistory}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter medical history"
        ></textarea>
      </div>
      
      <div>
        <label for="editAllergies" class="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
        <textarea
          id="editAllergies"
          bind:value={editPatientData.allergies}
          rows="2"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter known allergies"
        ></textarea>
      </div>
      
      <div>
        <label for="editMedications" class="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
        <textarea
          id="editMedications"
          bind:value={editPatientData.medications}
          rows="2"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="Enter current medications"
        ></textarea>
      </div>
      
      <div class="flex justify-end space-x-3 pt-4">
        <button
          on:click={cancelEdit}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Cancel
        </button>
        <button
          on:click={savePatientData}
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Save Changes
        </button>
      </div>
    </div>
  {:else}
    <!-- View Mode -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Contact Information</h3>
          <div class="mt-2 space-y-2">
            {#if selectedPatient?.phone}
              <div class="flex items-center text-sm text-gray-900">
                <i class="{getIconClass('phone')} mr-2 text-gray-400"></i>
                {selectedPatient.phone}
              </div>
            {/if}
            {#if selectedPatient?.email}
              <div class="flex items-center text-sm text-gray-900">
                <i class="{getIconClass('email')} mr-2 text-gray-400"></i>
                {selectedPatient.email}
              </div>
            {/if}
            {#if selectedPatient?.address}
              <div class="flex items-start text-sm text-gray-900">
                <i class="{getIconClass('location')} mr-2 text-gray-400 mt-0.5"></i>
                <span>{selectedPatient.address}</span>
              </div>
            {/if}
          </div>
        </div>
        
        {#if selectedPatient?.emergencyContact}
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Emergency Contact</h3>
            <p class="mt-2 text-sm text-gray-900">{selectedPatient.emergencyContact}</p>
          </div>
        {/if}
      </div>
      
      <div class="space-y-4">
        {#if selectedPatient?.medicalHistory}
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Medical History</h3>
            <p class="mt-2 text-sm text-gray-900">{selectedPatient.medicalHistory}</p>
          </div>
        {/if}
        
        {#if selectedPatient?.allergies}
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Allergies</h3>
            <div class="mt-2">
              <span class="{getBadgeClasses('warning')}">
                <i class="{getIconClass('warning')} mr-1"></i>
                {selectedPatient.allergies}
              </span>
            </div>
          </div>
        {/if}
        
        {#if selectedPatient?.medications}
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide">Current Medications</h3>
            <p class="mt-2 text-sm text-gray-900">{selectedPatient.medications}</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
