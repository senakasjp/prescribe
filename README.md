# Prescribe - Medical Prescription Management System

A comprehensive medical prescription management system built with Svelte, Firebase, and Flowbite UI components. The system provides separate portals for doctors, pharmacists, and administrators to manage patient data, prescriptions, and medication tracking with AI-powered drug suggestions.

## 🚀 Features

### Doctor Portal
- **Patient Management**: Create, view, and manage patient records
- **Prescription Creation**: Build prescriptions with AI-powered drug suggestions
- **Medical History**: Track patient symptoms, reports, and diagnoses
- **AI Integration**: Get intelligent drug recommendations based on patient context
- **Token Management**: Monitor AI usage with quota tracking

### Pharmacist Portal
- **Prescription Management**: View and manage prescriptions from doctors
- **Inventory Tracking**: Monitor medication stock levels
- **Doctor Connections**: Connect with doctors for prescription delivery
- **Status Updates**: Update prescription fulfillment status

### Admin Portal
- **User Management**: Manage doctors and pharmacists
- **Analytics Dashboard**: Monitor system usage and performance
- **Token Quota Management**: Set and monitor AI token quotas
- **System Configuration**: Configure global settings

### AI-Powered Features
- **Drug Suggestions**: AI-generated medication recommendations
- **Medical Analysis**: Comprehensive medical analysis and insights
- **Drug Interactions**: Check for potential drug interactions
- **Context Awareness**: Personalized suggestions based on patient data

## 🛠️ Technology Stack

- **Frontend**: Svelte 5.x, Tailwind CSS, Flowbite UI
- **Backend**: Firebase Firestore, Firebase Auth, Firebase Hosting
- **AI**: OpenAI API for drug suggestions and medical analysis
- **Charts**: ApexCharts for data visualization
- **PDF**: jsPDF for prescription generation
- **Icons**: Font Awesome (free icons)

## 📚 Documentation

### User Guides
- **[BEGINNER_GUIDE.md](./BEGINNER_GUIDE.md)** - Complete step-by-step guide for new users
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card for common tasks
- **[USER_GUIDE.md](./USER_GUIDE.md)** - Detailed user manual for all features

### Developer Documentation
- **[TECHNICAL_IMPLEMENTATION.md](./TECHNICAL_IMPLEMENTATION.md)** - Technical documentation
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - API reference guide

### Testing Documentation
- **[TESTING_QUICK_START.md](./TESTING_QUICK_START.md)** - Get started with testing in 2 minutes
- **[TESTING_BEST_PRACTICES.md](./TESTING_BEST_PRACTICES.md)** - Comprehensive testing guide
- **[TEST_IMPLEMENTATION_SUMMARY.md](./TEST_IMPLEMENTATION_SUMMARY.md)** - Testing implementation summary

## 📋 Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher
- Firebase CLI
- OpenAI API key

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Prescribe
```

### 2. Install Dependencies
   ```bash
   npm install
   ```

### 3. Environment Setup
Create `.env.local` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_OPENAI_API_KEY=your_openai_api_key
```

### 4. Firebase Setup
```bash
firebase login
firebase init
```

### 5. Run Development Server
```bash
 npm run dev
 ```

### 6. Build for Production
```bash
npm run build
```

### 7. Deploy to Firebase
```bash
firebase deploy
```

## 🧪 Testing

### Run Tests
```bash
# Watch mode (recommended for development)
npm test

# Run once (CI/CD mode)
npm run test:run

# Generate coverage report
npm run test:coverage

# Run with UI dashboard
npm run test:ui
```

### Test Coverage
- **115 tests** implemented
- **93 tests passing** (81% success rate)
- **Unit tests**: Service and utility testing
- **Integration tests**: Complete workflow testing
- **Component tests**: Svelte component testing
- **HIPAA compliance**: Data isolation and privacy testing

### Testing Documentation
- **[TESTING_QUICK_START.md](./TESTING_QUICK_START.md)** - Quick start guide
- **[TESTING_BEST_PRACTICES.md](./TESTING_BEST_PRACTICES.md)** - Best practices
- **[TEST_IMPLEMENTATION_SUMMARY.md](./TEST_IMPLEMENTATION_SUMMARY.md)** - Implementation details

## 📁 Project Structure

