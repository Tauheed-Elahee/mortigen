import React from 'react'
import { AlertCircle } from 'lucide-react'

interface ErrorMessageProps {
  message: string
  onDismiss?: () => void
}

export default function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        <span className="text-red-700 text-sm">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800 ml-2"
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  )
}