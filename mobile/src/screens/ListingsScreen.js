// Listings Screen
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { listingsApi } from '../services/api';

export default function ListingsScreen() {
  const navigation = useNavigation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      const response = await listingsApi.getAll({ limit: 100 });
      setListings(response.data.listings || response.data || []);
    } catch (error) {
      console.error('Listings error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadListings();
  }, []);

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         listing.platform?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
                         listing.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: '#D1FAE5', text: '#059669' };
      case 'sold': return { bg: '#FEE2E2', text: '#DC2626' };
      case 'draft': return { bg: '#F3F4F6', text: '#6B7280' };
      case 'pending': return { bg: '#FEF3C7', text: '#D97706' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'ebay': return 'logo-euro';
      case 'poshmark': return 'shirt';
      case 'mercari': return 'storefront';
      case 'depop': return 'bag';
      default: return 'globe';
    }
  };

  const renderItem = ({ item }) => {
    const statusColors = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.listingCard}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/80' }}
          style={styles.listingImage}
        />
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.platformRow}>
            <Icon name={getPlatformIcon(item.platform)} size={14} color="#6B7280" />
            <Text style={styles.platformText}>{item.platform || 'Not listed'}</Text>
          </View>
          <View style={styles.listingMeta}>
            <Text style={styles.listingPrice}>${(item.price || 0).toFixed(2)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {item.status || 'draft'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statsColumn}>
          <View style={styles.statItem}>
            <Icon name="eye-outline" size={14} color="#9CA3AF" />
            <Text style={styles.statText}>{item.views || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="heart-outline" size={14} color="#9CA3AF" />
            <Text style={styles.statText}>{item.likes || 0}</Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.headerTitle}>Listings</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateListing')}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filters */}
      <View style={styles.filters}>
        <StatusChip
          label="All"
          active={statusFilter === 'all'}
          count={listings.length}
          onPress={() => setStatusFilter('all')}
        />
        <StatusChip
          label="Active"
          active={statusFilter === 'active'}
          count={listings.filter(l => l.status === 'active').length}
          onPress={() => setStatusFilter('active')}
        />
        <StatusChip
          label="Draft"
          active={statusFilter === 'draft'}
          count={listings.filter(l => l.status === 'draft').length}
          onPress={() => setStatusFilter('draft')}
        />
        <StatusChip
          label="Sold"
          active={statusFilter === 'sold'}
          count={listings.filter(l => l.status === 'sold').length}
          onPress={() => setStatusFilter('sold')}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredListings}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="pricetag-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No listings found</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('CreateListing')}
            >
              <Text style={styles.emptyButtonText}>Create Your First Listing</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function StatusChip({ label, active, count, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
        <Text style={[styles.filterChipCountText, active && styles.filterChipCountTextActive]}>
          {count}
        </Text>
      </View>
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
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipCount: {
    marginLeft: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterChipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterChipCountText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterChipCountTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  listingImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  platformText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsColumn: {
    marginRight: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
