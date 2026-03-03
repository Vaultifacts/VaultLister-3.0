# VaultLister Mobile App

Cross-platform mobile application for VaultLister using React Native.

## Features

- **Barcode Scanning**: Scan product barcodes to quickly add inventory
- **Camera Integration**: Take photos for listings directly from the app
- **Real-Time Sync**: Live updates via WebSocket
- **Offline Support**: Work offline and sync when connected
- **Push Notifications**: Get notified of sales, offers, and low stock

## Project Structure

```
mobile/
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/             # App screens
│   ├── navigation/          # Navigation configuration
│   ├── services/            # API and WebSocket services
│   ├── hooks/               # Custom React hooks
│   ├── store/               # State management
│   ├── utils/               # Utility functions
│   └── assets/              # Images, fonts, etc.
├── ios/                     # iOS native code
├── android/                 # Android native code
├── app.json                 # Expo/RN config
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- React Native CLI or Expo CLI
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

```bash
cd mobile
npm install

# iOS
cd ios && pod install && cd ..

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Configuration

Create a `.env` file:

```env
API_URL=https://api.vaultlister.com
WS_URL=wss://api.vaultlister.com/ws
```

## Key Integrations

### Barcode Scanner

Using `react-native-camera` with barcode scanning:

```javascript
import { RNCamera } from 'react-native-camera';

<RNCamera
  onBarCodeRead={({ data, type }) => {
    // Look up product by barcode
    lookupProduct(data);
  }}
  barCodeTypes={[RNCamera.Constants.BarCodeType.ean13, RNCamera.Constants.BarCodeType.upc_a]}
/>
```

### Camera for Listings

```javascript
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const takePhoto = async () => {
  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1200,
    maxHeight: 1200,
  });
  // Upload to API
};
```

### Push Notifications

Using Firebase Cloud Messaging (FCM):

```javascript
import messaging from '@react-native-firebase/messaging';

// Request permission
await messaging().requestPermission();

// Get FCM token
const token = await messaging().getToken();

// Handle incoming messages
messaging().onMessage(async remoteMessage => {
  // Display notification
});
```

## App Store Deployment

### iOS (App Store Connect)

1. Update `ios/VaultLister/Info.plist` with required permissions
2. Create app in App Store Connect
3. Build: `npx react-native run-ios --configuration Release`
4. Upload via Xcode or Transporter

### Android (Google Play)

1. Update `android/app/build.gradle` for release
2. Generate signed APK/AAB
3. Upload to Google Play Console

## License

Proprietary - VaultLister
