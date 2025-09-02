import { supabase } from './supabase'

export const uploadFile = async (
  file: File,
  bucket: string,
  userId: string,
  folder?: string
): Promise<string> => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = folder ? `${userId}/${folder}/${fileName}` : `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw error
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path)

  return publicUrl
}

export const deleteFile = async (bucket: string, path: string): Promise<void> => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (error) {
    throw error
  }
}