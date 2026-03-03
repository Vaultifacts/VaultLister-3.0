// Sales Screen
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { salesApi } from '../services/api';

export default function SalesScreen() {
  const navigation = useNavigation();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    averagePrice: 0,
  });

  useEffect(() => {
    loadSales();
  }, [period]);

  const loadSales = async () => {
    try {
      const response = await salesApi.getAll({ period, limit: 100 });
      const data = response.data.sales || response.data || [];
      setSales(data);

      // Calculate stats
      const totalRevenue = data.reduce((sum, s) => sum + (s.sale_price || 0), 0);
      const totalSales = data.length;
      const averagePrice = totalSales > 0 ? totalRevenue / totalSales : 0;

      setStats({ totalRevenue, totalSales, averagePrice });
    } catch (error) {
      console.error('Sales error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales();
  }, [period]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'ebay': return '#E53238';
      case 'poshmark': return '#7F0353';
      case 'mercari': return '#4DC3C0';
      case 'depop': return '#FF2300';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.saleCard}
      onPress={() => navigation.navigate('SaleDetail', { saleId: item.id })}
    >
      <View style={styles.saleHeader}>
        <View style={[styles.platformBadge, { backgroundColor: getPlatformColor(item.platform) }]}>
          <Text style={styles.platformText}>{item.platform || 'N/A'}</Text>
        </View>
        <Text style={styles.saleDate}>{formatDate(item.sale_date)}</Text>
      </View>

      <Text style={styles.saleTitle} numberOfLines={1}>{item.title || 'Untitled Item'}</Text>

      <View style={styles.saleFooter}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Sale Price</Text>
          <Text style={styles.salePrice}>${(item.sale_price || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.profitSection}>
          <Text style={styles.profitLabel}>Profit</Text>
          <Text style={[
            styles.profitValue,
            { color: (item.profit || 0) >= 0 ? '#059669' : '#DC2626' }
          ]}>
            {(item.profit || 0) >= 0 ? '+' : ''}${(item.profit || 0).toFixed(2)}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => {/* Export functionality */}}
        >
          <Icon name="download-outline" size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="cash-outline" size={24} color="#059669" />
          <Text style={styles.statValue}>${stats.totalRevenue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="cart-outline" size={24} color="#4F46E5" />
          <Text style={styles.statValue}>{stats.totalSales}</Text>
          <Text style={styles.statLabel}>Sales</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="trending-up-outline" size={24} color="#D97706" />
          <Text style={styles.statValue}>${stats.averagePrice.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Avg Price</Text>
        </View>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <PeriodButton label="7d" value="7" current={period} onPress={setPeriod} />
        <PeriodButton label="30d" value="30" current={period} onPress={setPeriod} />
        <PeriodButton label="90d" value="90" current={period} onPress={setPeriod} />
        <PeriodButton label="Year" value="365" current={period} onPress={setPeriod} />
      </View>

      {/* Sales List */}
      <FlatList
        data={sales}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No sales in this period</Text>
            <Text style={styles.emptySubtext}>Your sales will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

function PeriodButton({ label, value, current, onPress }) {
  const isActive = current === value;
  return (
    <TouchableOpacity
      style={[styles.periodButton, isActive && styles.periodButtonActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.periodButtonText, isActive && styles.periodButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  exportButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  saleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  platformBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  saleDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  saleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  saleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  salePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  profitSection: {
    marginRight: 12,
  },
  profitLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  profitValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
