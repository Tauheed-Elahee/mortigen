import React from 'react'
import { CheckCircle } from 'lucide-react'

interface SuccessMessageProps {
  message: string
  onDismiss?: () => void
}

export default function SuccessMessage({ message, onDismiss }: SuccessMessageProps) {
  return (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-green-700 text-sm">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-green-600 hover:text-green-800 ml-2"
          aria-label="Dismiss message"
        >
          ×
        </button>
      )}
    </div>
  )
}