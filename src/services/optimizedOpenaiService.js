// Optimized OpenAI Service for reduced token usage
// This service implements various strategies to minimize token consumption

import aiTokenTracker from './aiTokenTracker.js'

class OptimizedOpenAIService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY
    this.baseURL = 'https://api.openai.com/v1'
  }

  // Check if API key is configured
  isConfigured() {
    return this.apiKey && this.apiKey !== 'undefined' && this.apiKey !== ''
  }

  // Optimized symptom text formatting - removes unnecessary details
  formatSymptomsOptimized(symptoms) {
    return symptoms.map(s => s.description).join(', ')
  }

  // Optimized medication text formatting
  formatMedicationsOptimized(medications) {
    return medications.map(m => m.name).join(', ')
  }

  // Generate optimized AI recommendations with minimal token usage
  async generateRecommendationsOptimized(symptoms, patientAge = null, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('🤖 Generating optimized AI recommendations...')

      // Use abbreviated symptom format
      const symptomsText = this.formatSymptomsOptimized(symptoms)
      
      // Minimal prompt - only essential information
      const prompt = `Analyze symptoms: ${symptomsText}${patientAge ? `, Age: ${patientAge}` : ''}

Provide:
1. Possible conditions
2. Key tests needed
3. Treatment options
4. Red flags

Be concise. Medical info only.`

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
              content: 'Medical assistant for qualified medical doctors. The reader is a qualified medical doctor. Be concise. Format: numbered lists only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 400,  // Reduced from 1000
          temperature: 0.1   // Lower for consistency
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
          'generateRecommendationsOptimized',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ Optimized AI recommendations generated')
      return recommendations

    } catch (error) {
      console.error('❌ Error generating optimized recommendations:', error)
      throw error
    }
  }

  // Optimized medication suggestions
  async generateMedicationSuggestionsOptimized(symptoms, currentMedications = [], doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('💊 Generating optimized medication suggestions...')

      const symptomsText = this.formatSymptomsOptimized(symptoms)
      const currentMedsText = currentMedications.length > 0 
        ? `Current: ${this.formatMedicationsOptimized(currentMedications)}`
        : 'No current medications'

      // Minimal prompt
      const prompt = `Symptoms: ${symptomsText}
${currentMedsText}

Suggest medications:
1. OTC options
2. Prescription options
3. Key interactions

Be brief. Medical info only.`

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
              content: 'Medical assistant for qualified medical doctors. The reader is a qualified medical doctor. Be concise. Format: numbered lists only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,  // Reduced from 800
          temperature: 0.1   // Lower for consistency
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
          'generateMedicationSuggestionsOptimized',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ Optimized medication suggestions generated')
      return suggestions

    } catch (error) {
      console.error('❌ Error generating optimized medication suggestions:', error)
      throw error
    }
  }

  // Optimized drug interaction checking
  async checkDrugInteractionsOptimized(prescriptions, doctorId = null) {
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

      console.log('🔍 Checking optimized drug interactions...')

      // First, check for known dangerous interactions locally
      const localDangerousInteraction = this.checkLocalDangerousInteractions(prescriptions)
      if (localDangerousInteraction) {
        console.log('🚨 Local dangerous interaction detected:', localDangerousInteraction)
        return localDangerousInteraction
      }

      const medicationNames = this.formatMedicationsOptimized(prescriptions)

      // Minimal prompt - focus only on critical interactions
      const prompt = `Check interactions: ${medicationNames}

Report only:
1. Critical interactions
2. Major warnings
3. Monitor recommendations

Be brief. Critical info only.`

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
              content: 'Medical assistant for qualified medical doctors. The reader is a qualified medical doctor. Report only critical interactions. Be concise.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,  // Reduced from 1000
          temperature: 0.05 // Very low for consistency
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
          'checkDrugInteractionsOptimized',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      // Simplified parsing
      const { hasInteractions, severity } = this.parseAIInteractionResponseOptimized(analysis)

      console.log('✅ Optimized drug interaction analysis completed:', { hasInteractions, severity })

      return {
        hasInteractions,
        interactions: analysis,
        severity
      }

    } catch (error) {
      console.error('❌ Error checking optimized drug interactions:', error)
      throw error
    }
  }

  // Simplified interaction response parsing
  parseAIInteractionResponseOptimized(analysis) {
    const text = analysis.toLowerCase()
    
    // Look for critical keywords
    const criticalKeywords = ['critical', 'severe', 'dangerous', 'contraindicated', 'avoid']
    const warningKeywords = ['warning', 'caution', 'monitor', 'risk']
    
    const hasInteractions = criticalKeywords.some(keyword => text.includes(keyword)) || 
                           warningKeywords.some(keyword => text.includes(keyword))
    
    let severity = 'none'
    if (criticalKeywords.some(keyword => text.includes(keyword))) {
      severity = 'critical'
    } else if (warningKeywords.some(keyword => text.includes(keyword))) {
      severity = 'warning'
    }
    
    return { hasInteractions, severity }
  }

  // Local database of known dangerous drug interactions (unchanged)
  getKnownDangerousInteractions() {
    return [
      {
        drugs: ['MAOI', 'SSRI', 'SNRI'],
        interaction: 'Serotonin syndrome risk',
        severity: 'critical',
        description: 'Combination can cause life-threatening serotonin syndrome'
      },
      {
        drugs: ['Warfarin', 'Aspirin', 'NSAIDs'],
        interaction: 'Increased bleeding risk',
        severity: 'critical',
        description: 'Combination significantly increases bleeding risk'
      },
      {
        drugs: ['Lithium', 'Diuretics'],
        interaction: 'Lithium toxicity',
        severity: 'critical',
        description: 'Diuretics can increase lithium levels causing toxicity'
      },
      {
        drugs: ['ACE Inhibitors', 'Potassium'],
        interaction: 'Hyperkalemia risk',
        severity: 'moderate',
        description: 'Risk of high potassium levels'
      }
    ]
  }

  // Check for local dangerous interactions (unchanged)
  checkLocalDangerousInteractions(prescriptions) {
    const medicationNames = prescriptions.map(p => p.name.toLowerCase())
    const dangerousInteractions = this.getKnownDangerousInteractions()
    
    for (const interaction of dangerousInteractions) {
      const hasAllDrugs = interaction.drugs.some(drug => 
        medicationNames.some(med => med.includes(drug.toLowerCase()))
      )
      
      if (hasAllDrugs) {
        return {
          hasInteractions: true,
          interactions: `LOCAL SAFETY CHECK: ${interaction.interaction} - ${interaction.description}`,
          severity: interaction.severity
        }
      }
    }
    
    return null
  }

  // Combined optimized analysis - single request instead of multiple
  async generateCombinedAnalysisOptimized(symptoms, currentMedications = [], patientAge = null, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('🤖 Generating combined optimized analysis...')

      const symptomsText = this.formatSymptomsOptimized(symptoms)
      const currentMedsText = currentMedications.length > 0 
        ? `Current: ${this.formatMedicationsOptimized(currentMedications)}`
        : 'No current medications'

      // Single comprehensive but minimal prompt
      const prompt = `Patient: ${symptomsText}${patientAge ? `, Age: ${patientAge}` : ''}
${currentMedsText}

Provide brief analysis:
1. Possible conditions
2. Key medications to consider
3. Critical interactions/warnings

Be concise. Medical info only.`

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
              content: 'Medical assistant for qualified medical doctors. The reader is a qualified medical doctor. Provide concise analysis in numbered format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,  // Single request instead of multiple
          temperature: 0.1
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const analysis = data.choices[0]?.message?.content || 'No analysis available.'

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateCombinedAnalysisOptimized',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-3.5-turbo',
          doctorId
        )
      }

      console.log('✅ Combined optimized analysis generated')
      return {
        recommendations: analysis,
        medicationSuggestions: analysis,
        combined: true
      }

    } catch (error) {
      console.error('❌ Error generating combined optimized analysis:', error)
      throw error
    }
  }
}

// Create singleton instance
const optimizedOpenaiService = new OptimizedOpenAIService()
export default optimizedOpenaiService
