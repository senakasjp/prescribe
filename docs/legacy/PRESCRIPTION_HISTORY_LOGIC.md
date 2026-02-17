# Prescription History Logic Documentation

## Overview

The M-Prescribe system implements intelligent prescription history management with clear rules for when prescriptions appear in different sections. This document explains the updated logic, status definitions, and workflow.

## 🧠 Updated Prescription History Logic

### Core Principle
**NEW RULE: When clicking "+ New Prescription", don't show current prescription under prescriptions anymore. When "Send to Pharmacy" or "Print PDF", show it under history and medical summary.**

### Key Changes (Latest Update)
- **"+ New Prescription"** → Removes current prescription from prescriptions tab immediately
- **"Send to Pharmacy"** → Moves prescription to history and medical summary
- **"Print PDF"** → Moves prescription to history and medical summary
- **Unsaved prescriptions** → Deleted from system (no history entry)

### Status-Based Workflow
The system distinguishes between three types of prescription states:

| Status | Description | Moves to History? | Action |
|--------|-------------|-------------------|---------|
| `'draft'` | New/unsaved prescription | ❌ **NO** | Discarded |
| `'pending'` | Unsaved pending prescription | ❌ **NO** | Discarded |
| `'finalized'` | **Saved** prescription | ✅ **YES** | Move to history |
| `'completed'` | **Saved** prescription | ✅ **YES** | Move to history |
| `'sent'` | **Printed** prescription | ✅ **YES** | Move to history |
| `sentToPharmacy: true` | **Printed** prescription | ✅ **YES** | Move to history |
| `printedAt` | **Printed** prescription | ✅ **YES** | Move to history |

## 🔄 Prescription Lifecycle

### 1. Creation Phase
- **New Prescription** → Status: `'draft'` or `'pending'`
- **Add Medications** → Prescription remains in draft state
- **No History Entry** → Draft prescriptions don't appear in history

### 2. Completion Phase
- **Finalize Prescription** → Status: `'finalized'` (saved)
- **Send to Pharmacy** → Status: `'sent'` + `sentToPharmacy: true` (printed)
- **Generate PDF** → Status: `'sent'` + `printedAt: timestamp` (printed)

### 3. History Phase
- **New Prescription Starts** → Remove current prescription from prescriptions array
- **If Sent/Printed** → Move to history with `endDate` timestamp
- **If Not Sent/Printed** → Delete from Firebase (no history entry)

## 🔧 Technical Implementation

### Updated Status Checking Logic
```javascript
// NEW RULE: When clicking "+ New Prescription", don't show current prescription under prescriptions anymore
onNewPrescription: async () => {
  if (currentPrescription && currentMedications && currentMedications.length > 0) {
    // Remove from prescriptions array - this will hide it from prescriptions tab
    prescriptions = prescriptions.filter(p => p.id !== currentPrescription.id);
    
    // If prescription was sent to pharmacy or printed, move it to history
    const isSentToPharmacy = currentPrescription.status === 'sent' || 
                            currentPrescription.sentToPharmacy || 
                            currentPrescription.printedAt;
    
    if (isSentToPharmacy) {
      // Update prescription with end date to mark it as historical
      currentPrescription.endDate = new Date().toISOString().split('T')[0];
      await firebaseStorage.updatePrescription(currentPrescription.id, {
        endDate: currentPrescription.endDate,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Delete unsent/unprinted prescriptions from Firebase
      await firebaseStorage.deletePrescription(currentPrescription.id);
    }
  }
  
  // Create new prescription
  const newPrescription = await firebaseStorage.createPrescription(patientId, doctorId, title, description);
}
```

### Send to Pharmacy Logic
```javascript
// NEW RULE: When "Send to Pharmacy", mark prescription as sent and move to history/summary
if (currentPrescription) {
  currentPrescription.status = 'sent'
  currentPrescription.sentToPharmacy = true
  currentPrescription.sentAt = new Date().toISOString()
  currentPrescription.endDate = new Date().toISOString().split('T')[0] // Mark as historical
  
  // Update in Firebase
  await firebaseStorage.updatePrescription(currentPrescription.id, {
    status: 'sent',
    sentToPharmacy: true,
    sentAt: new Date().toISOString(),
    endDate: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  })
}
```

### Print PDF Logic
```javascript
// NEW RULE: When "Print PDF", mark prescription as printed and move to history/summary
if (currentPrescription) {
  currentPrescription.status = 'sent'
  currentPrescription.printedAt = new Date().toISOString()
  currentPrescription.endDate = new Date().toISOString().split('T')[0] // Mark as historical
  
  // Update in Firebase
  await firebaseStorage.updatePrescription(currentPrescription.id, {
    status: 'sent',
    printedAt: new Date().toISOString(),
    endDate: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  })
}
```

