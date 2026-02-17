import { describe, it, expect } from 'vitest';
import { getGuideViewState } from '../src/utils/guideViewState.js';

describe('guide view state regression', () => {
  it('shows patients view when on patients and not forcing guide details', () => {
    const state = getGuideViewState({
      currentView: 'patients',
      guideForcePatientDetails: false,
      selectedPatient: null
    });

    expect(state.showPatientsView).toBe(true);
    expect(state.showPrescriptionsView).toBe(false);
  });

  it('forces prescriptions view when guide details is active (step 12 regression)', () => {
    const state = getGuideViewState({
      currentView: 'patients',
      guideForcePatientDetails: true,
      selectedPatient: null
    });

    expect(state.showPatientsView).toBe(false);
    expect(state.showPrescriptionsView).toBe(true);
  });

  it('shows prescriptions view when a patient is selected', () => {
    const state = getGuideViewState({
      currentView: 'patients',
      guideForcePatientDetails: false,
      selectedPatient: { id: 'p1' }
    });

    expect(state.showPatientsView).toBe(true);
    expect(state.showPrescriptionsView).toBe(true);
  });
});
