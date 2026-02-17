import { render, screen, within, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AdminDashboard from '../../components/AdminDashboard.svelte';
import firebaseStorage from '../../services/firebaseStorage.js';
import aiTokenTracker from '../../services/aiTokenTracker.js';
import { auth } from '../../firebase-config.js';

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getAllDoctors: vi.fn().mockResolvedValue([]),
    getPatientsByDoctorId: vi.fn().mockResolvedValue([]),
    getPrescriptionsByPatientId: vi.fn().mockResolvedValue([]),
    getSymptomsByPatientId: vi.fn().mockResolvedValue([]),
    getIllnessesByPatientId: vi.fn().mockResolvedValue([]),
    getWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    getPatientWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    getAppointmentReminderEmailTemplate: vi.fn().mockResolvedValue(null),
    getDoctorBroadcastEmailTemplate: vi.fn().mockResolvedValue(null),
    getSmtpSettings: vi.fn().mockResolvedValue(null),
    getMessagingTemplates: vi.fn().mockResolvedValue(null),
    getPaymentPricingSettings: vi.fn().mockResolvedValue(null),
    getAIModelSettings: vi.fn().mockResolvedValue(null),
    getEmailTemplate: vi.fn().mockResolvedValue(null),
    saveMessagingTemplates: vi.fn().mockResolvedValue(null),
    savePaymentPricingSettings: vi.fn().mockResolvedValue(null),
    saveAIModelSettings: vi.fn().mockResolvedValue(null),
    saveWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    savePatientWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    saveAppointmentReminderEmailTemplate: vi.fn().mockResolvedValue(null),
    saveEmailTemplate: vi.fn().mockResolvedValue(null),
    savePaymentReminderEmailTemplate: vi.fn().mockResolvedValue(null),
    savePaymentThanksEmailTemplate: vi.fn().mockResolvedValue(null),
    updateDoctor: vi.fn().mockResolvedValue(null),
    getEmailLogs: vi.fn().mockResolvedValue([]),
    getAuthLogs: vi.fn().mockResolvedValue([]),
    getSmsLogs: vi.fn().mockResolvedValue([]),
    getDoctorPaymentRecords: vi.fn().mockResolvedValue([]),
    getDoctorAIUsageStatsMap: vi.fn().mockResolvedValue({}),
    getDoctorAIUsageStats: vi.fn().mockResolvedValue({
      total: { tokens: 0, cost: 0, requests: 0 },
      today: { tokens: 0, cost: 0, requests: 0 }
    }),
    getAllDoctorAIUsageSummary: vi.fn().mockResolvedValue({
      total: { tokens: 0, cost: 0, requests: 0 },
      today: { tokens: 0, cost: 0, requests: 0 },
      thisMonth: { tokens: 0, cost: 0, requests: 0 },
      weeklyUsage: [],
      monthlyUsage: [],
      recentRequests: [],
      lastUpdated: null
    }),
    getDoctorReferralWalletStats: vi.fn().mockResolvedValue({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    }),
    getDoctorById: vi.fn().mockResolvedValue(null),
    addDoctorPaymentRecord: vi.fn().mockResolvedValue(null),
    getPromoCodes: vi.fn().mockResolvedValue([]),
    createPromoCode: vi.fn().mockResolvedValue({
      id: 'promo-1',
      code: 'WELCOME25',
      percentOff: 25,
      maxRedemptions: 100,
      redemptionCount: 0,
      isActive: true,
      validUntil: '2026-12-31T00:00:00.000Z'
    }),
    updatePromoCodeStatus: vi.fn().mockResolvedValue(null),
    generatePromoCode: vi.fn(() => 'NEWDOC25'),
    normalizePromoCode: vi.fn((value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
  }
}));

vi.mock('../../services/adminAuthService.js', () => ({
  default: {
    signOutAdmin: vi.fn()
  }
}));

vi.mock('../../services/aiTokenTracker.js', () => ({
  default: {
    getUsageStats: vi.fn(() => ({
      total: { tokens: 0, cost: 0, requests: 0 },
      today: { tokens: 0, cost: 0, requests: 0 },
      thisMonth: { tokens: 0, cost: 0, requests: 0 },
      lastUpdated: null
    })),
    migrateRequestsWithMissingDoctorId: vi.fn(() => 0),
    getDoctorUsageStats: vi.fn(() => null),
    getAllDoctorsWithQuotas: vi.fn(() => []),
    getDefaultQuota: vi.fn(() => 1000000),
    getTokenPricePerMillion: vi.fn(() => 4.0),
    setDoctorQuota: vi.fn(),
    setDefaultQuota: vi.fn(),
    applyDefaultQuotaToAllDoctors: vi.fn(() => 0),
    setTokenPricePerMillion: vi.fn(),
    getAllModelPricing: vi.fn(() => ({
      'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
      'gpt-4o': { prompt: 0.005, completion: 0.015 }
    })),
    setModelPricing: vi.fn(),
    removeModelPricing: vi.fn()
  }
}));

vi.mock('../../firebase-config.js', () => ({
  auth: { currentUser: null }
}));

