'use client'

import { useState } from 'react'

interface DeleteConfirmModalProps {
  groupName: string
  message?: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function DeleteConfirmModal({ groupName, message, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm sm:mx-4">
        <div className="p-5 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-queue-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {message || `Remove ${groupName} from queue?`}
          </h3>
          <p className="text-sm text-gray-500">
            This cannot be undone.
          </p>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] text-base disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 py-3 bg-queue-red hover:bg-red-700 text-white font-bold rounded-xl transition-colors min-h-[48px] text-base disabled:opacity-50"
          >
            {deleting ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}
