import { FileText } from 'lucide-react'

interface NoteInputProps {
  note: string
  onChange: (note: string) => void
}

export default function NoteInput({ note, onChange }: NoteInputProps) {
  return (
    <div className="mb-6">
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
        <FileText className="h-4 w-4" />
        <span>Clinical Note</span>
      </label>
      <textarea
        value={note}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your clinical observations, diagnosis, treatment plan, etc..."
        className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
      />
    </div>
  )
}