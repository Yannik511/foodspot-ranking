import { supabase } from './supabase'

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif'
]

export const MAX_SPOT_PHOTOS = 8
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const BUCKET_NAME = 'list-covers'

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const loadImageDimensions = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    resolve({ width: img.naturalWidth, height: img.naturalHeight })
    URL.revokeObjectURL(url)
  }
  img.onerror = (err) => {
    URL.revokeObjectURL(url)
    reject(err)
  }
  img.src = url
})

const canvasCompress = (file, { maxSize = 1920, quality = 0.82 } = {}) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (event) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width)
        width = maxSize
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height)
        height = maxSize
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Bildkomprimierung fehlgeschlagen'))
            return
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          resolve(compressedFile)
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = reject
    img.src = event.target.result
  }
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const convertHeicToJpeg = async (file) => {
  const heic2any = (await import('heic2any')).default
  const blob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9
  })
  return new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, '.jpg'),
    { type: 'image/jpeg', lastModified: Date.now() }
  )
}

export const normalizeImageFile = async (file) => {
  let workingFile = file

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Nur JPG, PNG oder HEIC-Dateien sind erlaubt.')
  }

  if (file.type === 'image/heic' || file.type === 'image/heif') {
    workingFile = await convertHeicToJpeg(file)
  }

  if (workingFile.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('Datei ist größer als 10MB.')
  }

  const compressedFile = await canvasCompress(workingFile)
  const dimensions = await loadImageDimensions(compressedFile)

  return {
    file: compressedFile,
    width: dimensions.width,
    height: dimensions.height,
    sizeBytes: compressedFile.size,
    mimeType: compressedFile.type
  }
}

export const uploadSharedSpotPhoto = async ({
  supabaseClient = supabase,
  listId,
  spotId,
  file,
  setAsCover = false,
  onProgress = () => {}
}) => {
  if (!listId || !spotId) {
    throw new Error('listId und spotId sind erforderlich.')
  }

  const { file: processedFile, width, height, sizeBytes, mimeType } = await normalizeImageFile(file)

  const extension = mimeType === 'image/png' ? 'png' : 'jpg'
  const storagePath = `shared-lists/${listId}/spots/${spotId}/${generateUUID()}.${extension}`

  const { error: uploadError } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(storagePath, processedFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
      onUploadProgress: ({ loaded, total }) => {
        if (typeof loaded === 'number' && typeof total === 'number' && total > 0) {
          onProgress(Math.min(100, Math.round((loaded / total) * 100)))
        }
      }
    })

  if (uploadError) {
    throw uploadError
  }

  const { data: urlData, error: urlError } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  if (urlError || !urlData?.publicUrl) {
    throw urlError || new Error('Konnte öffentliche URL nicht abrufen.')
  }

  const { data: photo, error: rpcError } = await supabaseClient.rpc('add_spot_photo', {
    p_list_id: listId,
    p_spot_id: spotId,
    p_storage_path: storagePath,
    p_public_url: urlData.publicUrl,
    p_width: width,
    p_height: height,
    p_size_bytes: sizeBytes,
    p_mime_type: mimeType,
    p_set_as_cover: setAsCover
  })

  if (rpcError) {
    // Rollback Storage, falls RPC fehlschlägt
    await supabaseClient.storage.from(BUCKET_NAME).remove([storagePath])
    throw rpcError
  }

  return photo
}

export const deleteSharedSpotPhoto = async ({
  supabaseClient = supabase,
  photoId
}) => {
  const { data, error } = await supabaseClient.rpc('delete_spot_photo', {
    p_photo_id: photoId
  })

  if (error) {
    throw error
  }

  const result = Array.isArray(data) ? data[0] : data

  if (result?.storage_path) {
    await supabaseClient.storage.from(BUCKET_NAME).remove([result.storage_path]).catch(() => {})
  }

  return result
}

export const setSharedSpotCoverPhoto = async ({
  supabaseClient = supabase,
  photoId
}) => {
  const { data, error } = await supabaseClient.rpc('set_spot_cover_photo', {
    p_photo_id: photoId
  })

  if (error) {
    throw error
  }

  return data
}


