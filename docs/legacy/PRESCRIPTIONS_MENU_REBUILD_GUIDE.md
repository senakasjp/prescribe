# Prescriptions Menu Rebuild Guide

## Quick Rebuild Instructions

If the prescriptions menu breaks or needs to be rebuilt, follow these steps:

### 1. Verify Current State
```bash
# Check if the fix is still in place
grep -n "currentView === 'prescriptions'" src/App.svelte
grep -n "PrescriptionList" src/App.svelte
grep -n "loadPrescriptions" src/App.svelte
```

### 2. Restore App.svelte Changes

#### Step 1: Add Import
```javascript
// Add this import to src/App.svelte
import PrescriptionList from './components/PrescriptionList.svelte'
```

#### Step 2: Add Variable
```javascript
// Add this variable declaration
let prescriptions = [] // All prescriptions for the doctor
```

#### Step 3: Add Function
```javascript
// Add this function
const loadPrescriptions = async () => {
  if (user && user.role === 'doctor') {
    try {
      console.log('Loading prescriptions for doctor:', user.id)
      prescriptions = await firebaseStorage.getPrescriptionsByDoctorId(user.id)
      console.log('Loaded prescriptions:', prescriptions.length)
    } catch (error) {
      console.error('Error loading prescriptions:', error)
      prescriptions = []
    }
  }
}
```

#### Step 4: Make onMount Async
```javascript
// Change this line:
onMount(() => {
// To this:
onMount(async () => {
```

#### Step 5: Add Prescription Loading to Authentication
Add these calls in the appropriate places:

```javascript
// For email/password users (around line 107)
if (user.role === 'doctor') {
  await loadPrescriptions()
}

// For Firebase users (around line 239)
if (user.role === 'doctor') {
  doctorAuthService.saveCurrentDoctor(user)
  // Load prescriptions for doctor
  await loadPrescriptions()
}

// For localStorage fallback (around line 255)
if (fallbackDoctor) {
  user = fallbackDoctor
  // Load prescriptions for doctor
  await loadPrescriptions()
}
```

#### Step 6: Add Dedicated Prescriptions View
Replace the existing prescriptions view with:

```svelte
{:else if currentView === 'prescriptions'}
  <!-- Dedicated Prescriptions View -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-gray-900">
        <i class="fas fa-prescription-bottle-alt mr-2 text-teal-600"></i>
        All Prescriptions
      </h2>
      <div class="text-sm text-gray-500">
        Total: {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}
      </div>
    </div>
    
    {#if prescriptions.length === 0}
      <div class="text-center py-12">
        <i class="fas fa-prescription-bottle-alt text-6xl text-gray-300 mb-4"></i>
        <h3 class="text-lg font-semibold text-gray-500 mb-2">No Prescriptions Yet</h3>
        <p class="text-gray-400 mb-6">Start by creating prescriptions for your patients.</p>
        <button 
          class="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          on:click={() => currentView = 'patients'}
        >
          <i class="fas fa-users mr-2"></i>
          Go to Patients
        </button>
      </div>
    {:else}
      <PrescriptionList {prescriptions} />
    {/if}
  </div>
```

### 3. Test the Fix

#### Build Test
```bash
npm run build
```

#### Deploy Test
```bash
firebase deploy
```

#### Manual Test
1. Login as a doctor
2. Click "Prescriptions" in the navigation menu
3. Verify that prescriptions list is displayed
4. Test pagination if there are multiple prescriptions
5. Test empty state if no prescriptions exist

### 4. Verify PrescriptionList Component

Ensure the PrescriptionList component exists and has these features:
- Pagination (5 items per page)
- Sorting (newest first)
- Professional layout
- Error handling

### 5. Common Issues and Fixes

#### Issue: "Cannot use keyword 'await' outside an async function"
**Fix**: Make sure onMount is declared as `onMount(async () => {`

#### Issue: "PrescriptionList is not defined"
**Fix**: Add the import: `import PrescriptionList from './components/PrescriptionList.svelte'`

#### Issue: "prescriptions is not defined"
**Fix**: Add the variable: `let prescriptions = []`

#### Issue: Prescriptions not loading
**Fix**: Check that `loadPrescriptions()` is called in all authentication paths

#### Issue: Empty state not showing
**Fix**: Verify the conditional rendering logic for empty prescriptions array

### 6. File Structure Verification

Ensure these files exist:
```
src/
├── App.svelte (modified)
├── components/
│   └── PrescriptionList.svelte (existing)
└── services/
    └── firebaseStorage.js (existing)
```

### 7. Dependencies Check

Verify these dependencies are available:
- `firebaseStorage.getPrescriptionsByDoctorId()`
- `PrescriptionList` component
- Font Awesome icons (`fas fa-prescription-bottle-alt`, `fas fa-users`)

### 8. Performance Considerations

- Prescriptions are loaded once when user logs in
- Data persists across page refreshes
- Pagination handles large numbers of prescriptions
- Error handling prevents crashes

### 9. Security Notes

- Only doctors can access prescriptions
- Prescriptions are filtered by doctor ID
- No cross-doctor data access
- Proper authentication required

### 10. Rollback Plan

If the fix causes issues, you can rollback by:
1. Removing the dedicated prescriptions view
2. Restoring the original PatientManagement routing
3. Removing the prescription loading calls
4. Reverting onMount to non-async

### 11. Monitoring

After deployment, monitor:
- Prescription loading performance
- User navigation patterns
- Error rates in console
- User feedback

## Emergency Contacts

If issues persist:
1. Check browser console for errors
2. Verify Firebase connection
3. Test with different user accounts
4. Check network connectivity

## Success Criteria

The fix is successful when:
- ✅ Prescriptions menu shows dedicated prescriptions list
- ✅ Pagination works correctly
- ✅ Empty state displays properly
- ✅ Navigation is smooth
- ✅ No console errors
- ✅ Build and deployment successful

## Related Files

- `PRESCRIPTIONS_MENU_FIX.md` - Detailed documentation
- `src/App.svelte` - Main application file
- `src/components/PrescriptionList.svelte` - Prescriptions display component
- `src/services/firebaseStorage.js` - Data access layer
