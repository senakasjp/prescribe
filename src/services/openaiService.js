// OpenAI Service for AI-powered medical recommendations
// This service provides AI-generated recommendations based on patient symptoms

import aiTokenTracker from './aiTokenTracker.js'

class OpenAIService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY
    this.baseURL = 'https://api.openai.com/v1'
  }

  // Check if API key is configured
  isConfigured() {
    return this.apiKey && this.apiKey !== 'undefined' && this.apiKey !== ''
  }

  // Generate AI recommendations based on symptoms
  async generateRecommendations(symptoms, patientAge = null, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.')
    }

    try {
      console.log('🤖 Generating AI recommendations for symptoms:', symptoms)

      // Prepare symptoms text
      const symptomsText = symptoms.map(symptom => 
        `${symptom.description} (Severity: ${symptom.severity}${symptom.duration ? `, Duration: ${symptom.duration}` : ''})`
      ).join(', ')

      // Create the prompt for medical recommendations
      const prompt = `As a medical AI assistant, analyze the following patient symptoms and provide professional medical recommendations. 

Patient Symptoms: ${symptomsText}
${patientAge ? `Patient Age: ${patientAge} years` : ''}

Please provide your response in the following structured format:

**Possible Conditions:**
- List potential diagnoses or conditions to consider

**Diagnostic Recommendations:**
- Recommended tests or examinations
- When to seek immediate medical attention

**Treatment Recommendations:**
- General treatment approaches
- Lifestyle modifications
- Follow-up considerations

**Important Notes:**
- Key warnings or red flags
- When to contact healthcare provider immediately

Format your response with clear headings and bullet points. Be concise but comprehensive. Remember this is for informational purposes only and should not replace professional medical consultation.`

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant that provides professional medical recommendations based on symptoms. Always emphasize that your recommendations are for informational purposes only and should not replace professional medical consultation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const recommendations = data.choices[0]?.message?.content || 'No recommendations available.'

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateRecommendations',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ AI recommendations generated successfully')
      return recommendations

    } catch (error) {
      console.error('❌ Error generating AI recommendations:', error)
      throw error
    }
  }

  // Generate medication suggestions based on symptoms
  async generateMedicationSuggestions(symptoms, currentMedications = [], doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('💊 Generating medication suggestions for symptoms:', symptoms)

      const symptomsText = symptoms.map(symptom => 
        `${symptom.description} (Severity: ${symptom.severity})`
      ).join(', ')

      const currentMedsText = currentMedications.length > 0 
        ? `Current medications: ${currentMedications.map(med => med.name).join(', ')}`
        : 'No current medications'

      const prompt = `As a medical AI assistant, suggest appropriate medications for the following symptoms. Consider drug interactions and contraindications.

Patient Symptoms: ${symptomsText}
${currentMedsText}

Please provide your response in the following structured format:

**Over-the-Counter Medications:**
- List OTC medications that might help
- Dosage recommendations
- Important considerations

**Prescription Medications:**
- Prescription medications to consider
- Typical dosages
- Special considerations

**Drug Interactions:**
- Important interactions to be aware of
- Contraindications
- Monitoring requirements

**Side Effects & Monitoring:**
- Common side effects to watch for
- When to discontinue
- Follow-up requirements

**Important Warnings:**
- Critical safety information
- When to avoid certain medications
- Emergency situations

Format your response with clear headings and bullet points. Remember this is for informational purposes only and should not replace professional medical consultation.`

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant that provides medication suggestions based on symptoms. Always emphasize professional medical consultation and consider drug interactions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.2
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const suggestions = data.choices[0]?.message?.content || 'No medication suggestions available.'

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateMedicationSuggestions',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ Medication suggestions generated successfully')
      return suggestions

    } catch (error) {
      console.error('❌ Error generating medication suggestions:', error)
      throw error
    }
  }

  // Local database of known dangerous drug interactions for safety validation
  getKnownDangerousInteractions() {
    return [
      // MAOI + SSRI combinations (extremely dangerous)
      {
        drugs: ['phenelzine', 'isocarboxazid', 'tranylcypromine', 'selegiline', 'rasagiline'],
        interactions: ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'],
        severity: 'critical',
        description: 'MAOI + SSRI: Extremely dangerous — risk of serotonin syndrome (high fever, agitation, muscle rigidity, seizures, even death). There must be at least 14 days between stopping MAOI and starting SSRI.'
      },
      // Warfarin interactions
      {
        drugs: ['warfarin'],
        interactions: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'celecoxib'],
        severity: 'high',
        description: 'Warfarin + NSAIDs: Increased bleeding risk. Monitor INR closely.'
      },
      // Digoxin interactions
      {
        drugs: ['digoxin'],
        interactions: ['furosemide', 'hydrochlorothiazide', 'spironolactone'],
        severity: 'high',
        description: 'Digoxin + Diuretics: Risk of digoxin toxicity due to potassium depletion.'
      },
      // Lithium interactions
      {
        drugs: ['lithium'],
        interactions: ['furosemide', 'hydrochlorothiazide', 'ibuprofen', 'naproxen'],
        severity: 'high',
        description: 'Lithium + NSAIDs/Diuretics: Increased lithium levels, risk of toxicity.'
      },
      // ACE inhibitors + potassium supplements
      {
        drugs: ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
        interactions: ['potassium chloride', 'potassium citrate', 'spironolactone'],
        severity: 'high',
        description: 'ACE Inhibitors + Potassium: Risk of hyperkalemia (high potassium levels).'
      }
    ]
  }

  // Check for known dangerous interactions locally first
  checkLocalDangerousInteractions(prescriptions) {
    const dangerousInteractions = this.getKnownDangerousInteractions()
    const medicationNames = prescriptions.map(p => p.name.toLowerCase().trim())
    
    for (const interaction of dangerousInteractions) {
      const hasFirstDrug = interaction.drugs.some(drug => 
        medicationNames.some(med => med.includes(drug))
      )
      const hasSecondDrug = interaction.interactions.some(drug => 
        medicationNames.some(med => med.includes(drug))
      )
      
      if (hasFirstDrug && hasSecondDrug) {
        return {
          hasInteractions: true,
          interactions: `🚨 DANGEROUS INTERACTION DETECTED 🚨\n\n${interaction.description}\n\n**ACTION REQUIRED:** Do NOT take these medications together. Consult a healthcare professional immediately.`,
          severity: interaction.severity,
          isLocalDetection: true
        }
      }
    }
    
    return null
  }

  // Enhanced parsing for AI response to catch more interaction types
  parseAIInteractionResponse(analysis) {
    const lowerAnalysis = analysis.toLowerCase()
    
    // More comprehensive interaction detection
    const hasInteractions = !lowerAnalysis.includes('no significant drug interactions detected') && 
                           !lowerAnalysis.includes('no interactions found') &&
                           !lowerAnalysis.includes('no known interactions') &&
                           !lowerAnalysis.includes('no drug interactions') &&
                           (lowerAnalysis.includes('interaction') || 
                            lowerAnalysis.includes('contraindication') ||
                            lowerAnalysis.includes('warning') ||
                            lowerAnalysis.includes('caution') ||
                            lowerAnalysis.includes('avoid') ||
                            lowerAnalysis.includes('risk') ||
                            lowerAnalysis.includes('dangerous') ||
                            lowerAnalysis.includes('severe') ||
                            lowerAnalysis.includes('serotonin syndrome') ||
                            lowerAnalysis.includes('toxicity') ||
                            lowerAnalysis.includes('bleeding risk'))

    // Enhanced severity detection
    let severity = 'low'
    if (lowerAnalysis.includes('critical') || 
        lowerAnalysis.includes('severe') || 
        lowerAnalysis.includes('dangerous') ||
        lowerAnalysis.includes('contraindication') ||
        lowerAnalysis.includes('serotonin syndrome') ||
        lowerAnalysis.includes('fatal') ||
        lowerAnalysis.includes('death') ||
        lowerAnalysis.includes('emergency')) {
      severity = 'critical'
    } else if (lowerAnalysis.includes('major') || 
               lowerAnalysis.includes('high') || 
               lowerAnalysis.includes('significant') ||
               lowerAnalysis.includes('serious') ||
               lowerAnalysis.includes('toxicity') ||
               lowerAnalysis.includes('bleeding risk')) {
      severity = 'high'
    } else if (lowerAnalysis.includes('moderate') || 
               lowerAnalysis.includes('medium') ||
               lowerAnalysis.includes('caution') ||
               lowerAnalysis.includes('warning')) {
      severity = 'moderate'
    }

    return { hasInteractions, severity }
  }

  // Check for drug interactions between current prescriptions
  async checkDrugInteractions(prescriptions, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      if (!prescriptions || prescriptions.length < 2) {
        return {
          hasInteractions: false,
          interactions: 'No drug interactions to check (less than 2 medications).',
          severity: 'none'
        }
      }

      console.log('🔍 Checking drug interactions for prescriptions:', prescriptions)

      // First, check for known dangerous interactions locally
      const localDangerousInteraction = this.checkLocalDangerousInteractions(prescriptions)
      if (localDangerousInteraction) {
        console.log('🚨 Local dangerous interaction detected:', localDangerousInteraction)
        return localDangerousInteraction
      }

      const medicationNames = prescriptions.map(prescription => prescription.name).join(', ')

      const prompt = `As a medical AI assistant, analyze the following medications for potential drug interactions.

Current Prescriptions: ${medicationNames}

Please analyze these medications and provide a structured response in the following format:

**INTERACTION ANALYSIS:**
- Check for known drug-drug interactions
- Identify potential contraindications
- Assess severity levels (Minor, Moderate, Major, Severe, Critical)

**SPECIFIC INTERACTIONS:**
- List any specific interactions found
- Explain the mechanism and potential effects
- Provide monitoring recommendations

**SEVERITY ASSESSMENT:**
- Overall risk level (Low, Moderate, High, Critical)
- Key warnings for healthcare providers
- When to seek immediate medical attention

**MONITORING RECOMMENDATIONS:**
- What to watch for
- Recommended follow-up intervals
- Signs of adverse reactions

IMPORTANT: If you find ANY interactions, contraindications, or warnings, clearly state them. Do not say "no significant interactions" if there are any concerns. Be thorough in checking for:
- Serotonin syndrome risks (MAOI + SSRI combinations)
- Bleeding risks (warfarin + NSAIDs)
- Toxicity risks (lithium + diuretics)
- Cardiovascular risks
- CNS depressant combinations

Format your response with clear headings and bullet points. If no significant interactions are found, state "No significant drug interactions detected" but still provide general monitoring advice. Remember this is for informational purposes only and should not replace professional medical consultation.`

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant specializing in drug interaction analysis. Provide accurate, evidence-based information about medication interactions while emphasizing the need for professional medical consultation. Be thorough in identifying ALL potential interactions and contraindications.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const analysis = data.choices[0]?.message?.content || 'Unable to analyze drug interactions.'

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'checkDrugInteractions',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      // Enhanced parsing of AI response
      const { hasInteractions, severity } = this.parseAIInteractionResponse(analysis)

      console.log('✅ Drug interaction analysis completed:', { hasInteractions, severity })

      return {
        hasInteractions,
        interactions: analysis,
        severity
      }

    } catch (error) {
      console.error('❌ Error checking drug interactions:', error)
      throw error
    }
  }

  // Generate combined analysis (recommendations + medication suggestions) in single call
  async generateCombinedAnalysis(symptoms, currentMedications = [], patientAge = null, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('🤖 Generating combined AI analysis...')

      // Optimized symptom formatting
      const symptomsText = symptoms.map(symptom => symptom.description).join(', ')
      
      // Optimized medication formatting
      const currentMedsText = currentMedications.length > 0 
        ? `Current medications: ${currentMedications.map(med => med.name).join(', ')}`
        : 'No current medications'

      // Single comprehensive but concise prompt
      const prompt = `Patient symptoms: ${symptomsText}${patientAge ? `, Age: ${patientAge}` : ''}
${currentMedsText}

Provide concise medical analysis:

**Possible Conditions:**
- List 2-3 most likely conditions

**Treatment Recommendations:**
- Key medications to consider (OTC and prescription)
- Important dosages and considerations

**Drug Interactions:**
- Critical interactions with current medications
- Key warnings

**Red Flags:**
- When to seek immediate medical attention

Be brief and focused. Medical information only.`

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Medical assistant. Provide concise analysis with clear sections. Be brief but comprehensive for medical decision-making.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 600,  // Single response instead of two separate calls
          temperature: 0.2
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const combinedAnalysis = data.choices[0]?.message?.content || 'No analysis available.'

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateCombinedAnalysis',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ Combined AI analysis generated')

      return {
        combinedAnalysis,
        recommendations: combinedAnalysis,
        medicationSuggestions: combinedAnalysis
      }

    } catch (error) {
      console.error('❌ Error generating combined analysis:', error)
      throw error
    }
  }
}

// Create singleton instance
const openaiService = new OpenAIService()

export default openaiService
