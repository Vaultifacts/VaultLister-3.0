// Inventory Screen
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
import { inventoryApi } from '../services/api';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const response = await inventoryApi.getAll({ limit: 100 });
      setItems(response.data.items || response.data || []);
    } catch (error) {
      console.error('Inventory error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInventory();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.brand?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filter === 'all' ||
                         (filter === 'active' && item.status === 'active') ||
                         (filter === 'low' && item.quantity <= (item.low_stock_threshold || 2)) ||
                         (filter === 'sold' && item.status === 'sold');

    return matchesSearch && matchesFilter;
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
    >
      <Image
        source={{ uri: item.images?.[0] || 'https://via.placeholder.com/80' }}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemBrand}>{item.brand || 'No brand'}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemPrice}>${(item.list_price || 0).toFixed(2)}</Text>
          <View style={[
            styles.stockBadge,
            item.quantity === 0 ? styles.outOfStock :
            item.quantity <= (item.low_stock_threshold || 2) ? styles.lowStock : styles.inStock
          ]}>
            <Text style={styles.stockText}>
              {item.quantity === 0 ? 'Out' : item.quantity <= (item.low_stock_threshold || 2) ? 'Low' : `${item.quantity}`}
            </Text>
          </View>
        </View>
      </View>
      <Icon name="chevron-forward" size={20} color="#9CA3AF" />
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
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('Scan')}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
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

      {/* Filters */}
      <View style={styles.filters}>
        <FilterChip
          label="All"
          active={filter === 'all'}
          count={items.length}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          label="Active"
          active={filter === 'active'}
          count={items.filter(i => i.status === 'active').length}
          onPress={() => setFilter('active')}
        />
        <FilterChip
          label="Low Stock"
          active={filter === 'low'}
          count={items.filter(i => i.quantity <= (i.low_stock_threshold || 2) && i.quantity > 0).length}
          onPress={() => setFilter('low')}
        />
        <FilterChip
          label="Sold"
          active={filter === 'sold'}
          count={items.filter(i => i.status === 'sold').length}
          onPress={() => setFilter('sold')}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="cube-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No items found</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.emptyButtonText}>Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function FilterChip({ label, active, count, onPress }) {
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
    marginRight: 8,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inStock: {
    backgroundColor: '#D1FAE5',
  },
  lowStock: {
    backgroundColor: '#FEF3C7',
  },
  outOfStock: {
    backgroundColor: '#FEE2E2',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
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
