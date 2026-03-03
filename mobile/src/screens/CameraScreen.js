// Camera Screen for Taking Listing Photos
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';

const MAX_PHOTOS = 10;

export default function CameraScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const cameraRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  const [cameraPosition, setCameraPosition] = useState('back');

  const devices = useCameraDevices();
  const device = cameraPosition === 'back' ? devices.back : devices.front;

  const { itemId, onPhotosAdded } = route.params || {};

  useEffect(() => {
    requestPermission();
  }, []);

  const requestPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    setHasPermission(permission === 'granted');
  };

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing || photos.length >= MAX_PHOTOS) return;

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: flashMode,
        qualityPrioritization: 'balanced',
      });

      setPhotos([...photos, {
        uri: `file://${photo.path}`,
        width: photo.width,
        height: photo.height,
      }]);
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const toggleFlash = () => {
    const modes = ['off', 'on', 'auto'];
    const currentIndex = modes.indexOf(flashMode);
    setFlashMode(modes[(currentIndex + 1) % modes.length]);
  };

  const toggleCamera = () => {
    setCameraPosition(cameraPosition === 'back' ? 'front' : 'back');
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please take at least one photo');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo_${index}.jpg`,
        });
      });

      if (itemId) {
        formData.append('itemId', itemId);
      }

      const response = await api.post('/api/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', `${photos.length} photo(s) uploaded`);

      if (onPhotosAdded) {
        onPhotosAdded(response.data.images);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Icon name="camera-off" size={64} color="#9CA3AF" />
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* Photo counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {photos.length}/{MAX_PHOTOS}
        </Text>
      </View>

      {/* Camera controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <Icon
            name={flashMode === 'off' ? 'flash-off' : flashMode === 'on' ? 'flash' : 'flash-outline'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={takePhoto}
          disabled={isCapturing || photos.length >= MAX_PHOTOS}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
          <Icon name="camera-reverse" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Photo strip */}
      {photos.length > 0 && (
        <View style={styles.photoStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.thumbnailContainer}>
                <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePhoto(index)}
                >
                  <Icon name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.doneButton, isUploading && styles.doneButtonDisabled]}
            onPress={uploadPhotos}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.doneButtonText}>Done</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Loading overlay */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Uploading photos...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  counter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 40,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#000000',
  },
  photoStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    marginRight: 12,
    position: 'relative',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 'auto',
    gap: 6,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  permissionText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