describe('AdminDashboard.svelte', () => {
  it('shows the Messaging templates menu', async () => {
    const user = userEvent.setup();
    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await screen.findByRole('button', { name: 'Messaging' });
    await user.click(screen.getByRole('button', { name: 'Messaging' }));

    expect(screen.getByRole('heading', { name: 'Messaging' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument();
  });

  it('shows the Email templates menu', async () => {
    const user = userEvent.setup();
    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await screen.findByRole('button', { name: 'Email' });
    await user.click(screen.getByRole('button', { name: 'Email' }));

    expect(screen.getByRole('heading', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument();
  });

  it('loads payment pricing settings in admin payments tab', async () => {
    const user = userEvent.setup();
    firebaseStorage.getPaymentPricingSettings.mockResolvedValueOnce({
      monthlyUsd: 29,
      annualUsd: 290,
      monthlyLkr: 6500,
      annualLkr: 65000,
      appliesTo: 'all_customers',
      enabled: true
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Payments' }));

    expect(await screen.findByLabelText('USD monthly price')).toHaveValue(29);
    expect(screen.getByLabelText('USD annual price')).toHaveValue(290);
    expect(screen.getByLabelText('LKR monthly price')).toHaveValue(6500);
    expect(screen.getByLabelText('LKR annual price')).toHaveValue(65000);
    expect(screen.getByLabelText('Apply pricing to')).toHaveValue('all_customers');
  });

  it('saves payment pricing settings with selected scope', async () => {
    const user = userEvent.setup();

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Payments' }));

    const monthlyUsdInput = await screen.findByLabelText('USD monthly price');
    const annualUsdInput = screen.getByLabelText('USD annual price');
    const monthlyLkrInput = screen.getByLabelText('LKR monthly price');
    const annualLkrInput = screen.getByLabelText('LKR annual price');

    await user.clear(monthlyUsdInput);
    await user.type(monthlyUsdInput, '35');
    await user.clear(annualUsdInput);
    await user.type(annualUsdInput, '350');
    await user.clear(monthlyLkrInput);
    await user.type(monthlyLkrInput, '7000');
    await user.clear(annualLkrInput);
    await user.type(annualLkrInput, '70000');
    await user.selectOptions(screen.getByLabelText('Apply pricing to'), 'new_customers');

    await user.click(screen.getByRole('button', { name: 'Save Pricing' }));

    expect(firebaseStorage.savePaymentPricingSettings).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.savePaymentPricingSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyUsd: 35,
        annualUsd: 350,
        monthlyLkr: 7000,
        annualLkr: 70000,
        appliesTo: 'new_customers',
        enabled: true
      })
    );
  });

  it('saves payment pricing settings with custom pricing disabled', async () => {
    const user = userEvent.setup();

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Payments' }));

    const enableToggle = await screen.findByLabelText('Enable custom pricing');
    await user.click(enableToggle);
    await user.click(screen.getByRole('button', { name: 'Save Pricing' }));

    expect(firebaseStorage.savePaymentPricingSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false
      })
    );
  });

  it('loads AI model settings in AI usage tab', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAIModelSettings.mockResolvedValueOnce({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-4o-mini'
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'AI Usage' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    expect(await screen.findByLabelText('Image analysis model')).toHaveValue('gpt-4.1-mini');
    expect(screen.getByLabelText('Other analysis model')).toHaveValue('gpt-4.1');
    expect(screen.getByLabelText('Spell and grammar model')).toHaveValue('gpt-4o-mini');
    const modelOptions = Array.from(document.querySelectorAll('datalist#aiModelOptions option')).map((option) => option.value);
    expect(modelOptions).toContain('gpt-5');
    expect(screen.getByLabelText('Image analysis model')).toHaveAttribute('list', 'aiModelOptions');
  });

  it('saves AI model settings from AI usage tab', async () => {
    const user = userEvent.setup();

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'AI Usage' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    const imageModelInput = await screen.findByLabelText('Image analysis model');
    const otherModelInput = screen.getByLabelText('Other analysis model');
    const spellModelInput = screen.getByLabelText('Spell and grammar model');

    await user.clear(imageModelInput);
    await user.type(imageModelInput, 'gpt-4.1-mini');
    await user.clear(otherModelInput);
    await user.type(otherModelInput, 'gpt-4.1');
    await user.clear(spellModelInput);
    await user.type(spellModelInput, 'gpt-4.1-mini');

    await user.click(screen.getByRole('button', { name: 'Save AI Models' }));

    expect(firebaseStorage.saveAIModelSettings).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveAIModelSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAnalysisModel: 'gpt-4.1-mini',
        otherAnalysisModel: 'gpt-4.1',
        spellGrammarModel: 'gpt-4.1-mini',
        updatedBy: 'admin@test.com'
      })
    );
  });

  it('falls back to default model names when AI model inputs are blank', async () => {
    const user = userEvent.setup();

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'AI Usage' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    const imageModelInput = await screen.findByLabelText('Image analysis model');
    const otherModelInput = screen.getByLabelText('Other analysis model');
    const spellModelInput = screen.getByLabelText('Spell and grammar model');

    await user.clear(imageModelInput);
    await user.clear(otherModelInput);
    await user.clear(spellModelInput);

    await user.click(screen.getByRole('button', { name: 'Save AI Models' }));

    expect(firebaseStorage.saveAIModelSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAnalysisModel: 'gpt-4o-mini',
        otherAnalysisModel: 'gpt-4o-mini',
        spellGrammarModel: 'gpt-4o-mini'
      })
    );
  });

  it('saves per-model pricing from AI usage tab', async () => {
    const user = userEvent.setup();

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'AI Usage' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    const pricingSection = (await screen.findByRole('heading', { name: 'Model Pricing' })).closest('div.bg-gray-50');
    expect(pricingSection).not.toBeNull();
    const pricingScope = within(pricingSection);
    const modelInputs = pricingScope.getAllByPlaceholderText('model-name');
    const pricingNumberInputs = pricingScope.getAllByRole('spinbutton');

    await user.clear(modelInputs[0]);
    await user.type(modelInputs[0], 'gpt-4.1-mini');
    await user.clear(pricingNumberInputs[0]);
    await user.type(pricingNumberInputs[0], '0.0002');
    await user.clear(pricingNumberInputs[1]);
    await user.type(pricingNumberInputs[1], '0.0008');

    await user.click(pricingScope.getByRole('button', { name: 'Save Pricing' }));

    expect(aiTokenTracker.setModelPricing).toHaveBeenCalledWith('gpt-4.1-mini', 0.0002, 0.0008);
  });

  it('saves messaging templates updates', async () => {
    const user = userEvent.setup();
    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Messaging' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const registrationSection = screen.getByText('Registration').closest('div.border');
    const appointmentSection = screen.getByText('Appointment Reminder').closest('div.border');
    expect(registrationSection).not.toBeNull();
    expect(appointmentSection).not.toBeNull();

    const registrationTextarea = registrationSection.querySelector('textarea');
    const appointmentTextarea = appointmentSection.querySelector('textarea');
    expect(registrationTextarea).not.toBeNull();
    expect(appointmentTextarea).not.toBeNull();

    await user.clear(registrationTextarea);
    await user.type(registrationTextarea, ' Welcome name ');
    await user.clear(appointmentTextarea);
    await user.type(appointmentTextarea, ' Reminder doctor ');

    await user.click(screen.getByRole('button', { name: 'Save Templates' }));

    expect(firebaseStorage.saveMessagingTemplates).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveMessagingTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationTemplate: 'Welcome name',
        appointmentReminderTemplate: 'Reminder doctor'
      })
    );
  });

  it('loads and saves the welcome email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getWelcomeEmailTemplate.mockResolvedValueOnce({
      subject: 'Hello Doctors',
      text: 'Welcome text',
      html: '<p>Welcome</p>',
      fromName: 'Prescribe Team',
      fromEmail: 'support@mprescribe.net',
      replyTo: 'help@mprescribe.net',
      textOnly: false,
      enabled: true
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const welcomeSection = screen.getByRole('heading', { name: 'Welcome Email' }).closest('div.bg-white');
    expect(welcomeSection).not.toBeNull();
    const welcomeScope = within(welcomeSection);

    const subjectInput = await welcomeScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Hello Doctors');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated subject');
    await user.click(welcomeScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveWelcomeEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveWelcomeEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Updated subject'
      })
    );
  });

  it('loads and saves the patient welcome email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getPatientWelcomeEmailTemplate.mockResolvedValueOnce({
      subject: 'Welcome patient',
      text: 'Hello patient',
      html: '<p>Hello patient</p>',
      fromName: 'Support',
      fromEmail: 'support@mprescribe.net',
      replyTo: 'reply@mprescribe.net',
      textOnly: false,
      enabled: true
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const patientSection = screen.getByRole('heading', { name: 'Patient Welcome Email' }).closest('div.bg-white');
    expect(patientSection).not.toBeNull();
    const patientScope = within(patientSection);

    const subjectInput = await patientScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Welcome patient');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated patient subject');
    await user.click(patientScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.savePatientWelcomeEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.savePatientWelcomeEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Updated patient subject'
      })
    );
  });

  it('loads and saves the appointment reminder email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAppointmentReminderEmailTemplate.mockResolvedValueOnce({
      subject: 'Appointment reminder',
      text: 'Reminder text',
      html: '<p>Reminder</p>',
      fromName: 'Clinic',
      fromEmail: 'support@mprescribe.net',
      replyTo: 'reply@mprescribe.net',
      textOnly: false,
      enabled: true
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const appointmentSection = screen.getByRole('heading', { name: 'Appointment Reminder Email' }).closest('div.bg-white');
    expect(appointmentSection).not.toBeNull();
    const appointmentScope = within(appointmentSection);

    const subjectInput = await appointmentScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Appointment reminder');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated appointment subject');
    await user.click(appointmentScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveAppointmentReminderEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveAppointmentReminderEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Updated appointment subject'
      })
    );
  });

  it('loads and saves the approval welcome email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getEmailTemplate.mockImplementation((templateId) => {
      if (templateId === 'approvalWelcomeEmail') {
        return Promise.resolve({
          subject: 'Approved',
          text: 'Approved text',
          html: '<p>Approved</p>',
          fromName: 'Prescribe',
          fromEmail: 'support@mprescribe.net',
          replyTo: 'reply@mprescribe.net',
          textOnly: false,
          enabled: true
        });
      }
      return Promise.resolve(null);
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const approvalSection = screen.getByRole('heading', { name: 'Approval Welcome Email' }).closest('div.bg-white');
    expect(approvalSection).not.toBeNull();
    const approvalScope = within(approvalSection);

    const subjectInput = await approvalScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Approved');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated approval subject');
    await user.click(approvalScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledWith(
      'approvalWelcomeEmail',
      expect.objectContaining({
        subject: 'Updated approval subject'
      })
    );
  });

  it('loads and saves the payment reminder email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getEmailTemplate.mockImplementation((templateId) => {
      if (templateId === 'paymentReminderEmail') {
        return Promise.resolve({
          subject: 'Payment reminder',
          text: 'Reminder text',
          html: '<p>Reminder</p>',
          fromName: 'Prescribe',
          fromEmail: 'support@mprescribe.net',
          replyTo: 'reply@mprescribe.net',
          textOnly: false
        });
      }
      return Promise.resolve(null);
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const paymentSection = screen.getByRole('heading', { name: 'Payment Reminder' }).closest('div.bg-white');
    expect(paymentSection).not.toBeNull();
    const paymentScope = within(paymentSection);

    const subjectInput = await paymentScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Payment reminder');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated payment reminder');
    await user.click(paymentScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledWith(
      'paymentReminderEmail',
      expect.objectContaining({
        subject: 'Updated payment reminder'
      })
    );
  });

  it('loads and saves the payment thank you email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getEmailTemplate.mockImplementation((templateId) => {
      if (templateId === 'paymentThanksEmail') {
        return Promise.resolve({
          subject: 'Payment thanks',
          text: 'Thanks text',
          html: '<p>Thanks</p>',
          fromName: 'Prescribe',
          fromEmail: 'support@mprescribe.net',
          replyTo: 'reply@mprescribe.net',
          textOnly: false
        });
      }
      return Promise.resolve(null);
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const thanksSection = screen.getByRole('heading', { name: 'Payment Thank You' }).closest('div.bg-white');
    expect(thanksSection).not.toBeNull();
    const thanksScope = within(thanksSection);

    const subjectInput = await thanksScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Payment thanks');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated payment thanks');
    await user.click(thanksScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledWith(
      'paymentThanksEmail',
      expect.objectContaining({
        subject: 'Updated payment thanks'
      })
    );
  });

  it('loads and saves the other message email template', async () => {
    const user = userEvent.setup();
    firebaseStorage.getEmailTemplate.mockImplementation((templateId) => {
      if (templateId === 'doctorMessageEmail') {
        return Promise.resolve({
          subject: 'Other message',
          text: 'Other text',
          html: '<p>Other</p>',
          fromName: 'Prescribe',
          fromEmail: 'support@mprescribe.net',
          replyTo: 'reply@mprescribe.net',
          textOnly: false
        });
      }
      return Promise.resolve(null);
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const otherSection = screen.getByRole('heading', { name: 'Other Message' }).closest('div.bg-white');
    expect(otherSection).not.toBeNull();
    const otherScope = within(otherSection);

    const subjectInput = await otherScope.findByLabelText('Subject');
    expect(subjectInput).toHaveValue('Other message');

    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated other message');
    await user.click(otherScope.getByRole('button', { name: 'Save' }));

    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledTimes(1);
    expect(firebaseStorage.saveEmailTemplate).toHaveBeenCalledWith(
      'doctorMessageEmail',
      expect.objectContaining({
        subject: 'Updated other message'
      })
    );
  });

  it('sends a welcome email test template request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const welcomeSection = screen.getByRole('heading', { name: 'Welcome Email' }).closest('div.bg-white');
    expect(welcomeSection).not.toBeNull();
    const welcomeScope = within(welcomeSection);

    await user.click(welcomeScope.getByRole('button', { name: 'Test to senakahks@gmail.com' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"templateId":"welcomeEmail"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('sends approval welcome email to a selected doctor', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';
    firebaseStorage.getAllDoctors.mockResolvedValue([{ id: 'doc-1', email: 'doc@example.com', name: 'Dr. Demo' }]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    await screen.findByRole('option', { name: /Dr\. Demo|doc@example\.com/ });
    const doctorSelect = screen.getByTestId('single-doctor-select');
    const doctorOption = Array.from(doctorSelect.options).find(option => option.value === 'doc-1');
    if (doctorOption) {
      doctorOption.selected = true;
    }
    await fireEvent.change(doctorSelect, { target: { value: 'doc-1' } });
    await tick();

    const approvalSection = screen.getByRole('heading', { name: 'Approval Welcome Email' }).closest('div.bg-white');
    expect(approvalSection).not.toBeNull();
    const approvalScope = within(approvalSection);

    const sendButton = approvalScope.getByRole('button', { name: 'Send to selected doctor' });
    expect(sendButton).not.toBeDisabled();
    await user.click(sendButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"doctorId":"doc-1"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('approves a pending doctor and sends approval email automatically', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';
    firebaseStorage.getAllDoctors.mockResolvedValue([
      {
        id: 'doc-pending-1',
        email: 'pending@example.com',
        name: 'Dr. Pending',
        isApproved: false,
        isDisabled: false,
        role: 'doctor'
      }
    ]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    const approveButtons = await screen.findAllByRole('button', { name: 'Approve' });
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'doc-pending-1',
          isApproved: true,
          isDisabled: false
        })
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"templateId":"approvalWelcomeEmail"')
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        body: expect.stringContaining('"doctorId":"doc-pending-1"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('sends a doctor registration SMS test request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Messaging' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const doctorRegistrationSection = screen.getByText('Doctor Registration Confirm').closest('div.border');
    expect(doctorRegistrationSection).not.toBeNull();
    const doctorRegistrationScope = within(doctorRegistrationSection);

    await user.click(doctorRegistrationScope.getByRole('button', { name: 'Send Test SMS' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendSmsApi',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"recipient":"94712345678"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('sends a patient welcome email test template request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    const patientSection = screen.getByRole('heading', { name: 'Patient Welcome Email' }).closest('div.bg-white');
    expect(patientSection).not.toBeNull();
    const patientScope = within(patientSection);

    await user.click(patientScope.getByRole('button', { name: 'Test to senakahks@gmail.com' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendPatientTemplateEmail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"templateId":"patientWelcomeEmail"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('applies referral bonus when referred doctor is eligible', async () => {
    firebaseStorage.getAllDoctors.mockResolvedValue([
      {
        id: 'referrer-1',
        email: 'referrer@example.com',
        name: 'Dr. Referrer',
        isApproved: true,
        isDisabled: false,
        accessExpiresAt: '2026-01-10T00:00:00.000Z'
      },
      {
        id: 'referred-1',
        email: 'referred@example.com',
        name: 'Dr. Referred',
        isApproved: true,
        isDisabled: false,
        referredByDoctorId: 'referrer-1',
        referralEligibleAt: '2025-01-01T00:00:00.000Z',
        referralBonusApplied: false,
        accessExpiresAt: '2026-01-15T00:00:00.000Z'
      }
    ]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await waitFor(() => {
      expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'referred-1',
          referredByDoctorId: 'referrer-1',
          referralBonusApplied: true,
          referralBonusAppliedAt: expect.any(String)
        })
      );
    });

    expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'referrer-1',
        accessExpiresAt: expect.any(String)
      })
    );
  });

  it('sends a payment reminder email to a selected doctor', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('')
    });

    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example.test';
    firebaseStorage.getAllDoctors.mockResolvedValue([{ id: 'doc-2', email: 'doc2@example.com', name: 'Dr. Mail' }]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Templates' }));

    await screen.findByRole('option', { name: /Dr\. Mail|doc2@example\.com/ });
    const doctorSelect = screen.getByTestId('single-doctor-select');
    const doctorOption = Array.from(doctorSelect.options).find(option => option.value === 'doc-2');
    if (doctorOption) {
      doctorOption.selected = true;
    }
    await fireEvent.change(doctorSelect, { target: { value: 'doc-2' } });
    await tick();

    const paymentSection = screen.getByRole('heading', { name: 'Payment Reminder' }).closest('div.bg-white');
    expect(paymentSection).not.toBeNull();
    const paymentScope = within(paymentSection);

    await user.click(paymentScope.getByRole('button', { name: 'Send to selected doctor' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token'
        }),
        body: expect.stringContaining('"templateId":"paymentReminderEmail"')
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/sendDoctorTemplateEmail',
      expect.objectContaining({
        body: expect.stringContaining('"doctorId":"doc-2"')
      })
    );

    vi.unstubAllGlobals();
  });

  it('shows SMS logs tab and loads SMS logs when opening system logs', async () => {
    const user = userEvent.setup();
    firebaseStorage.getSmsLogs.mockResolvedValueOnce([
      {
        id: 'sms-1',
        createdAt: '2026-02-15T08:30:00.000Z',
        type: 'patient-welcome',
        status: 'sent',
        to: '+94771234567',
        doctorId: 'doctor-1',
        error: ''
      }
    ]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Logs' }));

    await waitFor(() => {
      expect(firebaseStorage.getSmsLogs).toHaveBeenCalledWith(200);
    });

    expect(screen.getByRole('button', { name: 'SMS Logs' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'SMS Logs' }));
    expect(screen.getByText('SMS delivery attempts (latest 200).')).toBeInTheDocument();
    expect(screen.getByText('patient-welcome')).toBeInTheDocument();
  });

  it('shows doctor billing wallet records and referral free months in doctor details', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-wallet-1',
        email: 'wallet@test.com',
        name: 'Dr. Wallet',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        accessExpiresAt: '2026-03-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-wallet-1',
      email: 'wallet@test.com',
      name: 'Dr. Wallet',
      role: 'doctor',
      paymentStatus: 'paid',
      walletMonths: 3,
      accessExpiresAt: '2026-05-01T00:00:00.000Z'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: 'rec-1',
        createdAt: '2026-02-15T08:30:00.000Z',
        type: 'stripe_payment',
        monthsDelta: 1,
        amount: 20,
        currency: 'USD',
        source: 'stripe',
        status: 'paid',
        referenceId: 'sub_test_1',
        note: 'professional_monthly_usd'
      }
    ]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 2,
      referralBonusAppliedCount: 1,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 1
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('Billing Wallet')).toBeInTheDocument();
    expect(await screen.findByText('Referral Free Months Available')).toBeInTheDocument();
    expect(await screen.findByText('1 month')).toBeInTheDocument();
    expect(await screen.findByText('stripe_payment')).toBeInTheDocument();
  });

  it('derives billing wallet summary cards from payment records when doctor wallet fields are missing', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-derived-1',
        email: 'derived@test.com',
        name: 'Dr. Derived',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-derived-1',
      email: 'derived@test.com',
      name: 'Dr. Derived',
      role: 'doctor'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: 'rec-derived-confirmed',
        createdAt: '2026-02-15T08:30:00.000Z',
        type: 'stripe_checkout',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripeCheckoutLogs',
        status: 'confirmed',
        referenceId: 'cs_test_confirmed'
      },
      {
        id: 'rec-derived-created',
        createdAt: '2026-02-16T08:30:00.000Z',
        type: 'stripe_checkout',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripeCheckoutLogs',
        status: 'created',
        referenceId: 'cs_test_created'
      }
    ]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('Billing Wallet')).toBeInTheDocument();
    expect(await screen.findByText('1 month')).toBeInTheDocument();
    expect(await screen.findByText(/^created$/i)).toBeInTheDocument();
    expect(await screen.findByText(/\/03\/2026/)).toBeInTheDocument();
  });

  it('loads doctor details billing data and refreshes wallet records with doctor email fallback', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockReset();
    firebaseStorage.getDoctorById.mockReset();
    firebaseStorage.getDoctorPaymentRecords.mockReset();
    firebaseStorage.getDoctorReferralWalletStats.mockReset();

    firebaseStorage.getAllDoctors.mockResolvedValue([
      {
        id: 'doc-live-1',
        email: 'live@test.com',
        name: 'Dr. Live',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        accessExpiresAt: '2026-03-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById
      .mockResolvedValueOnce({
        id: 'doc-live-1',
        email: 'live@test.com',
        name: 'Dr. Live',
        role: 'doctor',
        paymentStatus: 'paid',
        walletMonths: 4,
        accessExpiresAt: '2026-06-01T00:00:00.000Z'
      })
      .mockResolvedValueOnce({
        id: 'doc-live-1',
        email: 'live@test.com',
        name: 'Dr. Live',
        role: 'doctor',
        paymentStatus: 'paid',
        walletMonths: 5,
        accessExpiresAt: '2026-07-01T00:00:00.000Z'
      });
    firebaseStorage.getDoctorPaymentRecords
      .mockResolvedValueOnce([
        {
          id: 'rec-live-1',
          createdAt: '2026-02-15T08:30:00.000Z',
          type: 'stripe_payment',
          monthsDelta: 1,
          amount: 20,
          currency: 'USD',
          source: 'stripe',
          status: 'paid',
          referenceId: 'cs_live_1',
          note: 'professional_monthly_usd'
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'rec-live-2',
          createdAt: '2026-03-15T08:30:00.000Z',
          type: 'stripe_payment',
          monthsDelta: 1,
          amount: 20,
          currency: 'USD',
          source: 'stripe',
          status: 'paid',
          referenceId: 'cs_live_2',
          note: 'professional_monthly_usd'
        }
      ]);
    firebaseStorage.getDoctorReferralWalletStats
      .mockResolvedValueOnce({
        totalReferredDoctors: 3,
        referralBonusAppliedCount: 1,
        referralBonusPendingCount: 1,
        referralFreeMonthsAvailable: 1
      })
      .mockResolvedValueOnce({
        totalReferredDoctors: 3,
        referralBonusAppliedCount: 2,
        referralBonusPendingCount: 0,
        referralFreeMonthsAvailable: 2
      });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByRole('heading', { name: 'Doctor Details' })).toBeInTheDocument();
    expect(await screen.findByText('Dr. Live')).toBeInTheDocument();
    expect(await screen.findByText(/payment status/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/^paid$/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText('stripe_payment')).toBeInTheDocument();
    expect(await screen.findByText('4 months')).toBeInTheDocument();

    expect(firebaseStorage.getDoctorPaymentRecords).toHaveBeenCalledWith(
      'doc-live-1',
      200,
      'live@test.com'
    );

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(firebaseStorage.getDoctorPaymentRecords).toHaveBeenCalledTimes(2);
    });
    expect(firebaseStorage.getDoctorPaymentRecords).toHaveBeenLastCalledWith(
      'doc-live-1',
      200,
      'live@test.com'
    );
    expect(await screen.findByText('cs_live_2')).toBeInTheDocument();
  });

  it('shows AI token usage block in doctor details page', async () => {
    const user = userEvent.setup();
    firebaseStorage.getDoctorAIUsageStatsMap.mockResolvedValueOnce({
      'doc-token-1': {
        total: { tokens: 12000, cost: 0.3456, requests: 18 },
        today: { tokens: 3000, cost: 0.08, requests: 4 }
      }
    });
    firebaseStorage.getDoctorAIUsageStats.mockResolvedValueOnce({
      total: { tokens: 12000, cost: 0.3456, requests: 18 },
      today: { tokens: 3000, cost: 0.08, requests: 4 }
    });

    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-token-1',
        email: 'token@test.com',
        name: 'Dr. Token',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-token-1',
      email: 'token@test.com',
      name: 'Dr. Token',
      role: 'doctor'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('AI Token Usage')).toBeInTheDocument();
    expect(await screen.findByText('$0.3456')).toBeInTheDocument();
    expect(await screen.findByText('12K')).toBeInTheDocument();
    expect(await screen.findByText('18')).toBeInTheDocument();
  });

  it('loads token usage on doctors list from server usage map', async () => {
    const user = userEvent.setup();
    const doctorRawId = '11111'
    firebaseStorage.getDoctorAIUsageStatsMap.mockResolvedValueOnce({
      [doctorRawId]: {
        total: { tokens: 4200, cost: 0.1234, requests: 7 },
        today: { tokens: 0, cost: 0, requests: 0 }
      }
    });

    firebaseStorage.getAllDoctors.mockResolvedValue([
      {
        id: doctorRawId,
        email: 'list@test.com',
        name: 'Dr. List',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getPatientsByDoctorId.mockResolvedValue([]);

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await waitFor(() => {
      expect(firebaseStorage.getDoctorAIUsageStatsMap).toHaveBeenCalledWith([doctorRawId]);
    });
  });

  it('renders AI usage trend tables from server summary data', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctorAIUsageSummary.mockResolvedValueOnce({
      total: { tokens: 100, cost: 0.1, requests: 3 },
      today: { tokens: 40, cost: 0.04, requests: 1 },
      thisMonth: { tokens: 70, cost: 0.07, requests: 2 },
      weeklyUsage: [
        { date: '2026-02-17', tokens: 12, cost: 0.012, requests: 2 }
      ],
      monthlyUsage: [
        { month: '2026-02', tokens: 34, cost: 0.034, requests: 4 }
      ],
      recentRequests: [
        {
          id: 'req-1',
          timestamp: '2026-02-17T10:00:00.000Z',
          type: 'chatbotResponse',
          totalTokens: 12,
          cost: 0.012
        }
      ],
      lastUpdated: '2026-02-17T10:00:00.000Z'
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'AI Usage' }));

    expect(await screen.findByRole('heading', { name: /AI Usage Analytics/i })).toBeInTheDocument();
    expect(await screen.findByText('chatbotResponse')).toBeInTheDocument();
    expect(await screen.findAllByText('$0.0120')).toHaveLength(2);
    expect(await screen.findByText('34')).toBeInTheDocument();
  });

  it('shows only stripe success/fail rows in doctor billing history and hides pending rows', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-filter-1',
        email: 'filter@test.com',
        name: 'Dr. Filter',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-filter-1',
      email: 'filter@test.com',
      name: 'Dr. Filter',
      role: 'doctor'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: 'rec-created',
        createdAt: '2026-02-15T08:00:00.000Z',
        type: 'stripe_checkout',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripeCheckoutLogs',
        sourceCollection: 'stripeCheckoutLogs',
        status: 'created',
        referenceId: 'cs_created'
      },
      {
        id: 'rec-confirmed',
        createdAt: '2026-02-15T09:00:00.000Z',
        type: 'stripe_checkout',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripeCheckoutLogs',
        sourceCollection: 'stripeCheckoutLogs',
        status: 'confirmed',
        referenceId: 'cs_confirmed'
      },
      {
        id: 'rec-failed',
        createdAt: '2026-02-15T10:00:00.000Z',
        type: 'stripe_checkout',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripeCheckoutLogs',
        sourceCollection: 'stripeCheckoutLogs',
        status: 'failed',
        referenceId: 'cs_failed'
      }
    ]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('cs_confirmed')).toBeInTheDocument();
    expect(await screen.findByText('cs_failed')).toBeInTheDocument();
    expect(screen.queryByText('cs_created')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Months' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Reference' })).not.toBeInTheDocument();
  });

  it('can shrink and restore doctor billing history section', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-shrink-1',
        email: 'shrink@test.com',
        name: 'Dr. Shrink',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-shrink-1',
      email: 'shrink@test.com',
      name: 'Dr. Shrink',
      role: 'doctor'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: 'rec-shrink-1',
        createdAt: '2026-02-15T09:00:00.000Z',
        type: 'stripe_payment',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripe',
        status: 'confirmed',
        referenceId: 'cs_shrink_1'
      }
    ]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('cs_shrink_1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shrink history' }));
    expect(await screen.findByText('Billing history is collapsed.')).toBeInTheDocument();
    expect(screen.queryByText('cs_shrink_1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show history' }));
    expect(await screen.findByText('cs_shrink_1')).toBeInTheDocument();
  });

  it('deduplicates duplicate doctor billing rows in admin doctor view', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-dedupe-1',
        email: 'dedupe@test.com',
        name: 'Dr. Dedupe',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-dedupe-1',
      email: 'dedupe@test.com',
      name: 'Dr. Dedupe',
      role: 'doctor'
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: 'rec-dedupe-amount',
        createdAt: '2026-02-15T09:51:00.000Z',
        type: 'stripe_payment',
        monthsDelta: 1,
        amount: 5000,
        currency: 'LKR',
        source: 'stripe',
        status: 'confirmed',
        referenceId: 'cs_dedupe'
      },
      {
        id: 'rec-dedupe-zero',
        createdAt: '2026-02-15T09:51:30.000Z',
        type: 'stripe_payment',
        monthsDelta: 0,
        amount: 0,
        currency: '',
        source: 'stripe',
        status: 'confirmed',
        referenceId: 'in_dedupe'
      }
    ]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    expect(await screen.findByText('cs_dedupe')).toBeInTheDocument();
    expect(screen.queryByText('in_dedupe')).not.toBeInTheDocument();
  });

  it('saves doctor admin discount percent from doctor details page', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-discount-1',
        email: 'discount@test.com',
        name: 'Dr. Discount',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-discount-1',
      email: 'discount@test.com',
      name: 'Dr. Discount',
      role: 'doctor',
      adminStripeDiscountPercent: 15
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    const discountInput = await screen.findByLabelText('Discount percentage (0 to 100)');
    expect(discountInput).toHaveValue(15);

    await user.clear(discountInput);
    await user.type(discountInput, '35');
    await user.click(screen.getByRole('button', { name: 'Save Discount' }));

    expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-discount-1',
        adminStripeDiscountPercent: 35
      })
    );
  });

  it('clamps doctor admin discount percent to 100 when saving values above 100', async () => {
    const user = userEvent.setup();
    firebaseStorage.getAllDoctors.mockResolvedValueOnce([
      {
        id: 'doc-discount-2',
        email: 'discount2@test.com',
        name: 'Dr. Discount 2',
        role: 'doctor',
        isApproved: true,
        isDisabled: false,
        createdAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: 'doc-discount-2',
      email: 'discount2@test.com',
      name: 'Dr. Discount 2',
      role: 'doctor',
      adminStripeDiscountPercent: 0
    });
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([]);
    firebaseStorage.getDoctorReferralWalletStats.mockResolvedValueOnce({
      totalReferredDoctors: 0,
      referralBonusAppliedCount: 0,
      referralBonusPendingCount: 0,
      referralFreeMonthsAvailable: 0
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Doctors' }));
    await user.click((await screen.findAllByRole('button', { name: 'View' }))[0]);

    const discountInput = await screen.findByLabelText('Discount percentage (0 to 100)');
    await user.clear(discountInput);
    await user.type(discountInput, '250');
    await user.click(screen.getByRole('button', { name: 'Save Discount' }));

    expect(firebaseStorage.updateDoctor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-discount-2',
        adminStripeDiscountPercent: 100
      })
    );
  });

  it('creates a promo code from Promotions tab using generated/sanitized code', async () => {
    const user = userEvent.setup();
    firebaseStorage.getPromoCodes.mockResolvedValueOnce([]);
    firebaseStorage.generatePromoCode.mockReturnValueOnce('new*doc25');
    firebaseStorage.createPromoCode.mockResolvedValueOnce({
      id: 'promo-2',
      code: 'NEWDOC25',
      percentOff: 20,
      maxRedemptions: 100,
      redemptionCount: 0,
      isActive: true,
      validUntil: '2026-12-31T00:00:00.000Z'
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Promotions' }));

    const generateDraftButton = await screen.findByRole('button', { name: 'Generate' });
    await user.click(generateDraftButton);

    const customCodeInput = screen.getByLabelText('Custom code (optional)');
    expect(customCodeInput).toHaveValue('NEWDOC25');

    const discountInput = screen.getByLabelText('Discount %');
    await user.clear(discountInput);
    await user.type(discountInput, '20');

    await user.click(screen.getByRole('button', { name: 'Generate Promo Code' }));

    await waitFor(() => {
      expect(firebaseStorage.createPromoCode).toHaveBeenCalledTimes(1);
    });
    expect(firebaseStorage.createPromoCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NEWDOC25',
        percentOff: 20,
        createdBy: 'admin@test.com'
      })
    );
  });

  it('copies and toggles promo codes in Promotions table', async () => {
    const user = userEvent.setup();
    firebaseStorage.getPromoCodes.mockResolvedValueOnce([
      {
        id: 'promo-3',
        code: 'WELCOME50',
        percentOff: 50,
        maxRedemptions: 200,
        redemptionCount: 5,
        isActive: true,
        validUntil: '2026-12-31T00:00:00.000Z'
      }
    ]);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    render(AdminDashboard, {
      props: {
        currentAdmin: { id: 'admin-1', email: 'admin@test.com' }
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Promotions' }));
    await screen.findByText('WELCOME50');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('WELCOME50');

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => {
      expect(firebaseStorage.updatePromoCodeStatus).toHaveBeenCalledWith('promo-3', false);
    });
  });
});
