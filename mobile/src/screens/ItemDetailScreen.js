// Item Detail Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { inventoryApi, listingsApi } from '../services/api';

const { width } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      const response = await inventoryApi.getById(itemId);
      setItem(response.data);
    } catch (error) {
      console.error('Item load error:', error);
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleCrosslist = async () => {
    try {
      // Navigate to crosslist screen
      navigation.navigate('Crosslist', { itemId });
    } catch (error) {
      Alert.alert('Error', 'Failed to start crosslisting');
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditItem', { itemId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await inventoryApi.delete(itemId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = item.images?.length > 0 ? item.images : ['https://via.placeholder.com/400'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Details</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
          <Icon name="create-outline" size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(index);
            }}
          >
            {images.map((image, index) => (
              <Image
                key={index}
                source={{ uri: image }}
                style={styles.image}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentImageIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Item Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.metaRow}>
            {item.brand && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{item.brand}</Text>
              </View>
            )}
            {item.category && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{item.category}</Text>
              </View>
            )}
            {item.size && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>Size: {item.size}</Text>
              </View>
            )}
          </View>

          {/* Stock & Price */}
          <View style={styles.priceStockRow}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>List Price</Text>
              <Text style={styles.priceValue}>${(item.list_price || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Cost</Text>
              <Text style={styles.costValue}>${(item.cost || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.stockCard}>
              <Text style={styles.stockLabel}>Stock</Text>
              <View style={[
                styles.stockBadge,
                item.quantity === 0 ? styles.outOfStock :
                item.quantity <= 2 ? styles.lowStock : styles.inStock
              ]}>
                <Text style={styles.stockText}>{item.quantity || 0}</Text>
              </View>
            </View>
          </View>

          {/* SKU */}
          {item.sku && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SKU</Text>
              <Text style={styles.detailValue}>{item.sku}</Text>
            </View>
          )}

          {/* Condition */}
          {item.condition && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Condition</Text>
              <Text style={styles.detailValue}>{item.condition}</Text>
            </View>
          )}

          {/* Description */}
          {item.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}

          {/* Notes */}
          {item.notes && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notes}>{item.notes}</Text>
            </View>
          )}

          {/* Listings Status */}
          <View style={styles.listingsSection}>
            <Text style={styles.sectionLabel}>Listings</Text>
            {item.listings?.length > 0 ? (
              item.listings.map((listing, index) => (
                <View key={index} style={styles.listingItem}>
                  <View style={[styles.platformDot, { backgroundColor: getPlatformColor(listing.platform) }]} />
                  <Text style={styles.listingPlatform}>{listing.platform}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: listing.status === 'active' ? '#D1FAE5' : '#F3F4F6' }]}>
                    <Text style={[styles.statusText, { color: listing.status === 'active' ? '#059669' : '#6B7280' }]}>
                      {listing.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noListings}>Not listed on any platform yet</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Icon name="trash-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.crosslistBtn} onPress={handleCrosslist}>
          <Icon name="share-outline" size={20} color="#FFFFFF" />
          <Text style={styles.crosslistText}>Crosslist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getPlatformColor(platform) {
  switch (platform?.toLowerCase()) {
    case 'ebay': return '#E53238';
    case 'poshmark': return '#7F0353';
    case 'mercari': return '#4DC3C0';
    case 'depop': return '#FF2300';
    default: return '#6B7280';
  }
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  editBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: width * 0.8,
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: width,
    height: width * 0.8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
  },
  infoSection: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  metaBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  priceStockRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  priceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  costValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  stockLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  stockBadge: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  descriptionSection: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  notes: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  listingsSection: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  listingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  platformDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  listingPlatform: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noListings: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  deleteBtn: {
    width: 52,
    height: 52,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosslistBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  crosslistText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
