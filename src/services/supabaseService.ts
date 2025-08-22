import { supabase } from '../lib/supabase'
import type { Physician, Patient, MedicalNote } from '../types'

export class SupabaseService {
  static async getPhysicians(): Promise<Physician[]> {
    const { data, error } = await supabase
      .from('physicians')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading physicians:', error)
      throw new Error(`Failed to load physicians: ${error.message}`)
    }
    
    return data || []
  }

  static async getPatients(): Promise<Patient[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading patients:', error)
      throw new Error(`Failed to load patients: ${error.message}`)
    }
    
    return data || []
  }

  static async getPatientNotes(patientId: string): Promise<MedicalNote[]> {
    const { data, error } = await supabase
      .from('medical_notes')
      .select(`
        *,
        physicians (
          name,
          specialty
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading patient notes:', error)
      throw new Error(`Failed to load patient notes: ${error.message}`)
    }
    
    return data || []
  }

  static async saveNote(
    patientId: string,
    physicianId: string,
    originalNote: string,
    refinedNote: string
  ): Promise<void> {
    const { error } = await supabase
      .from('medical_notes')
      .insert({
        patient_id: patientId,
        physician_id: physicianId,
        original_note: originalNote,
        refined_note: refinedNote,
      })

    if (error) {
      console.error('Error saving note:', error)
      throw new Error(`Failed to save note: ${error.message}`)
    }
  }
}