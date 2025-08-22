export interface Physician {
  id: string
  name: string
  specialty: string | null
}

export interface Patient {
  id: string
  name: string
  date_of_birth: string | null
  phone?: string | null
  email?: string | null
}

export interface MedicalNote {
  id: string
  patient_id: string
  physician_id: string
  original_note: string
  refined_note: string
  created_at: string
  updated_at?: string
  physicians?: {
    name: string
    specialty: string | null
  } | null
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}