```
src/
├── components/
│   ├── AdminDashboard.svelte      # Admin portal
│   ├── PatientDetails.svelte      # Patient management
│   ├── PatientManagement.svelte   # Patient list and overview
│   ├── PharmacistDashboard.svelte # Pharmacist portal
│   ├── PharmacistManagement.svelte # Pharmacist management
│   ├── AIRecommendations.svelte   # AI drug suggestions
│   ├── PrescriptionsTab.svelte    # Prescription management
│   ├── ConfirmationModal.svelte   # Flowbite confirmation dialogs
│   ├── LoadingSpinner.svelte      # Loading indicator
│   └── ThreeDots.svelte          # Inline loading indicator
├── services/
│   ├── firebaseStorage.js         # Firebase operations
│   ├── openaiService.js          # AI integration
│   ├── aiTokenTracker.js         # Token management
│   └── authService.js            # Authentication
├── stores/
│   └── notifications.js          # Notification system
├── tests/
│   ├── setup.js                  # Global test configuration
│   ├── mocks/
│   │   └── firebase.mock.js      # Firebase mocks
│   ├── unit/                     # Unit tests
│   │   ├── firebaseStorage.test.js
│   │   └── authService.test.js
│   ├── integration/              # Integration tests
│   │   └── patientManagement.test.js
│   └── components/               # Component tests
│       ├── PatientForm.test.js
│       └── ConfirmationModal.test.js
└── firebase-config.js            # Firebase configuration
```

## 🔧 Configuration

### Firebase Configuration
The system uses Firebase for:
- **Authentication**: User login and session management
- **Firestore**: NoSQL database for data storage
- **Hosting**: Static site hosting
- **Storage**: File storage for documents

### OpenAI Configuration
AI features require OpenAI API key for:
- Drug suggestion generation
- Medical analysis
- Drug interaction checking
- Context-aware recommendations

### Security Features
- **Doctor Isolation**: Each doctor can only access their own patients
- **Role-based Access**: Different permissions for doctors, pharmacists, and admins
- **Data Validation**: Input sanitization and validation
- **HIPAA Compliance**: Patient data protection and privacy

## 📊 Key Features

### Patient Management
- Create and manage patient records
- Track medical history and symptoms
- Manage prescriptions and medications
- View current and long-term medications

### AI Integration
- Intelligent drug suggestions based on symptoms
- Medical analysis and insights
- Drug interaction checking
- Context-aware recommendations

### Prescription Workflow
- Create new prescriptions
- Add medications manually or via AI suggestions
- Generate professional PDF prescriptions
- Send prescriptions to connected pharmacies

### Analytics and Monitoring
- AI token usage tracking
- Prescription analytics
- User activity monitoring
- System performance metrics

## 🎨 UI/UX Features

### Modern Design
- **Flowbite UI**: Consistent, modern component library
- **Responsive Design**: Mobile-first approach
- **Teal Theme**: Professional medical color scheme
- **Accessibility**: WCAG compliant design

### User Experience
- **Intuitive Navigation**: Easy-to-use interface
- **Real-time Updates**: Live data synchronization
- **Loading States**: Clear feedback during operations
- **Error Handling**: Graceful error management

## 🔒 Security

### Data Protection
- Patient data encryption in transit
- Secure API key management
- Role-based access control
- Audit logging capabilities

### Privacy Compliance
- HIPAA-compliant data handling
- Doctor-patient data isolation
- Secure authentication
- Data retention policies

## 📈 Performance

### Optimization Features
- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: Minimized JavaScript and CSS
- **Caching**: Efficient data caching strategies
- **Responsive Images**: Optimized image loading

### Monitoring
- Performance metrics tracking
- Error monitoring and logging
- User engagement analytics
- API usage monitoring

## 🧪 Testing

### Test Coverage
- Unit tests for components
- Integration tests for services
- End-to-end tests for workflows
- Performance testing

### Quality Assurance
- Code linting and formatting
- Accessibility testing
- Cross-browser compatibility
- Mobile responsiveness testing

## 📚 Documentation

- [Implementation Overview](IMPLEMENTATION_OVERVIEW.md)
- [Technical Implementation](TECHNICAL_IMPLEMENTATION.md)
- [Component Guide](COMPONENT_GUIDE.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Changelog](CHANGELOG.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the troubleshooting guide
- Create an issue in the repository
- Contact the development team

## 🔄 Version History

### Version 2.0.0 (Current)
- Major UI/UX overhaul with Flowbite
- AI token management system
- Enhanced patient data management
- Improved prescription workflow
- Notification system overhaul

### Version 1.0.0
- Initial release
- Core functionality
- Basic UI components
- Firebase integration

## 🚀 Roadmap

### Planned Features
- Advanced analytics dashboard
- Mobile app development
- Integration with pharmacy systems
- Enhanced AI capabilities
- Multi-language support
- Offline functionality

### Technical Improvements
- Enhanced testing suite
- Performance optimizations
- Security enhancements
- Accessibility improvements
- Code quality improvements

---

**Built with ❤️ for the medical community**