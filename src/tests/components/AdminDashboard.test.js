import { render, screen, within, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AdminDashboard from '../../components/AdminDashboard.svelte';
import firebaseStorage from '../../services/firebaseStorage.js';
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
    getEmailTemplate: vi.fn().mockResolvedValue(null),
    saveMessagingTemplates: vi.fn().mockResolvedValue(null),
    saveWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    savePatientWelcomeEmailTemplate: vi.fn().mockResolvedValue(null),
    saveAppointmentReminderEmailTemplate: vi.fn().mockResolvedValue(null),
    saveEmailTemplate: vi.fn().mockResolvedValue(null),
    savePaymentReminderEmailTemplate: vi.fn().mockResolvedValue(null),
    savePaymentThanksEmailTemplate: vi.fn().mockResolvedValue(null),
    updateDoctor: vi.fn().mockResolvedValue(null),
    getEmailLogs: vi.fn().mockResolvedValue([]),
    getAuthLogs: vi.fn().mockResolvedValue([])
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
    getDoctorUsageStats: vi.fn(() => null)
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
});