## 📊 Status Definitions

### Saved Prescriptions
Prescriptions that have been finalized and saved:
- **Status**: `'finalized'` or `'completed'`
- **Trigger**: User clicks "Finalize Prescription" button
- **Action**: Moves to history when new prescription starts
- **Purpose**: Completed work that should be preserved

### Printed Prescriptions
Prescriptions that have been sent to pharmacy or generated as PDF:
- **Status**: `'sent'`
- **Flags**: `sentToPharmacy: true` or `printedAt: timestamp`
- **Trigger**: User clicks "Send to Pharmacy" or "Print PDF" button
- **Action**: Moves to history when new prescription starts
- **Purpose**: Prescriptions that have been physically/electronically delivered

### Draft Prescriptions
Prescriptions that are work-in-progress:
- **Status**: `'draft'`, `'pending'`, or no status
- **Trigger**: New prescription creation or unsaved changes
- **Action**: Discarded when new prescription starts
- **Purpose**: Temporary work that shouldn't clutter history

## 🎯 Benefits

### For Doctors
- **Clean Prescriptions Tab**: Only active prescriptions appear in prescriptions tab
- **Immediate Feedback**: Clicking "+ New Prescription" immediately clears current prescription
- **Clear History**: Only sent/printed prescriptions appear in history and medical summary
- **No Confusion**: Clear distinction between active work and completed prescriptions
- **Data Integrity**: Prescription history contains only meaningful, completed prescriptions

### For System
- **Storage Efficiency**: Automatic cleanup of unsent/unprinted prescriptions
- **Data Consistency**: Clear status tracking throughout prescription lifecycle
- **Performance**: Reduced data volume in prescription queries
- **Reliability**: Predictable behavior for prescription management
- **User Experience**: Intuitive workflow that matches user expectations

## 🔍 User Experience

### What Users See
- **Prescriptions Tab**: Only shows active prescriptions being worked on
- **History Tab**: Only shows sent or printed prescriptions
- **Medical Summary**: Only includes sent/printed prescriptions in medical summary
- **Clean Interface**: Clear separation between active work and completed prescriptions

### What Happens Behind the Scenes
- **Immediate Removal**: Clicking "+ New Prescription" immediately removes current prescription from prescriptions tab
- **Smart History Management**: Only sent/printed prescriptions move to historical records
- **Automatic Cleanup**: Unsent/unprinted prescriptions are automatically deleted
- **Data Persistence**: Sent/printed prescriptions are properly archived with endDate

## 🚀 Future Enhancements

### Planned Features
- **Status Indicators**: Visual indicators showing prescription status
- **Recovery Options**: Ability to recover accidentally discarded drafts
- **Audit Trail**: Complete history of prescription status changes
- **Bulk Operations**: Manage multiple prescription statuses at once

### Technical Improvements
- **Status Validation**: Server-side validation of prescription status changes
- **Conflict Resolution**: Handle concurrent prescription modifications
- **Performance Optimization**: Efficient status checking for large prescription lists
- **Backup Systems**: Automatic backup of prescription status changes

## 📝 Best Practices

### For Developers
- Always check prescription status before creating new ones
- Implement proper error handling for status changes
- Use consistent status definitions across the application
- Test status transitions thoroughly

### For Users
- Use "Send to Pharmacy" for prescriptions that need to be delivered to pharmacies
- Use "Print PDF" for prescriptions that need to be printed
- Click "+ New Prescription" to start fresh (current prescription will be removed from prescriptions tab)
- Check prescription history for sent/printed prescriptions only
- Don't worry about unsent prescriptions - they're automatically cleaned up

## 🔧 Troubleshooting

### Common Issues
- **Prescription Missing from Prescriptions Tab**: This is expected behavior when clicking "+ New Prescription"
- **History Empty**: Ensure prescriptions are sent to pharmacy or printed before expecting them in history
- **Status Confusion**: Use "Send to Pharmacy" or "Print PDF" to move prescriptions to history
- **Data Loss**: Only unsent/unprinted prescriptions are discarded - sent/printed prescriptions are preserved

### Solutions
- **Move to History**: Use "Send to Pharmacy" or "Print PDF" to move prescriptions to history
- **History Check**: Look in prescription history for sent/printed prescriptions
- **Start Fresh**: Click "+ New Prescription" to begin new prescription (current one will be removed from prescriptions tab)
- **Data Backup**: Regular system backups protect against data loss

---

This intelligent prescription history logic ensures that the M-Prescribe system maintains clean, meaningful prescription records while automatically managing the lifecycle of prescription data.
