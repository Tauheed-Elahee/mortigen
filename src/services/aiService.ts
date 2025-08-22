export class AIService {
  static async refineNote(note: string): Promise<string> {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration is missing')
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-note`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    })

    if (!response.ok) {
      throw new Error(`Failed to refine note: ${response.statusText}`)
    }

    const { refinedNote } = await response.json()
    return refinedNote
  }
}