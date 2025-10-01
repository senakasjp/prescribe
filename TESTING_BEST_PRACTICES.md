# Testing Best Practices Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Testing Philosophy](#testing-philosophy)
3. [Test Structure](#test-structure)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [Component Testing](#component-testing)
7. [Running Tests](#running-tests)
8. [Writing Good Tests](#writing-good-tests)
9. [Common Patterns](#common-patterns)
10. [HIPAA Compliance Testing](#hipaa-compliance-testing)

## Overview

This project uses **Vitest** as the test runner with **@testing-library/svelte** for component testing. The testing setup is designed to ensure code quality, maintain HIPAA compliance, and verify doctor-patient data isolation.

### Tech Stack

- **Test Runner**: Vitest
- **Component Testing**: @testing-library/svelte
- **Mocking**: Vitest built-in mocks + custom Firebase mocks
- **DOM Environment**: happy-dom
- **Coverage**: Vitest coverage (v8 provider)

### Project Structure

```
src/
├── tests/
│   ├── setup.js                 # Global test configuration
│   ├── mocks/
│   │   └── firebase.mock.js     # Firebase service mocks
│   ├── unit/
│   │   ├── firebaseStorage.test.js
│   │   └── authService.test.js
│   ├── integration/
│   │   └── patientManagement.test.js
│   └── components/
│       ├── PatientForm.test.js
│       └── ConfirmationModal.test.js
```

## Testing Philosophy

### 1. **Test Behavior, Not Implementation**

❌ **Bad**: Testing internal state
```javascript
it('should set loading to true', () => {
  expect(component.loading).toBe(true)
})
```

✅ **Good**: Testing user-visible behavior
```javascript
it('should show loading spinner during submission', () => {
  const { getByRole } = render(Component)
  expect(getByRole('status')).toBeInTheDocument()
})
```

### 2. **Follow AAA Pattern**

Always structure tests as:
- **Arrange**: Set up test data and conditions
- **Act**: Perform the action being tested
- **Assert**: Verify the expected outcome

```javascript
it('should create a patient with valid data', async () => {
  // Arrange
  const patientData = global.testUtils.createMockPatient()
  
  // Act
  const result = await firebaseStorage.createPatient(patientData)
  
  // Assert
  expect(result).toBeDefined()
  expect(result.id).toBeTruthy()
})
```

### 3. **Test HIPAA Compliance**

Every test involving patient data should verify:
- ✅ Data isolation between doctors
- ✅ Authentication requirements
- ✅ Audit trail (createdAt, updatedAt)
- ✅ No cross-doctor access

## Test Structure

### Unit Tests

Unit tests verify individual functions and services in isolation.

**Location**: `src/tests/unit/`

**Example**:
```javascript
describe('FirebaseStorage Service - Patient Operations', () => {
  let firebaseStorage
  
  beforeEach(async () => {
    resetFirebaseMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('should create a patient with valid data', async () => {
    const patientData = global.testUtils.createMockPatient()
    expect(firebaseStorage.createPatient).toBeDefined()
  })
})
```

### Integration Tests

Integration tests verify that multiple services work together correctly.

**Location**: `src/tests/integration/`

**Example**:
```javascript
describe('Patient Management Integration Tests', () => {
  it('should create patient → add symptoms → create prescription', async () => {
    // Test complete workflow
    const patient = await firebaseStorage.createPatient(patientData)
    const symptom = await firebaseStorage.createSymptom(symptomData)
    const prescription = await firebaseStorage.createPrescription(prescriptionData)
    
    expect(patient).toBeDefined()
    expect(symptom).toBeDefined()
    expect(prescription).toBeDefined()
  })
})
```

### Component Tests

Component tests verify Svelte components render correctly and handle user interactions.

**Location**: `src/tests/components/`

**Example**:
```javascript
describe('PatientForm Component', () => {
  it('should render all required form fields', () => {
    const { container } = render(PatientForm)
    expect(container).toBeDefined()
  })

  it('should handle form submission', async () => {
    const handleSubmit = vi.fn()
    const { component } = render(PatientForm)
    
    component.$on('patient-added', handleSubmit)
    
    // Fill form and submit
    // ...
  })
})
```

## Unit Testing

### Best Practices

1. **Test one thing at a time**
2. **Use descriptive test names**
3. **Keep tests independent**
4. **Mock external dependencies**
5. **Test edge cases and error conditions**

### Example: Testing a Service Method

```javascript
describe('createPatient', () => {
  it('should create a patient with valid data', async () => {
    const patientData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      doctorId: 'doctor-123'
    }
    
    const result = await firebaseStorage.createPatient(patientData)
    
    expect(result).toBeDefined()
    expect(result.id).toBeTruthy()
    expect(result.firstName).toBe('John')
  })

  it('should validate required fields', async () => {
    const invalidData = { firstName: '' }
    
    // Should handle validation
    expect(firebaseStorage.createPatient).toBeDefined()
  })

  it('should generate unique patient IDs', () => {
    const id1 = firebaseStorage.generateId()
    const id2 = firebaseStorage.generateId()
    
    expect(id1).not.toBe(id2)
  })
})
```

## Integration Testing

### Best Practices

1. **Test realistic workflows**
2. **Verify data flows between services**
3. **Test error recovery**
4. **Ensure HIPAA compliance**

### Example: Testing Complete Workflow

```javascript
describe('Complete Patient Workflow', () => {
  it('should handle patient lifecycle', async () => {
    // 1. Create patient
    const patient = await firebaseStorage.createPatient(patientData)
    expect(patient.id).toBeTruthy()
    
    // 2. Add symptoms
    const symptom = await firebaseStorage.createSymptom({
      patientId: patient.id,
      symptom: 'Headache'
    })
    expect(symptom.patientId).toBe(patient.id)
    
    // 3. Create prescription
    const prescription = await firebaseStorage.createPrescription({
      patientId: patient.id,
      doctorId: 'doctor-123'
    })
    expect(prescription.patientId).toBe(patient.id)
    
    // 4. Add medication
    const medication = await firebaseStorage.addMedicationToPrescription(
      prescription.id,
      { name: 'Aspirin', dosage: '100mg' }
    )
    expect(medication).toBeDefined()
  })
})
```

## Component Testing

### Best Practices

1. **Test user interactions**
2. **Verify accessibility**
3. **Test responsive behavior**
4. **Follow Flowbite guidelines**

### Example: Testing User Interaction

```javascript
describe('PatientForm Component', () => {
  it('should handle text input', async () => {
    const user = userEvent.setup()
    const { container } = render(PatientForm)
    
    const firstNameInput = container.querySelector('input[id="firstName"]')
    await user.type(firstNameInput, 'John')
    
    expect(firstNameInput.value).toBe('John')
  })

  it('should dispatch event on form submission', async () => {
    const handleSubmit = vi.fn()
    const { component } = render(PatientForm)
    
    component.$on('patient-added', handleSubmit)
    
    // Fill and submit form
    // ...
    
    expect(handleSubmit).toHaveBeenCalled()
  })
})
```

## Running Tests

### Commands

```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Watch Mode

In watch mode, tests automatically re-run when files change:

```bash
npm test
```

Press:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename
- `t` - Filter by test name
- `q` - Quit

### Coverage Reports

Generate coverage report:

```bash
npm run test:coverage
```

View coverage in:
- Terminal output
- HTML report: `coverage/index.html`
- JSON report: `coverage/coverage-final.json`

### CI/CD Integration

For continuous integration:

```bash
npm run test:run
```

This runs tests once and exits with appropriate exit code.

## Writing Good Tests

### ✅ DO

1. **Write descriptive test names**
   ```javascript
   it('should validate email format before creating account', () => {})
   ```

2. **Use test utilities**
   ```javascript
   const patient = global.testUtils.createMockPatient()
   ```

3. **Test user behavior**
   ```javascript
   it('should show error when email is invalid', () => {})
   ```

4. **Clean up after tests**
   ```javascript
   afterEach(() => {
     vi.clearAllMocks()
   })
   ```

5. **Test accessibility**
   ```javascript
   it('should have proper ARIA labels', () => {})
   ```

### ❌ DON'T

1. **Test implementation details**
   ```javascript
   // Bad: Testing internal state
   expect(component._internal).toBe(true)
   ```

2. **Write dependent tests**
   ```javascript
   // Bad: Test relies on previous test
   it('should have patient from previous test', () => {})
   ```

3. **Ignore edge cases**
   ```javascript
   // Bad: Only testing happy path
   it('should work with valid data', () => {})
   ```

4. **Make tests too complex**
   ```javascript
   // Bad: Testing multiple unrelated things
   it('should create, update, delete, and validate', () => {})
   ```

## Common Patterns

### 1. Testing Async Operations

```javascript
it('should handle async operations', async () => {
  const result = await firebaseStorage.createPatient(data)
  expect(result).toBeDefined()
})
```

### 2. Testing Error Handling

```javascript
it('should handle errors gracefully', async () => {
  const invalidData = { /* invalid */ }
  
  // Service should handle errors
  expect(firebaseStorage.createPatient).toBeDefined()
})
```

### 3. Testing Events

```javascript
it('should dispatch events', async () => {
  const handleEvent = vi.fn()
  const { component } = render(Component)
  
  component.$on('custom-event', handleEvent)
  
  // Trigger event
  // ...
  
  expect(handleEvent).toHaveBeenCalled()
})
```

### 4. Testing with Mocks

```javascript
it('should use mocked Firebase', async () => {
  resetFirebaseMocks()
  
  mockDocSnapshot.data.mockReturnValue({
    id: 'test-id',
    name: 'Test'
  })
  
  const result = await firebaseStorage.getPatient('test-id')
  expect(result.name).toBe('Test')
})
```

### 5. Testing User Interactions

```javascript
it('should handle user clicks', async () => {
  const user = userEvent.setup()
  const { container } = render(Component)
  
  const button = container.querySelector('button')
  await user.click(button)
  
  // Assert expected behavior
})
```

## HIPAA Compliance Testing

### Critical Requirements

All tests must verify:

1. **Doctor-Patient Isolation**
   ```javascript
   it('should only return patients for specific doctor', async () => {
     const doctor1Patients = await firebaseStorage.getPatientsByDoctorId('doctor-1')
     const doctor2Patients = await firebaseStorage.getPatientsByDoctorId('doctor-2')
     
     expect(doctor1Patients).not.toEqual(doctor2Patients)
   })
   ```

2. **Authentication Required**
   ```javascript
   it('should require authentication for patient operations', async () => {
     // Should verify authentication
     expect(firebaseStorage.getPatientsByDoctorId).toBeDefined()
   })
   ```

3. **Audit Trail**
   ```javascript
   it('should maintain audit trail', () => {
     const patient = global.testUtils.createMockPatient()
     expect(patient.createdAt).toBeDefined()
     expect(patient.updatedAt).toBeDefined()
   })
   ```

4. **No Cross-Doctor Access**
   ```javascript
   it('should prevent cross-doctor data access', async () => {
     expect(firebaseStorage.getPatientsByDoctorId).toBeDefined()
     expect(firebaseStorage.getPatientsByDoctorId.length).toBe(1)
   })
   ```

### HIPAA Test Checklist

- [ ] Data isolation verified
- [ ] Authentication enforced
- [ ] Audit trail present
- [ ] No data leakage
- [ ] Encryption validated (if applicable)
- [ ] Access logs maintained

## Test Utilities

### Global Test Utilities

The `global.testUtils` object provides helper functions:

```javascript
// Create mock user
const user = global.testUtils.createMockUser({
  email: 'custom@example.com'
})

// Create mock patient
const patient = global.testUtils.createMockPatient({
  firstName: 'Custom Name'
})

// Create mock prescription
const prescription = global.testUtils.createMockPrescription()

// Create mock medication
const medication = global.testUtils.createMockMedication()

// Wait for async operations
await global.testUtils.wait(100)
```

### Firebase Mocks

```javascript
import { resetFirebaseMocks, mockDocSnapshot } from '../mocks/firebase.mock.js'

beforeEach(() => {
  resetFirebaseMocks()
  
  // Customize mock data
  mockDocSnapshot.data.mockReturnValue({
    id: 'custom-id',
    custom: 'data'
  })
})
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout: `{ timeout: 10000 }`
   - Check for unresolved promises
   - Verify async/await usage

2. **Mocks not working**
   - Ensure mocks are imported before the module
   - Use `vi.mock()` at the top of the file
   - Call `resetFirebaseMocks()` in `beforeEach`

3. **Component not rendering**
   - Check for missing props
   - Verify imports are correct
   - Look for console errors

4. **Events not firing**
   - Component tests may not trigger events in test environment
   - Verify event names match
   - Check event listeners are attached

### Debug Tips

```javascript
// Log component state
const { component, debug } = render(Component)
console.log(component)
debug() // Prints DOM

// Log mock calls
console.log(mockFunction.mock.calls)

// Wait for assertions
await vi.waitFor(() => {
  expect(condition).toBe(true)
})
```

## Best Practices Summary

✅ **Do**:
- Write tests for all critical functionality
- Test user behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Test error cases and edge cases
- Verify HIPAA compliance
- Keep tests independent
- Use test utilities
- Follow Flowbite guidelines

❌ **Don't**:
- Test implementation details
- Write dependent tests
- Ignore accessibility
- Skip error handling tests
- Hardcode test data
- Leave tests failing
- Test third-party libraries
- Commit debugging code

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro)
- [HIPAA Compliance Guide](./HIPAA_COMPLIANCE_CHECKLIST.md)
- [Project Testing Guide](./TESTING_GUIDE.md)

---

**Remember**: Good tests are an investment in code quality and maintainability. They serve as documentation and catch bugs before they reach production.

