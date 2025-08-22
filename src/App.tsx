import React, { useState, useEffect } from 'react'
import { SupabaseService } from './services/supabaseService'
import { AIService } from './services/aiService'
import { useSupabaseData, usePatientNotes } from './hooks/useSupabaseData'
import { validateNoteForm, validateEnvironment } from './utils/validation'
import type { Physician, Patient, MedicalNote } from './types'
import PhysicianSelector from './components/PhysicianSelector'
import PatientSelector from './components/PatientSelector'
import NoteInput from './components/NoteInput'
import RefinedNote from './components/RefinedNote'
import PatientNotes from './components/PatientNotes'
import ErrorMessage from './components/ErrorMessage'
import SuccessMessage from './components/SuccessMessage'
import LoadingSpinner from './components/LoadingSpinner'
import { Stethoscope, Save } from 'lucide-react'

export default function App() {
  const { physicians, patients, loading: dataLoading, error: dataError } = useSupabaseData()
  const [selectedPhysician, setSelectedPhysician] = useState('')
  const [selectedPatient, setSelectedPatient] = useState('')
  const [note, setNote] = useState('')
  const [refinedNote, setRefinedNote] = useState('')
  const { notes: patientNotes, refetch: refetchNotes } = usePatientNotes(selectedPatient)
  const [isRefining, setIsRefining] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const envError = validateEnvironment()
    if (envError) {
      setError(envError)
    }
  }, [])

  const refineNote = async () => {
    setIsRefining(true)
    setError('')
    setRefinedNote('')

    try {
      const refined = await AIService.refineNote(note)
      setRefinedNote(refined)
    } catch (error) {
      console.error('Error refining note:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to refine note. Please try again.'
      setError(errorMessage)
    } finally {
      setIsRefining(false)
    }
  }

  const saveNote = async () => {
    const validationError = validateNoteForm(selectedPhysician, selectedPatient, note, refinedNote)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await SupabaseService.saveNote(selectedPatient, selectedPhysician, note, refinedNote)

      setSuccess('Note saved successfully!')
      setNote('')
      setRefinedNote('')
      refetchNotes()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error saving note:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedPatientName = patients.find(p => p.id === selectedPatient)?.name || ''

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <LoadingSpinner message="Loading application..." size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-8">
            <Stethoscope className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Medical Note Management System</h1>
          </div>

          {(error || dataError) && (
            <ErrorMessage 
              message={error || dataError} 
              onDismiss={() => setError('')} 
            />
          )}

          {success && (
            <SuccessMessage 
              message={success} 
              onDismiss={() => setSuccess('')} 
            />
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <PhysicianSelector
              physicians={physicians}
              selectedPhysician={selectedPhysician}
              onSelect={setSelectedPhysician}
            />
            <PatientSelector
              patients={patients}
              selectedPatient={selectedPatient}
              onSelect={setSelectedPatient}
            />
          </div>

          <NoteInput note={note} onChange={setNote} />

          <div className="flex space-x-4 mb-6">
            <button
              onClick={refineNote}
              disabled={!note.trim() || isRefining}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isRefining ? 'Processing...' : 'Refine with AI'}
            </button>

            <button
              onClick={saveNote}
              disabled={!refinedNote || !selectedPhysician || !selectedPatient || isSaving}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>

          <RefinedNote refinedNote={refinedNote} isLoading={isRefining} />

          <PatientNotes notes={patientNotes} patientName={selectedPatientName} />
        </div>
      </div>
    </div>
  )
}