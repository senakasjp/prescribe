# 🤖 Admin Panel Documentation

## Overview

The Admin Panel provides system administrators with comprehensive access to manage and monitor the M-Prescribe Patient Management System.

## 🔐 Admin Access

### Super Admin System
- **Super Admin Email**: `senakahks@gmail.com`
- **Automatic Access**: Super admin automatically lands on doctor app with admin privileges
- **Direct Admin Panel**: No login form required - direct access to admin panel
- **Protected Account**: Super admin account cannot be deleted by anyone

### Access Methods
1. **Super Admin Auto-Login**: `senakahks@gmail.com` automatically logs in and lands on doctor app
2. **Admin Panel Access**: Click "Admin" button in navigation bar (super admin only)
3. **Direct Admin Access**: Super admin bypasses admin login form entirely
4. **Seamless Navigation**: Switch between doctor app and admin panel seamlessly

## 🎯 Features

### 1. System Overview Dashboard
- **Statistics Cards**: View total doctors, patients, prescriptions, and symptoms
- **Recent Activity**: Monitor system usage and activities
- **Quick Actions**: Refresh data and system status

### 2. Doctors Management
- **View All Doctors**: Complete list of registered doctors
- **Doctor Details**: Email, name, role, creation date, admin status
- **Patient Count**: Number of patients per doctor
- **System-wide Statistics**: Total doctors registered
- **Doctor Deletion**: Delete any doctor account (except super admin)
- **Complete Data Cleanup**: When deleting doctors, removes all associated data:
  - All patients belonging to the doctor
  - All prescriptions, symptoms, and illnesses
  - All drug database entries created by the doctor
  - The doctor account itself
- **Protected Super Admin**: Super admin account cannot be deleted
- **Confirmation Dialogs**: Detailed warnings before deletion
- **Real-time Updates**: Table updates immediately after deletion

### 3. Patients Management
- **View All Patients**: Complete list across all doctors
- **Patient Details**: Name, email, phone, assigned doctor
- **Cross-Doctor View**: See patients from all doctors
- **Creation Tracking**: When patients were registered

### 4. AI Usage Analytics
- **Cost Tracking**: Monitor OpenAI API usage and costs
- **Token Statistics**: Track total tokens, requests, and daily usage
- **Usage History**: View recent AI requests and detailed analytics
- **Weekly Reports**: Daily usage breakdown for the last 7 days
- **Cost Management**: Monitor spending and optimize AI usage

### 5. System Settings
- **System Information**: Version, last updated, admin email
- **Quick Actions**: Export data, backup system, refresh data
- **Admin Account Management**: View current admin details

## 🔧 Technical Implementation

### Components Structure
```
src/components/
├── AdminPanel.svelte          # Main admin panel router
├── AdminLogin.svelte          # Admin authentication
└── AdminDashboard.svelte      # Admin dashboard with tabs
```

### Services
```
src/services/
├── adminAuthService.js        # Admin authentication service
└── aiTokenTracker.js          # AI token usage tracking service
```

### Key Features
- **Secure Authentication**: Email-based admin verification
- **Responsive Design**: Bootstrap 5 with mobile support
- **Real-time Data**: Live statistics and data updates
- **Modular Architecture**: Clean separation of concerns
- **Accessibility**: ARIA-compliant components

## 🚀 Usage Instructions

### 1. Super Admin Access
1. **Automatic Login**: `senakahks@gmail.com` automatically logs in and lands on doctor app
2. **Admin Button**: Click "Admin" button in the navigation bar
3. **Direct Access**: Admin panel opens without login form
4. **Seamless Navigation**: Switch between doctor app and admin panel

### 2. Navigating the Dashboard
- **Overview Tab**: System statistics and recent activity
- **Doctors Tab**: Manage, view, and delete all registered doctors
- **Patients Tab**: View all patients across the system
- **AI Usage Tab**: Monitor AI token usage and costs
- **System Tab**: System settings and quick actions

