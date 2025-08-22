import { UserCheck } from 'lucide-react'
import type { Physician } from '../types'

interface PhysicianSelectorProps {
  physicians: Physician[]
  selectedPhysician: string
  onSelect: (physicianId: string) => void
}

export default function PhysicianSelector({ physicians, selectedPhysician, onSelect }: PhysicianSelectorProps) {
  return (
    <div>
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
        <UserCheck className="h-4 w-4" />
        <span>Select Physician</span>
      </label>
      <select
        value={selectedPhysician}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Choose a physician...</option>
        {physicians.map((physician) => (
          <option key={physician.id} value={physician.id}>
            {physician.name} {physician.specialty && `(${physician.specialty})`}
          </option>
        ))}
      </select>
    </div>
  )
}