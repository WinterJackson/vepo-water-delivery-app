import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Toast } from '@/lib/toast';

const cloudName = 'dn5f0jksu';
const uploadPreset = 'drop_uploads';

export const useImageUpload = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async () => {
    // Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Toast.error('Permission denied', 'We need permission to access your photos');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  }, []);

  const uploadToCloudinary = useCallback(async (uri: string): Promise<string | null> => {
    setUploading(true);
    setError(null);

    try {
      let processedUri = uri;
      let processedName = `drop_${Date.now()}.webp`;

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

      const formData = new FormData();
      const file = {
        uri: processedUri,
        type: 'image/webp',
        name: processedName,
      };

      formData.append('file', file as any);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: unknown) {
      if (__DEV__) console.error('Cloudinary upload error:', err);
      setError('Failed to upload image');
      Toast.error('Upload Error', 'Could not upload image to Cloudinary');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const handleImageUpload = useCallback(async () => {
    if (!imageUri) {
      Toast.info('Error', 'Please select an image first');
      return null;
    }

    return await uploadToCloudinary(imageUri);
  }, [imageUri, uploadToCloudinary]);

  return {
    imageUri,
    setImageUri,
    uploading,
    error,
    pickImage,
    uploadToCloudinary,
    handleImageUpload,
  };
};