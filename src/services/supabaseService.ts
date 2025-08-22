import { supabase } from '../lib/supabase'
import type { Physician, Patient, MedicalNote } from '../types'

export class SupabaseService {
  static async getPhysicians(): Promise<Physician[]> {
    try {
    const { data, error } = await supabase
      .from('physicians')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading physicians:', error)
      throw new Error(`Failed to load physicians: ${error.message}`)
    }
    
    return data || []
    } catch (err) {
      console.error('Network error loading physicians:', err)
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to Supabase. Please check your internet connection and Supabase URL.')
      }
      throw err
    }
  }

  static async getPatients(): Promise<Patient[]> {
    try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading patients:', error)
      throw new Error(`Failed to load patients: ${error.message}`)
    }
    
    return data || []
    } catch (err) {
      console.error('Network error loading patients:', err)
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to Supabase. Please check your internet connection and Supabase URL.')
      }
      throw err
    }
  }

  static async getPatientNotes(patientId: string): Promise<MedicalNote[]> {
    try {
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
    } catch (err) {
      console.error('Network error loading patient notes:', err)
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to Supabase. Please check your internet connection and Supabase URL.')
      }
      throw err
    }
  }

  static async saveNote(
    patientId: string,
    physicianId: string,
    originalNote: string,
    refinedNote: string
  ): Promise<void> {
    try {
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
    } catch (err) {
      console.error('Network error saving note:', err)
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to Supabase. Please check your internet connection and Supabase URL.')
      }
      throw err
    }
  }
}