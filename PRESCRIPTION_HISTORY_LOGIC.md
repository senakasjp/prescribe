# Prescription History Logic Documentation

## Overview

The M-Prescribe system now implements intelligent prescription history management that ensures only completed work appears in the prescription history and summary. This document explains the logic, status definitions, and workflow.

## 🧠 Smart Prescription History Logic

### Core Principle
**Prescriptions only move to history and summary when they have been saved or printed.**

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
- **New Prescription Starts** → System checks current prescription status
- **If Saved/Printed** → Move to history with `endDate` timestamp
- **If Draft/Pending** → Remove from prescriptions array and delete from Firebase

## 🔧 Technical Implementation

### Status Checking Logic
```javascript
const shouldMoveToHistory = (prescription) => {
  const isSaved = prescription.status === 'finalized' || prescription.status === 'completed';
  const isPrinted = prescription.status === 'sent' || 
                    prescription.sentToPharmacy || 
                    prescription.printedAt;
  return isSaved || isPrinted;
}
```

### New Prescription Workflow
```javascript
onNewPrescription: async () => {
  // Check if current prescription should be moved to history
  if (currentPrescription && currentMedications && currentMedications.length > 0) {
    const isSaved = currentPrescription.status === 'finalized' || currentPrescription.status === 'completed';
    const isPrinted = currentPrescription.status === 'sent' || currentPrescription.sentToPharmacy || currentPrescription.printedAt;
    
    if (isSaved || isPrinted) {
      // Move to history with endDate timestamp
      currentPrescription.endDate = new Date().toISOString().split('T')[0];
      await firebaseStorage.updatePrescription(currentPrescription.id, { endDate: currentPrescription.endDate });
    } else {
      // Remove unsaved prescription from system
      prescriptions = prescriptions.filter(p => p.id !== currentPrescription.id);
      await firebaseStorage.deletePrescription(currentPrescription.id);
    }
  }
  
  // Create new prescription
  const newPrescription = await firebaseStorage.createPrescription(patientId, doctorId, title, description);
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
- **Clean History**: Only meaningful, completed prescriptions appear in history
- **No Clutter**: Unsaved drafts don't accumulate in prescription records
- **Clear Workflow**: Obvious distinction between work-in-progress and completed work
- **Data Integrity**: Prescription history contains only finalized prescriptions

### For System
- **Storage Efficiency**: Automatic cleanup of unused draft prescriptions
- **Data Consistency**: Clear status tracking throughout prescription lifecycle
- **Performance**: Reduced data volume in prescription history queries
- **Reliability**: Predictable behavior for prescription management

## 🔍 User Experience

### What Users See
- **Current Prescription**: Always shows the active prescription being worked on
- **History**: Only shows saved or printed prescriptions
- **Summary**: Only includes completed prescriptions in medical summary
- **Clean Interface**: No confusion between drafts and completed work

### What Happens Behind the Scenes
- **Automatic Status Checking**: System checks prescription status before creating new ones
- **Intelligent Cleanup**: Unsaved prescriptions are automatically removed
- **History Management**: Only completed work moves to historical records
- **Data Persistence**: Saved/printed prescriptions are properly archived

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
- Finalize prescriptions when work is complete
- Use "Send to Pharmacy" for prescriptions that need to be delivered
- Don't worry about unsaved drafts - they're automatically cleaned up
- Check prescription history for completed work only

## 🔧 Troubleshooting

### Common Issues
- **Prescription Missing**: Check if it was saved or printed before creating new prescription
- **History Empty**: Ensure prescriptions are finalized or sent before expecting them in history
- **Status Confusion**: Use the status indicators to understand prescription state
- **Data Loss**: Only unsaved drafts are discarded - saved/printed prescriptions are preserved

### Solutions
- **Recovery**: Use "Finalize Prescription" to save current work
- **History Check**: Look in prescription history for completed prescriptions
- **Status Review**: Check prescription status before creating new ones
- **Data Backup**: Regular system backups protect against data loss

---

This intelligent prescription history logic ensures that the M-Prescribe system maintains clean, meaningful prescription records while automatically managing the lifecycle of prescription data.