### 3. Admin Actions
- **Delete Doctors**: Click "Delete" button next to any doctor (except super admin)
- **Confirmation**: Review detailed warning dialog before deletion
- **Data Cleanup**: System automatically removes all associated data
- **Sign Out**: Use the dropdown menu in the top-right corner
- **Back to App**: Use the "Back to App" button (top-right corner)
- **Refresh Data**: Use refresh buttons to update statistics

### 4. Doctor Deletion Process
1. **Navigate to Doctors Tab**: Click "Doctors" in the sidebar
2. **Select Doctor**: Find the doctor you want to delete
3. **Click Delete**: Click the red "Delete" button
4. **Review Warning**: Read the detailed confirmation dialog
5. **Confirm Deletion**: Click "OK" to proceed or "Cancel" to abort
6. **Wait for Completion**: System shows loading state during deletion
7. **Success Notification**: Confirmation message when deletion is complete
8. **Updated Table**: Doctor list updates immediately

## 🔒 Security Features

### Authentication
- **Email Verification**: Only `senakahks@gmail.com` can access
- **Password Protection**: Secure password verification
- **Session Management**: Persistent admin sessions
- **Auto-logout**: Session management for security

### Data Access
- **Read-Only Access**: Admin can view but not modify core data
- **System-wide View**: Access to all doctors and patients
- **Statistics Only**: No direct data modification capabilities
- **Audit Trail**: Admin actions are logged

## 🎨 UI/UX Features

### Design Principles
- **Bootstrap 5**: Consistent with main application
- **Dark Theme**: Admin-specific dark navigation
- **Red Accent**: Danger/Admin color scheme
- **Responsive**: Mobile-friendly design
- **Accessibility**: Screen reader compatible

### Visual Elements
- **Statistics Cards**: Color-coded information cards
- **Tab Navigation**: Easy switching between sections
- **Data Tables**: Clean, sortable data presentation
- **Loading States**: Smooth loading indicators
- **Error Handling**: User-friendly error messages

## 🔧 Development Notes

### File Structure
- **Modular Components**: Each feature in separate files
- **Service Layer**: Clean separation of business logic
- **Event Handling**: Proper Svelte event dispatching
- **State Management**: Local state with proper reactivity

### Code Quality
- **Comments**: Comprehensive code documentation
- **Error Handling**: Try-catch blocks for all async operations
- **Type Safety**: Proper variable initialization
- **Performance**: Efficient data loading and rendering

## 🚀 Future Enhancements

### Planned Features
- **User Management**: Add/edit/remove doctors
- **Data Export**: Export system data to CSV/PDF
- **System Backup**: Automated backup functionality
- **Audit Logs**: Detailed activity tracking
- **Advanced Analytics**: Charts and graphs for data visualization
- **AI Cost Budgets**: Set spending limits and alerts
- **Usage Reports**: Monthly/quarterly AI usage reports
- **Performance Metrics**: AI response times and accuracy tracking

### Security Improvements
- **Two-Factor Authentication**: Enhanced security
- **Role-Based Access**: Multiple admin levels
- **API Integration**: Secure backend communication
- **Data Encryption**: Enhanced data protection

## 📱 Mobile Support

The admin panel is fully responsive and works on:
- **Desktop**: Full-featured experience
- **Tablet**: Optimized layout for medium screens
- **Mobile**: Touch-friendly interface with collapsible navigation

## 🆘 Troubleshooting

### Common Issues
1. **Cannot Access Admin Panel**
   - Verify email is exactly `senakahks@gmail.com`
   - Check password is `M-PrescribeAdmin2024!`
   - Clear browser cache and try again

2. **Data Not Loading**
   - Click refresh button
   - Check browser console for errors
   - Verify localStorage is available

3. **Navigation Issues**
   - Use "Back to App" button to return to main app
   - Refresh page if stuck in admin panel

### Support
For technical issues or questions about the admin panel, contact the system administrator at `senakahks@gmail.com`.

---

**Note**: This admin panel is designed for system administrators only. All actions are logged and monitored for security purposes.
