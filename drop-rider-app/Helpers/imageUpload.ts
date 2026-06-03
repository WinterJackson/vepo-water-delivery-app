import * as ImageManipulator from 'expo-image-manipulator';
import { Toast } from '@/lib/toast';

const CloudinaryUpload = async (uri: string, name: string | null | undefined) => {
  const cloudName = 'dn5f0jksu';
  const uploadPreset = 'drop_uploads';

  const formData = new FormData();

  const fileName = name ? name.split('.')[0] + '.webp' : 'delivery_proof.webp';

  // Compress and convert to WebP before uploading (performance + bandwidth optimization)
  let processedUri = uri;
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP }
    );
    processedUri = manipResult.uri;
  } catch (e) {
    console.warn("Failed to compress to WebP, falling back to original", e);
  }

  const file = {
    uri: processedUri,
    type: 'image/webp',
    name: fileName,
  };

  formData.append('file', file as any);
  formData.append('upload_preset', uploadPreset);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    if (__DEV__) console.error('Cloudinary upload error:', err);
    Toast.error('Upload Error', 'Failed to upload proof photo. Please try again.');
    throw err;
  }
};

export default CloudinaryUpload;
