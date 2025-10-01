# Testing Quick Start Guide

## 🚀 Get Started in 2 Minutes

### 1. Install Dependencies (Already Done)

```bash
npm install
```

### 2. Run Tests

```bash
# Watch mode (recommended for development)
npm test

# Run once (for CI/CD)
npm run test:run

# With coverage
npm run test:coverage

# With UI
npm run test:ui
```

### 3. Write Your First Test

Create a file: `src/tests/unit/myService.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest'

describe('MyService', () => {
  let myService
  
  beforeEach(async () => {
    const module = await import('../../services/myService.js')
    myService = module.default
  })

  it('should do something', () => {
    const result = myService.doSomething()
    expect(result).toBeDefined()
  })
})
```

## 📁 File Structure

```
src/tests/
├── setup.js                    # Global setup
├── mocks/
│   └── firebase.mock.js        # Firebase mocks
├── unit/                       # Unit tests
├── integration/                # Integration tests
└── components/                 # Component tests
```

## 🎯 Common Test Patterns

### Unit Test Template

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('ServiceName', () => {
  let service
  
  beforeEach(async () => {
    const module = await import('../../services/service.js')
    service = module.default
  })

  it('should perform action', () => {
    expect(service.method).toBeDefined()
  })
})
```

### Component Test Template

```javascript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import Component from '../../components/Component.svelte'

describe('Component', () => {
  it('should render', () => {
    const { container } = render(Component, {
      props: { someProp: 'value' }
    })
    
    expect(container).toBeDefined()
  })
})
```

### Integration Test Template

```javascript
import { describe, it, expect, beforeEach } from 'vitest'

describe('Feature Integration', () => {
  it('should complete workflow', async () => {
    // Arrange
    const data = global.testUtils.createMockPatient()
    
    // Act
    const result = await service.createPatient(data)
    
    // Assert
    expect(result).toBeDefined()
  })
})
```

## 🛠️ Test Utilities

### Mock Data Helpers

```javascript
// Create mock patient
const patient = global.testUtils.createMockPatient()

// Create mock user
const user = global.testUtils.createMockUser()

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
})
```

## ✅ Testing Checklist

Before committing code, ensure:

- [ ] All tests pass (`npm run test:run`)
- [ ] New features have tests
- [ ] Coverage is maintained
- [ ] HIPAA compliance verified
- [ ] No console errors
- [ ] Tests are independent
- [ ] Mock data is used
- [ ] Accessibility tested

## 🎨 Flowbite Testing

When testing components with Flowbite:

```javascript
it('should use Flowbite small theme', () => {
  const { container } = render(Component)
  // Check for Flowbite classes
  expect(container).toBeDefined()
})
```

## 🔒 HIPAA Compliance Tests

Always test:

```javascript
it('should enforce doctor-patient isolation', async () => {
  const doctor1Patients = await service.getPatientsByDoctorId('doctor-1')
  const doctor2Patients = await service.getPatientsByDoctorId('doctor-2')
  
  expect(doctor1Patients).not.toEqual(doctor2Patients)
})
```

## 📊 Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical workflows
- **Component Tests**: All user-facing components

## 🐛 Debugging Tests

```javascript
// Log component output
const { debug } = render(Component)
debug()

// Check mock calls
console.log(mockFn.mock.calls)

// Wait for conditions
await vi.waitFor(() => {
  expect(condition).toBe(true)
})
```

## 🚦 CI/CD Integration

In your CI pipeline:

```yaml
- name: Run Tests
  run: npm run test:run

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## 📚 Learn More

- [Full Testing Guide](./TESTING_BEST_PRACTICES.md)
- [HIPAA Compliance](./HIPAA_COMPLIANCE_CHECKLIST.md)
- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)

## 💡 Pro Tips

1. **Run tests in watch mode** while developing
2. **Use descriptive test names** - they're documentation
3. **Test behavior, not implementation**
4. **Keep tests simple and focused**
5. **Mock external dependencies**
6. **Test error cases too**
7. **Follow AAA pattern** (Arrange, Act, Assert)

## 🎯 Example: Complete Test Suite

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import PatientForm from '../../components/PatientForm.svelte'

describe('PatientForm', () => {
  describe('Rendering', () => {
    it('should render form fields', () => {
      const { container } = render(PatientForm)
      expect(container).toBeDefined()
    })
  })

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const { container } = render(PatientForm)
      const form = container.querySelector('form')
      await fireEvent.submit(form)
      // Check for validation errors
    })
  })

  describe('User Interaction', () => {
    it('should handle input', async () => {
      const user = userEvent.setup()
      const { container } = render(PatientForm)
      const input = container.querySelector('input')
      await user.type(input, 'John')
      expect(input.value).toBe('John')
    })
  })

  describe('Events', () => {
    it('should dispatch submit event', async () => {
      const handleSubmit = vi.fn()
      const { component } = render(PatientForm)
      component.$on('patient-added', handleSubmit)
      // Trigger submit
    })
  })

  describe('HIPAA Compliance', () => {
    it('should require doctor ID', () => {
      // Verify doctor isolation
      expect(PatientForm).toBeDefined()
    })
  })
})
```

---

**Happy Testing! 🎉**

Remember: Good tests make good code. They're not just a safety net—they're documentation, design feedback, and confidence builders.

