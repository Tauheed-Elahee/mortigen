export function validateNoteForm(
  selectedPhysician: string,
  selectedPatient: string,
  note: string,
  refinedNote: string
): string | null {
  if (!selectedPhysician) {
    return 'Please select a physician'
  }
  
  if (!selectedPatient) {
    return 'Please select a patient'
  }
  
  if (!note.trim()) {
    return 'Please enter a clinical note'
  }
  
  if (!refinedNote.trim()) {
    return 'Please refine the note before saving'
  }
  
  return null
}

export function validateEnvironment(): string | null {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return 'Please configure Supabase environment variables'
  }
  
  return null
}