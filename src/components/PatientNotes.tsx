import React from 'react'
import { Clock, User } from 'lucide-react'
import type { MedicalNote } from '../types'

interface PatientNotesProps {
  notes: MedicalNote[]
  patientName: string
}

export default function PatientNotes({ notes, patientName }: PatientNotesProps) {
  if (!patientName || notes.length === 0) {
    return null
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Previous Notes for {patientName}
      </h2>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {notes.map((note) => (
          <div key={note.id} className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>
                  {note.physicians?.name}
                  {note.physicians?.specialty && ` (${note.physicians.specialty})`}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{new Date(note.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap">
              {note.refined_note}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}