# 🤖 Admin Panel Documentation

## Overview

The Admin Panel provides system administrators with comprehensive access to manage and monitor the M-Prescribe Patient Management System.

## 🔐 Admin Access

### Admin Credentials
- **Email**: `senakahks@gmail.com`
- **Password**: `M-PrescribeAdmin2024!`

### Access Methods
1. **From Doctor Login Page**: Click "Admin Panel" button
2. **From Main App**: Click "Admin" button in the navigation bar (when logged in as doctor)

## 🎯 Features

### 1. System Overview Dashboard
- **Statistics Cards**: View total doctors, patients, prescriptions, and symptoms
- **Recent Activity**: Monitor system usage and activities
- **Quick Actions**: Refresh data and system status

### 2. Doctors Management
- **View All Doctors**: Complete list of registered doctors
- **Doctor Details**: Email, name, role, creation date
- **Patient Count**: Number of patients per doctor
- **System-wide Statistics**: Total doctors registered

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

### 1. Accessing Admin Panel
1. Navigate to the main application
2. Click "Admin Panel" button (available on login page and main app)
3. Enter admin credentials
4. Access the admin dashboard

### 2. Navigating the Dashboard
- **Overview Tab**: System statistics and recent activity
- **Doctors Tab**: Manage and view all registered doctors
- **Patients Tab**: View all patients across the system
- **AI Usage Tab**: Monitor AI token usage and costs
- **System Tab**: System settings and quick actions

### 3. Admin Actions
- **Sign Out**: Use the dropdown menu in the top-right corner
- **Back to App**: Use the "Back to App" button (top-right corner)
- **Refresh Data**: Use refresh buttons to update statistics

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
