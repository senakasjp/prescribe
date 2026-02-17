# 🏥 Prescribe - Quick Reference Card

> Legacy quick sheet. Canonical product operations now live in `PRODUCT_MANUAL.md`.

## 🔐 Login Options
- **Google Login**: Click "Login with Google" (Recommended)
- **Email/Password**: Click "Register" → Fill details → Sign in
- **Pharmacist**: Click "Pharmacist" tab → Register with 6-digit number

## 💳 Admin Payment Pricing
| Action | Steps |
|--------|-------|
| **Open pricing controls** | Admin → `Payments` tab |
| **Set plan prices** | Enter USD/LKR monthly + annual values |
| **Choose scope** | Select `new_customers` or `all_customers` |
| **Apply settings** | Keep `Enable custom pricing` checked → Click `Save Pricing` |

## 👥 Patient Management
| Action | Steps |
|--------|-------|
| **Add Patient** | Click "Add Patient" → Fill First Name + Age → Save |
| **Search Patient** | Type in search box (name, ID, phone, email) |
| **Edit Patient** | Select patient → Click "Edit" → Update → Save |
| **View Details** | Click patient name → See all tabs |

## 💊 Prescription Workflow
| Step | Action |
|------|--------|
| 1 | Select patient → Click "Prescriptions" tab |
| 2 | Click "New Prescription" |
| 3 | Click "Add Drug" → Fill medication details |
| 4 | Click "Save Medication" (repeat for more drugs) |
| 5 | Choose: Save / Print PDF / Send to Pharmacy |

### Dispense Form Categories (Important)
- **QTY (sell as units)**:
  - `Injection`, `Cream`, `Ointment`, `Gel`, `Suppository`, `Inhaler`, `Spray`, `Shampoo`, `Packet`, `Roll`
- **Non-QTY**:
  - `Tablet`, `Capsule`, `Liquid (measured)`
- **Special QTY**:
  - `Liquid (bottles)`

### Quantity + PDF Rules
- If a count-based medication cannot derive quantity from schedule/strength, the entered count (`qts`) is used.
- PDF second-line inventory label:
  - `Vol:` for volume values/forms
  - `Strength:` for non-volume values

## 📋 Medical Records
| Tab | Purpose | Action |
|-----|---------|--------|
| **Symptoms** | Patient complaints | Click "Add Symptoms" → Fill details |
| **Diagnoses** | Medical conditions | Click "Add Diagnosis" → Fill details |
| **Reports** | Lab results, images | Click "Add Report" → Choose type → Upload/Fill |
| **Overview** | Quick summary | View statistics and recent activity |

## 🏪 Pharmacist Connection
| Role | Action |
|------|--------|
| **Doctor** | Get 6-digit number → Pharmacists tab → Connect |
| **Pharmacist** | Register → Get number → Share with doctors |

## 🧾 ID Display Rule
- **Storage/queries**: Use raw Firebase document IDs only.
- **UI/communications**: Use short formatted IDs (`DRxxxxx`, `PHxxxxx`, `PAxxxxx`, `PRxxxxxxx`) everywhere.

## 🔍 Quick Search
- **Patient Name**: Type any part of name
- **Patient ID**: Enter ID number
- **Phone**: Use phone number
- **Email**: Search by email address

## ⌨️ Keyboard Shortcuts
- **Tab**: Navigate between form fields
- **Enter**: Submit forms
- **Escape**: Close modals/cancel actions

## 🚨 Common Issues
| Problem | Solution |
|---------|----------|
| Can't find patient | Check spelling, try different search criteria |
| Data not saving | Check required fields (First Name + Age) |
| Prescription not working | Click "New Prescription" first |
| Can't connect pharmacist | Verify 6-digit number |

## 📱 Mobile Tips
- **Portrait Mode**: Best viewing experience
- **Touch Navigation**: Tap to select and navigate
- **Responsive Design**: Works on all screen sizes

## 🔒 Security Notes
- **Doctor Isolation**: Each doctor only sees their own patients
- **HIPAA Compliant**: Patient data properly isolated
- **Secure Storage**: Data stored in Firebase cloud
- **Log Out**: Always sign out when done

## 📞 Quick Help
- **F12**: Open browser console for errors
- **Refresh**: Reload page if issues persist
- **Clear Cache**: Clear browser cache if needed

---
**System URL**: `https://mprescribe.net` (legacy: `https://prescribe-7e1e8.web.app`)  
**Support**: Check BEGINNER_GUIDE.md for detailed help
