// Barcode Scanner Screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevices, useCodeScanner } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

export default function ScannerScreen() {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [flashOn, setFlashOn] = useState(false);

  const devices = useCameraDevices();
  const device = devices.back;

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    setHasPermission(permission === 'granted');
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'qr'],
    onCodeScanned: (codes) => {
      if (!isScanning || codes.length === 0) return;

      const code = codes[0];

      // Prevent duplicate scans
      if (code.value === lastScanned) return;

      setLastScanned(code.value);
      setIsScanning(false);
      Vibration.vibrate(100);

      handleBarcode(code.value, code.type);
    },
  });

  const handleBarcode = useCallback(async (barcode, type) => {
    setIsLoading(true);

    try {
      // Look up product by barcode
      const response = await api.get(`/api/barcode/lookup/${barcode}`);

      if (response.data.found) {
        // Product found - show details
        Alert.alert(
          'Product Found',
          `${response.data.product.name}\n\nAdd to inventory?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resetScanner(),
            },
            {
              text: 'Add',
              onPress: () => addToInventory(response.data.product),
            },
          ]
        );
      } else {
        // Product not found - manual entry
        Alert.alert(
          'Product Not Found',
          `Barcode: ${barcode}\n\nCreate new item?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resetScanner(),
            },
            {
              text: 'Create',
              onPress: () => createNewItem(barcode),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      Alert.alert(
        'Scan Complete',
        `Barcode: ${barcode}\n\nCreate new item?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resetScanner(),
          },
          {
            text: 'Create',
            onPress: () => createNewItem(barcode),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addToInventory = async (product) => {
    try {
      const response = await api.post('/api/inventory', {
        title: product.name,
        brand: product.brand,
        sku: product.barcode,
        category: product.category,
        purchase_price: product.price || 0,
        quantity: 1,
        status: 'active',
      });

      Alert.alert('Success', 'Item added to inventory');
      navigation.navigate('ItemDetail', { itemId: response.data.id });
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
      resetScanner();
    }
  };

  const createNewItem = (barcode) => {
    navigation.navigate('ItemDetail', {
      newItem: true,
      barcode,
    });
  };

  const resetScanner = () => {
    setLastScanned(null);
    setIsScanning(true);
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Icon name="camera-off" size={64} color="#9CA3AF" />
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        codeScanner={codeScanner}
        torch={flashOn ? 'on' : 'off'}
      />

      {/* Scanning overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <Text style={styles.instructionText}>
          {isScanning ? 'Point camera at barcode' : 'Processing...'}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setFlashOn(!flashOn)}
        >
          <Icon
            name={flashOn ? 'flash' : 'flash-off'}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.navigate('Camera')}
        >
          <Icon name="camera" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Looking up product...</Text>
        </View>
      )}

      {/* Manual entry button */}
      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => navigation.navigate('ItemDetail', { newItem: true })}
      >
        <Icon name="create-outline" size={20} color="#FFFFFF" />
        <Text style={styles.manualButtonText}>Manual Entry</Text>
      </TouchableOpacity>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3B82F6',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionText: {
    marginTop: 24,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 120,
    flexDirection: 'row',
    gap: 24,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  manualButton: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
