// Push Notification Service for VaultLister Mobile
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { api } from './api';

// Configure local notifications
PushNotification.configure({
  onRegister: function (token) {
    console.log('Notification token:', token);
  },

  onNotification: function (notification) {
    console.log('Notification received:', notification);

    // Handle notification tap
    if (notification.userInteraction) {
      handleNotificationTap(notification.data);
    }
  },

  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },

  popInitialNotification: true,
  requestPermissions: Platform.OS === 'ios',
});

// Create notification channels for Android
PushNotification.createChannel(
  {
    channelId: 'sales',
    channelName: 'Sales Notifications',
    channelDescription: 'Notifications for new sales and offers',
    importance: 4,
    vibrate: true,
  },
  (created) => console.log(`Channel 'sales' created: ${created}`)
);

PushNotification.createChannel(
  {
    channelId: 'inventory',
    channelName: 'Inventory Alerts',
    channelDescription: 'Low stock and inventory alerts',
    importance: 3,
    vibrate: true,
  },
  (created) => console.log(`Channel 'inventory' created: ${created}`)
);

PushNotification.createChannel(
  {
    channelId: 'general',
    channelName: 'General',
    channelDescription: 'General notifications',
    importance: 3,
    vibrate: true,
  },
  (created) => console.log(`Channel 'general' created: ${created}`)
);

// Handle notification tap
function handleNotificationTap(data) {
  if (!data) return;

  // Navigate based on notification type
  switch (data.type) {
    case 'sale':
      // Navigate to sale detail
      // navigation.navigate('SaleDetail', { saleId: data.saleId });
      break;
    case 'offer':
      // Navigate to offer
      // navigation.navigate('Offers', { offerId: data.offerId });
      break;
    case 'inventory':
      // Navigate to inventory item
      // navigation.navigate('ItemDetail', { itemId: data.itemId });
      break;
    default:
      // Navigate to notifications
      break;
  }
}

// Request permission and register for push notifications
export async function registerForPushNotifications() {
  try {
    // Request permission (iOS)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('Push notification permission denied');
      return null;
    }

    // Get FCM token
    const fcmToken = await messaging().getToken();
    console.log('FCM Token:', fcmToken);

    // Register token with backend
    await registerDeviceToken(fcmToken);

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken);
      await registerDeviceToken(newToken);
    });

    return fcmToken;
  } catch (error) {
    console.error('Push notification registration error:', error);
    return null;
  }
}

// Register device token with backend
async function registerDeviceToken(token) {
  try {
    await api.post('/api/notifications/register-device', {
      token,
      platform: Platform.OS,
      deviceId: await getDeviceId(),
    });
  } catch (error) {
    console.error('Device token registration error:', error);
  }
}

// Get device ID
async function getDeviceId() {
  // In production, use a proper device ID library
  return Platform.OS === 'ios' ? 'ios-device' : 'android-device';
}

// Unregister device
export async function unregisterDevice() {
  try {
    const token = await messaging().getToken();
    await api.post('/api/notifications/unregister-device', { token });
  } catch (error) {
    console.error('Device unregistration error:', error);
  }
}

// Show local notification
export function showLocalNotification(title, message, data = {}, channelId = 'general') {
  PushNotification.localNotification({
    channelId,
    title,
    message,
    playSound: true,
    soundName: 'default',
    data,
  });
}

// Schedule local notification
export function scheduleNotification(title, message, date, data = {}, channelId = 'general') {
  PushNotification.localNotificationSchedule({
    channelId,
    title,
    message,
    date,
    playSound: true,
    soundName: 'default',
    data,
  });
}

// Cancel all notifications
export function cancelAllNotifications() {
  PushNotification.cancelAllLocalNotifications();
}

// Get badge count
export function getBadgeCount(callback) {
  PushNotification.getApplicationIconBadgeNumber(callback);
}

// Set badge count
export function setBadgeCount(count) {
  PushNotification.setApplicationIconBadgeNumber(count);
}

// Handle background messages
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message:', remoteMessage);

  // Show local notification for background messages
  if (remoteMessage.notification) {
    showLocalNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body,
      remoteMessage.data,
      remoteMessage.data?.channelId || 'general'
    );
  }
});

export default {
  registerForPushNotifications,
  unregisterDevice,
  showLocalNotification,
  scheduleNotification,
  cancelAllNotifications,
  getBadgeCount,
  setBadgeCount,
};
