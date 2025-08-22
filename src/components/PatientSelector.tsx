import { User } from 'lucide-react'
import type { Patient } from '../types'

interface PatientSelectorProps {
  patients: Patient[]
  selectedPatient: string
  onSelect: (patientId: string) => void
}

export default function PatientSelector({ patients, selectedPatient, onSelect }: PatientSelectorProps) {
  return (
    <div>
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
        <User className="h-4 w-4" />
        <span>Select Patient</span>
      </label>
      <select
        value={selectedPatient}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Choose a patient...</option>
        {patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name}
            {patient.date_of_birth && ` (DOB: ${new Date(patient.date_of_birth).toLocaleDateString()})`}
          </option>
        ))}
      </select>
    </div>
  )
}