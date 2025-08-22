import React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

interface RefinedNoteProps {
  refinedNote: string
  isLoading: boolean
}

export default function RefinedNote({ refinedNote, isLoading }: RefinedNoteProps) {
  if (!refinedNote && !isLoading) {
    return null
  }

  return (
    <div className="mb-6">
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
        <Sparkles className="h-4 w-4" />
        <span>AI-Refined Note</span>
      </label>
      <div className="min-h-32 p-3 border border-gray-300 rounded-md bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is refining your note...</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-gray-800">{refinedNote}</div>
        )}
      </div>
    </div>
  )
}