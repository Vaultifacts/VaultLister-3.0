// Dashboard Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { analyticsApi } from '../services/api';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await analyticsApi.getOverview();
      setData(response.data);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const stats = data || {
    revenue: 0,
    sales: 0,
    activeListings: 0,
    pendingOrders: 0,
    inventory: 0,
    views: 0,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="settings-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('Scan')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
            <Icon name="barcode" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.quickActionText}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('Camera')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="camera" size={24} color="#059669" />
          </View>
          <Text style={styles.quickActionText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="add" size={24} color="#D97706" />
          </View>
          <Text style={styles.quickActionText}>List</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
            <Icon name="sync" size={24} color="#DB2777" />
          </View>
          <Text style={styles.quickActionText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardLarge]}>
          <View style={styles.statHeader}>
            <Icon name="cash-outline" size={20} color="#059669" />
            <Text style={styles.statLabel}>Revenue (30d)</Text>
          </View>
          <Text style={styles.statValue}>${stats.revenue?.toLocaleString() || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Icon name="cart-outline" size={20} color="#4F46E5" />
            <Text style={styles.statLabel}>Sales</Text>
          </View>
          <Text style={styles.statValue}>{stats.sales || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Icon name="pricetag-outline" size={20} color="#D97706" />
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <Text style={styles.statValue}>{stats.activeListings || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Icon name="time-outline" size={20} color="#DC2626" />
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <Text style={styles.statValue}>{stats.pendingOrders || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Icon name="cube-outline" size={20} color="#7C3AED" />
            <Text style={styles.statLabel}>Inventory</Text>
          </View>
          <Text style={styles.statValue}>{stats.inventory || 0}</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          <ActivityItem
            icon="cart"
            iconColor="#059669"
            iconBg="#D1FAE5"
            title="New Sale"
            subtitle="Vintage Levi's 501 Jeans"
            time="2h ago"
            amount="+$42.00"
          />
          <ActivityItem
            icon="eye"
            iconColor="#4F46E5"
            iconBg="#EEF2FF"
            title="Listing Views"
            subtitle="Nike Air Max 90 - 23 new views"
            time="4h ago"
          />
          <ActivityItem
            icon="heart"
            iconColor="#DB2777"
            iconBg="#FCE7F3"
            title="New Like"
            subtitle="Coach Crossbody Bag"
            time="5h ago"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function ActivityItem({ icon, iconColor, iconBg, title, subtitle, time, amount }) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.activityMeta}>
        {amount && <Text style={styles.activityAmount}>{amount}</Text>}
        <Text style={styles.activityTime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  settingsButton: {
    padding: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '47%',
  },
  statCardLarge: {
    width: '100%',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  seeAll: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  activitySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
