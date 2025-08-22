import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import PhysicianSelector from './components/PhysicianSelector'
import PatientSelector from './components/PatientSelector'
import NoteInput from './components/NoteInput'
import RefinedNote from './components/RefinedNote'
import PatientNotes from './components/PatientNotes'
import { Stethoscope, Save, AlertCircle } from 'lucide-react'

interface Physician {
  id: string
  name: string
  specialty: string | null
}

interface Patient {
  id: string
  name: string
  date_of_birth: string | null
}

interface MedicalNote {
  id: string
  original_note: string
  refined_note: string
  created_at: string
  physicians: {
    name: string
    specialty: string | null
  } | null
}

export default function App() {
  const [physicians, setPhysicians] = useState<Physician[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPhysician, setSelectedPhysician] = useState('')
  const [selectedPatient, setSelectedPatient] = useState('')
  const [note, setNote] = useState('')
  const [refinedNote, setRefinedNote] = useState('')
  const [patientNotes, setPatientNotes] = useState<MedicalNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadPhysicians()
    loadPatients()
  }, [])

  useEffect(() => {
    if (selectedPatient) {
      loadPatientNotes(selectedPatient)
    } else {
      setPatientNotes([])
    }
  }, [selectedPatient])

  const loadPhysicians = async () => {
    console.log('Loading physicians...')
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
    console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
    
    const { data, error } = await supabase
      .from('physicians')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading physicians:', error)
      setError(`Failed to load physicians: ${error.message}`)
    } else {
      console.log('Physicians loaded:', data)
      setPhysicians(data || [])
    }
  }

  const loadPatients = async () => {
    console.log('Loading patients...')
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error loading patients:', error)
      setError(`Failed to load patients: ${error.message}`)
    } else {
      console.log('Patients loaded:', data)
      setPatients(data || [])
    }
  }

  const loadPatientNotes = async (patientId: string) => {
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
    } else {
      setPatientNotes(data || [])
    }
  }

  const refineNote = async () => {
    if (!note.trim()) {
      setError('Please enter a clinical note')
      return
    }

    setIsLoading(true)
    setError('')
    setRefinedNote('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-note`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      })

      if (!response.ok) {
        throw new Error('Failed to refine note')
      }

      const { refinedNote: refined } = await response.json()
      setRefinedNote(refined)
    } catch (error) {
      console.error('Error refining note:', error)
      setError('Failed to refine note. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const saveNote = async () => {
    if (!selectedPhysician || !selectedPatient || !note.trim() || !refinedNote.trim()) {
      setError('Please complete all fields and refine the note before saving')
      return
    }

    try {
      const { error } = await supabase
        .from('medical_notes')
        .insert({
          patient_id: selectedPatient,
          physician_id: selectedPhysician,
          original_note: note,
          refined_note: refinedNote,
        })

      if (error) throw error

      setSuccess('Note saved successfully!')
      setNote('')
      setRefinedNote('')
      loadPatientNotes(selectedPatient)
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error saving note:', error)
      setError('Failed to save note. Please try again.')
    }
  }

  const selectedPatientName = patients.find(p => p.id === selectedPatient)?.name || ''

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-8">
            <Stethoscope className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Medical Note Management System</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <span className="text-green-700 text-sm">{success}</span>
            </div>
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
              disabled={!note.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Processing...' : 'Refine with AI'}
            </button>

            <button
              onClick={saveNote}
              disabled={!refinedNote || !selectedPhysician || !selectedPatient}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <Save className="h-4 w-4" />
              <span>Save Note</span>
            </button>
          </div>

          <RefinedNote refinedNote={refinedNote} isLoading={isLoading} />

          <PatientNotes notes={patientNotes} patientName={selectedPatientName} />
        </div>
      </div>
    </div>
  )
}