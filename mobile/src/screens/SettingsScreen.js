// Settings Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      ]
    );
  };

  const SettingItem = ({ icon, iconColor, title, subtitle, onPress, rightElement }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Icon name="chevron-forward" size={20} color="#9CA3AF" />)}
    </TouchableOpacity>
  );

  const SettingToggle = ({ icon, iconColor, title, subtitle, value, onValueChange }) => (
    <View style={styles.settingItem}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: '#818CF8' }}
        thumbColor={value ? '#4F46E5' : '#F3F4F6'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile Section */}
      <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Profile')}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
        </View>
        <Icon name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="person-outline"
            iconColor="#4F46E5"
            title="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingItem
            icon="storefront-outline"
            iconColor="#059669"
            title="Connected Shops"
            subtitle="Manage marketplace connections"
            onPress={() => navigation.navigate('ConnectedShops')}
          />
          <SettingItem
            icon="card-outline"
            iconColor="#D97706"
            title="Subscription"
            subtitle={user?.subscription_tier || 'Free Plan'}
            onPress={() => navigation.navigate('Subscription')}
          />
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionContent}>
          <SettingToggle
            icon="notifications-outline"
            iconColor="#EF4444"
            title="Push Notifications"
            subtitle="Sales alerts, reminders"
            value={notifications}
            onValueChange={setNotifications}
          />
          <SettingToggle
            icon="moon-outline"
            iconColor="#6366F1"
            title="Dark Mode"
            value={darkMode}
            onValueChange={setDarkMode}
          />
          <SettingToggle
            icon="sync-outline"
            iconColor="#10B981"
            title="Auto Sync"
            subtitle="Sync data automatically"
            value={autoSync}
            onValueChange={setAutoSync}
          />
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="lock-closed-outline"
            iconColor="#7C3AED"
            title="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SettingToggle
            icon="finger-print-outline"
            iconColor="#EC4899"
            title="Biometric Login"
            subtitle="Face ID / Touch ID"
            value={biometric}
            onValueChange={setBiometric}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            iconColor="#059669"
            title="Two-Factor Auth"
            subtitle="Enhanced security"
            onPress={() => navigation.navigate('TwoFactorAuth')}
          />
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="help-circle-outline"
            iconColor="#3B82F6"
            title="Help Center"
            onPress={() => navigation.navigate('HelpCenter')}
          />
          <SettingItem
            icon="chatbubble-outline"
            iconColor="#8B5CF6"
            title="Contact Support"
            onPress={() => navigation.navigate('ContactSupport')}
          />
          <SettingItem
            icon="document-text-outline"
            iconColor="#6B7280"
            title="Terms & Privacy"
            onPress={() => navigation.navigate('Legal')}
          />
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="information-circle-outline"
            iconColor="#6B7280"
            title="App Version"
            rightElement={<Text style={styles.versionText}>1.0.0</Text>}
          />
          <SettingItem
            icon="star-outline"
            iconColor="#F59E0B"
            title="Rate the App"
            onPress={() => {/* Open app store */}}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="log-out-outline" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>VaultLister v1.0.0</Text>
        <Text style={styles.footerText}>Made with care for resellers</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 16,
    borderRadius: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 20,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
