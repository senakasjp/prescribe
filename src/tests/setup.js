/**
 * Test Setup File
 * 
 * This file runs before all tests to configure the testing environment.
 * It sets up:
 * - DOM matchers from @testing-library/jest-dom
 * - Firebase mocks
 * - Global test utilities
 * - Environment variables for testing
 */

import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
import.meta.env.VITE_USE_FIREBASE = 'false'
import.meta.env.VITE_ENABLE_MIGRATION = 'false'

// Global test utilities
global.testUtils = {
  // Wait for async operations
  wait: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    country: 'United States',
    city: 'New York',
    role: 'doctor',
    createdAt: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock patient data
  createMockPatient: (overrides = {}) => ({
    id: 'test-patient-id',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    gender: 'male',
    dateOfBirth: '1990-01-01',
    age: '34',
    weight: '70',
    bloodGroup: 'A+',
    idNumber: 'ID123456',
    address: '123 Test St',
    allergies: 'None',
    emergencyContact: 'Jane Doe',
    emergencyPhone: '+0987654321',
    doctorId: 'test-doctor-id',
    createdAt: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock prescription data
  createMockPrescription: (overrides = {}) => ({
    id: 'test-prescription-id',
    patientId: 'test-patient-id',
    doctorId: 'test-doctor-id',
    medications: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock medication data
  createMockMedication: (overrides = {}) => ({
    id: 'test-medication-id',
    name: 'Test Medication',
    dosage: '500mg',
    frequency: 'Twice daily',
    duration: '7 days',
    instructions: 'Take with food',
    startDate: new Date().toISOString(),
    ...overrides
  })
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})

