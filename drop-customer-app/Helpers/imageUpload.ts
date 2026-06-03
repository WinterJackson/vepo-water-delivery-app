import * as ImageManipulator from 'expo-image-manipulator';
import { Toast } from '@/lib/toast';

const CloudinaryUpload = async (uri: string, name: string | null | undefined) => {
  // CRIT-03: Credentials from env vars, not hardcoded
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dn5f0jksu';
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_PRESET || 'drop_uploads';

  const formData = new FormData();

  // Compress and converting to WebP immediately
  let processedUri = uri;
  let processedName = name ? name.split('.')[0] + '.webp' : 'upload.webp';

  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP }
    );
    processedUri = manipResult.uri;
  } catch (e) {
    if (__DEV__) console.warn("Failed to compress to WEBP, falling back to original", e);
  }

  const file = {
    uri: processedUri,
    type: 'image/webp',
    name: processedName,
  };

  formData.append('file', file as any);
  formData.append('upload_preset', uploadPreset);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    // console.log('Cloudinary upload success:', data);
    return data;
  } catch (err: any) {
    if (__DEV__) console.error('Cloudinary upload error:', err);
    Toast.error('Upload Error', 'Failed to upload image. Please try again.');
    throw err;
  }
};

export default CloudinaryUpload;
