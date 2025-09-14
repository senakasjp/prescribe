// Admin Authentication Service
// Handles admin-specific authentication and authorization

class AdminAuthService {
  constructor() {
    this.adminEmail = 'senakahks@gmail.com'
    this.currentAdmin = null
    this.loadCurrentAdmin()
  }

  // Load current admin from localStorage
  loadCurrentAdmin() {
    try {
      const stored = localStorage.getItem('prescribe-current-admin')
      this.currentAdmin = stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Error loading current admin:', error)
      this.currentAdmin = null
    }
  }

  // Save current admin to localStorage
  saveCurrentAdmin(admin) {
    try {
      localStorage.setItem('prescribe-current-admin', JSON.stringify(admin))
      this.currentAdmin = admin
    } catch (error) {
      console.error('Error saving current admin:', error)
    }
  }

  // Clear current admin
  clearCurrentAdmin() {
    localStorage.removeItem('prescribe-current-admin')
    this.currentAdmin = null
  }

  // Check if email is admin
  isAdminEmail(email) {
    return email.toLowerCase() === this.adminEmail.toLowerCase()
  }

  // Admin sign in
  async signInAdmin(email, password) {
    try {
      // Check if email is admin email
      if (!this.isAdminEmail(email)) {
        throw new Error('Access denied. Admin privileges required.')
      }

      // For demo purposes, using a simple password check
      // In production, this should use proper authentication
      const adminPassword = 'admin123' // This should be more secure in production
      
      if (password !== adminPassword) {
        throw new Error('Invalid admin credentials')
      }

      // Create admin object
      const admin = {
        id: 'admin-001',
        email: email.toLowerCase(),
        role: 'admin',
        name: 'System Administrator',
        permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics'],
        lastLogin: new Date().toISOString()
      }

      // Set as current admin
      this.saveCurrentAdmin(admin)
      return admin
    } catch (error) {
      console.error('Error signing in admin:', error)
      throw error
    }
  }

  // Admin sign out
  async signOut() {
    this.clearCurrentAdmin()
  }

  // Get current admin
  getCurrentAdmin() {
    return this.currentAdmin
  }

  // Check if admin is authenticated
  isAuthenticated() {
    return this.currentAdmin !== null
  }

  // Check if user has specific permission
  hasPermission(permission) {
    if (!this.currentAdmin) return false
    return this.currentAdmin.permissions.includes(permission)
  }

  // Check if user is admin
  isAdmin() {
    return this.currentAdmin && this.currentAdmin.role === 'admin'
  }

  // Listen for auth state changes
  onAuthStateChanged(callback) {
    callback(this.currentAdmin)
    return () => {}
  }
}

// Create singleton instance
const adminAuthService = new AdminAuthService()

export default adminAuthService
