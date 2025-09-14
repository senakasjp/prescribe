<script>
  import { createEventDispatcher } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  
  const dispatch = createEventDispatcher()
  
  let email = ''
  let password = ''
  let loading = false
  let error = ''
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address')
      }
      
      // Validate password
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      
      // Attempt admin sign in
      const admin = await adminAuthService.signInAdmin(email, password)
      console.log('✅ Admin signed in successfully:', admin)
      
      // Dispatch success event
      dispatch('admin-signed-in', admin)
      
    } catch (err) {
      console.error('❌ Admin sign in error:', err)
      error = err.message
    } finally {
      loading = false
    }
  }
  
  // Handle demo login (for development)
  const handleDemoLogin = () => {
    email = 'senakahks@gmail.com'
    password = 'admin123'
  }
</script>

<div class="admin-login-container">
  <div class="container-fluid vh-100 d-flex align-items-center justify-content-center bg-light">
    <div class="row w-100 justify-content-center">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card shadow-lg border-0">
          <div class="card-header bg-danger text-white text-center py-4">
            <div class="mb-3">
              <i class="fas fa-shield-alt fa-3x"></i>
            </div>
            <h4 class="mb-0">
              <i class="fas fa-user-shield me-2"></i>
              Admin Panel
            </h4>
            <p class="mb-0 mt-2 opacity-75">System Administration</p>
          </div>
          
          <div class="card-body p-4">
            <!-- Error Message -->
            {#if error}
              <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                {error}
                <button type="button" class="btn-close" on:click={() => error = ''}></button>
              </div>
            {/if}
            
            <!-- Login Form -->
            <form on:submit={handleSubmit}>
              <div class="mb-3">
                <label for="admin-email" class="form-label">
                  <i class="fas fa-envelope me-2"></i>Admin Email
                </label>
                <input
                  type="email"
                  class="form-control form-control-sm"
                  id="admin-email"
                  bind:value={email}
                  placeholder="Enter admin email"
                  required
                  disabled={loading}
                />
              </div>
              
              <div class="mb-4">
                <label for="admin-password" class="form-label">
                  <i class="fas fa-lock me-2"></i>Password
                </label>
                <input
                  type="password"
                  class="form-control form-control-sm"
                  id="admin-password"
                  bind:value={password}
                  placeholder="Enter admin password"
                  required
                  disabled={loading}
                />
              </div>
              
              <div class="d-grid gap-2">
                <button
                  type="submit"
                  class="btn btn-danger btn-sm"
                  disabled={loading}
                >
                  {#if loading}
                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                    Signing In...
                  {:else}
                    <i class="fas fa-sign-in-alt me-2"></i>
                    Sign In to Admin Panel
                  {/if}
                </button>
              </div>
            </form>
            
            <!-- Demo Login Button (for development) -->
            <div class="mt-4 text-center">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                on:click={handleDemoLogin}
                disabled={loading}
              >
                <i class="fas fa-flask me-2"></i>
                Demo Login
              </button>
            </div>
          </div>
          
          <div class="card-footer bg-light text-center py-3">
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              Authorized personnel only
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .admin-login-container {
    min-height: 100vh;
  }
  
  .card {
    border-radius: 0.5rem;
  }
  
  .card-header {
    border-radius: 0.5rem 0.5rem 0 0 !important;
  }
  
  .form-control:focus {
    border-color: #dc3545;
    box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
  }
  
  .btn-danger:hover {
    background-color: #b02a37;
    border-color: #a02834;
  }
</style>
