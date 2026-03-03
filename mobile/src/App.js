// VaultLister Mobile App
import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import messaging from '@react-native-firebase/messaging';

// Screens
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import InventoryScreen from './screens/InventoryScreen';
import ListingsScreen from './screens/ListingsScreen';
import SalesScreen from './screens/SalesScreen';
import ScannerScreen from './screens/ScannerScreen';
import CameraScreen from './screens/CameraScreen';
import SettingsScreen from './screens/SettingsScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';

// Services
import { useAuthStore } from './store/authStore';
import { initWebSocket } from './services/websocket';
import { registerForPushNotifications } from './services/notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator for authenticated users
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Inventory':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'Scan':
              iconName = focused ? 'barcode' : 'barcode-outline';
              break;
            case 'Listings':
              iconName = focused ? 'pricetag' : 'pricetag-outline';
              break;
            case 'Sales':
              iconName = focused ? 'cash' : 'cash-outline';
              break;
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen
        name="Scan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Icon name="scan" size={size + 8} color={color} />
          ),
        }}
      />
      <Tab.Screen name="Listings" component={ListingsScreen} />
      <Tab.Screen name="Sales" component={SalesScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, token, checkAuth } = useAuthStore();

  useEffect(() => {
    // Check authentication status on app start
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Initialize WebSocket connection
      initWebSocket(token);

      // Register for push notifications
      registerForPushNotifications();

      // Handle foreground messages
      const unsubscribe = messaging().onMessage(async remoteMessage => {
        console.log('FCM Message:', remoteMessage);
        // Show local notification
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isAuthenticated, token]);

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
      />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ItemDetail"
              component={ItemDetailScreen}
              options={{ headerShown: true, title: 'Item Details' }}
            />
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ headerShown: true, title: 'Take Photo' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
