import * as ImageManipulator from 'expo-image-manipulator';
import { Toast } from '@/lib/toast';

const SecureUpload = async (uri: string, name: string | null | undefined, getToken: () => Promise<string | null>) => {
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

  try {
    const token = await getToken();
    const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/deliverer/upload_proof`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData,
    });

    if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    if (__DEV__) console.error('Secure upload error:', err);
    Toast.error('Upload Error', 'Failed to upload proof photo. Please try again.');
    throw err;
  }
};

export default SecureUpload;
