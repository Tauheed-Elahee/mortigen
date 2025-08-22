import { useState, useEffect } from 'react'
import { SupabaseService } from '../services/supabaseService'
import type { Physician, Patient, MedicalNote } from '../types'

export function useSupabaseData() {
  const [physicians, setPhysicians] = useState<Physician[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const [physiciansData, patientsData] = await Promise.all([
        SupabaseService.getPhysicians(),
        SupabaseService.getPatients()
      ])
      
      setPhysicians(physiciansData)
      setPatients(patientsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
      console.error('Error loading initial data:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    physicians,
    patients,
    loading,
    error,
    refetch: loadInitialData
  }
}

export function usePatientNotes(patientId: string) {
  const [notes, setNotes] = useState<MedicalNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (patientId) {
      loadPatientNotes(patientId)
    } else {
      setNotes([])
    }
  }, [patientId])

  const loadPatientNotes = async (id: string) => {
    try {
      setLoading(true)
      setError('')
      const notesData = await SupabaseService.getPatientNotes(id)
      setNotes(notesData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes'
      setError(errorMessage)
      console.error('Error loading patient notes:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    notes,
    loading,
    error,
    refetch: () => patientId && loadPatientNotes(patientId)
  }
}