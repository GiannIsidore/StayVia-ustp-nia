import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Landmark, getPlaceTypeIcon } from '@/services/mapService';
import NativeMap from './NativeMap';

interface MapViewWithLandmarksProps {
  latitude: number;
  longitude: number;
  title: string;
  landmarks: Landmark[];
  isLoading: boolean;
  colors: any;
  onRadiusChange?: (radius: number) => void;
  radius?: number;
  onCategoryChange?: (category: string) => void;
  category?: string;
}

const ITEMS_PER_PAGE = 10;

const CATEGORY_FILTERS = [
  { id: 'essentials', label: 'Essentials', icon: 'star-outline' },
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'education', label: 'Education', icon: 'school-outline' },
  { id: 'health', label: 'Health', icon: 'medical-outline' },
  { id: 'entertainment', label: 'Entertainment', icon: 'game-controller-outline' },
  { id: 'finance', label: 'Finance', icon: 'card-outline' },
  { id: 'services', label: 'Services', icon: 'construct-outline' },
  { id: 'worship', label: 'Worship', icon: 'heart-outline' },
];

export default function MapViewWithLandmarks({
  latitude,
  longitude,
  title,
  landmarks,
  isLoading,
  colors,
  onRadiusChange,
  radius = 500,
  onCategoryChange,
  category = 'essentials',
}: MapViewWithLandmarksProps) {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [currentRadius, setCurrentRadius] = useState(radius);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(category);

  const handleLandmarkPress = (landmark: Landmark) => {
    setSelectedLandmark(selectedLandmark?.name === landmark.name ? null : landmark);
  };

  const handleRadiusChange = (newRadius: number) => {
    setCurrentRadius(newRadius);
    setSelectedLandmark(null);
    setCurrentPage(1);
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedLandmark(null);
    setCurrentPage(1);
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  const getRadiusText = () => {
    return currentRadius >= 1000 ? `${currentRadius / 1000}km` : `${currentRadius}m`;
  };

  // Filter landmarks by category
  const filterByCategory = (landmark: Landmark, category: string): boolean => {
    // Check both the formatted type and all raw types from Google API
    const displayType = landmark.type.toLowerCase();
    const allTypes = landmark.allTypes?.map((t) => t.toLowerCase()) || [];

    const hasType = (keywords: string[]) => {
      return keywords.some(
        (keyword) =>
          displayType.includes(keyword) || allTypes.some((type) => type.includes(keyword))
      );
    };

    switch (category) {
      case 'essentials':
        // Show top essential places (high ratings and popular, or critical services)
        const isCritical = hasType([
          'hospital',
          'pharmacy',
          'supermarket',
          'bank',
          'atm',
          'police',
        ]);
        const isHighRated =
          (landmark.rating &&
            landmark.rating >= 4.0 &&
            landmark.userRatingsTotal &&
            landmark.userRatingsTotal >= 20) ||
          false;
        return isCritical || isHighRated;

      case 'all':
        return true;

      case 'education':
        return hasType(['school', 'university', 'library', 'education']);

      case 'health':
        return hasType([
          'hospital',
          'pharmacy',
          'doctor',
          'dentist',
          'clinic',
          'medical',
          'health',
          'physiotherapist',
          'veterinary',
          'gym',
          'spa',
        ]);

      case 'entertainment':
        return hasType([
          'cinema',
          'movie',
          'park',
          'museum',
          'theater',
          'amusement',
          'zoo',
          'aquarium',
          'stadium',
          'bowling',
          'night_club',
          'tourist',
        ]);

      case 'finance':
        return hasType(['bank', 'atm', 'finance', 'insurance', 'accounting']);

      case 'services':
        return hasType(['post', 'police', 'fire', 'government', 'embassy', 'courthouse']);

      case 'worship':
        return hasType(['church', 'mosque', 'temple', 'worship', 'synagogue', 'hindu']);

      default:
        return true;
    }
  };

  const filteredLandmarks = landmarks.filter((landmark) =>
    filterByCategory(landmark, selectedCategory)
  );

  // Paginate landmarks
  const totalPages = Math.ceil(filteredLandmarks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLandmarks = filteredLandmarks.slice(startIndex, endIndex);

  const displayedLandmarks = selectedLandmark ? [selectedLandmark] : paginatedLandmarks;

  // Get category-specific colors
  const getCategoryColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      // Education - Blue
      School: '#3B82F6',
      University: '#3B82F6',
      Library: '#6366F1',

      // Transportation - Purple
      'Bus Terminal': '#8B5CF6',
      'Train Terminal': '#8B5CF6',
      'Transit Terminal': '#8B5CF6',
      Airport: '#7C3AED',

      // Shopping - Pink
      Mall: '#EC4899',
      Supermarket: '#EC4899',
      'Convenience Store': '#F472B6',
      Store: '#F472B6',

      // Food & Dining - Orange
      Restaurant: '#F59E0B',
      Cafe: '#F59E0B',
      Bakery: '#FB923C',
      'Fast Food': '#FB923C',
      Bar: '#EA580C',

      // Health & Wellness - Red
      Hospital: '#EF4444',
      Pharmacy: '#EF4444',
      Doctor: '#F87171',
      Gym: '#DC2626',

      // Finance - Green
      Bank: '#10B981',
      ATM: '#10B981',

      // Services - Cyan
      'Post Office': '#06B6D4',
      'Police Station': '#0891B2',
      'Fire Station': '#DC2626',

      // Entertainment - Yellow
      Cinema: '#EAB308',
      Park: '#84CC16',
      'Amusement Park': '#FDE047',
      Museum: '#CA8A04',

      // Worship - Indigo
      Church: '#6366F1',
      Mosque: '#6366F1',
      Temple: '#6366F1',
      'Place of Worship': '#6366F1',
    };

    return colorMap[type] || '#F59E0B'; // Default orange
  };

  // Prepare markers for OpenStreetMap with category info
  const mapMarkers = [
    // Property marker - ALWAYS VISIBLE (isPrimary = true)
    {
      latitude,
      longitude,
      title,
      color: '#667EEA',
      icon: getPlaceTypeIcon('Property'), // Home icon for property
      isPrimary: true, // This prevents clustering
    },
    // Landmark markers - These will cluster
    ...filteredLandmarks
      .filter((landmark) => {
        if (selectedLandmark) {
          return landmark.name === selectedLandmark.name;
        }
        return true;
      })
      .map((landmark) => {
        const icon = getPlaceTypeIcon(landmark.type);
        console.log(`📍 Marker for ${landmark.name} (${landmark.type}): icon=${icon}`);
        return {
          latitude: landmark.latitude,
          longitude: landmark.longitude,
          title: `${landmark.name} - ${landmark.type}`,
          color: getCategoryColor(landmark.type),
          category: landmark.type,
          icon,
          isPrimary: false, // This allows clustering
        };
      }),
  ];

  console.log('🗺️ MapViewWithLandmarks - Creating', mapMarkers.length, 'markers');
  console.log('🗺️ Property marker icon:', mapMarkers[0]?.icon);

  // Prepare circles
  const mapCircles = [
    {
      latitude,
      longitude,
      radius: currentRadius,
      color: '#667EEA',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Native Map - using react-native-maps for better performance */}
      <View style={styles.mapContainer}>
        <NativeMap
          center={{ latitude, longitude }}
          zoom={15}
          markers={mapMarkers}
          circles={mapCircles}
          style={styles.map}
        />
      </View>

      {/* Radius selector with modern design */}
      <View style={[styles.radiusContainer, { backgroundColor: colors.card }]}>
        <View style={styles.radiusHeader}>
          <View style={styles.radiusLabelContainer}>
            <View style={styles.iconBadge}>
              <Ionicons name="navigate-circle-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.radiusLabel, { color: colors.foreground }]}>Search Radius</Text>
          </View>
          <View style={[styles.radiusBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.radiusBadgeText}>{getRadiusText()}</Text>
          </View>
        </View>

        <View style={styles.radiusButtons}>
          {[200, 500, 750, 1000].map((radiusOption) => (
            <TouchableOpacity
              key={radiusOption}
              style={[
                styles.radiusButton,
                {
                  backgroundColor:
                    currentRadius === radiusOption ? colors.primary : colors.background,
                  borderColor:
                    currentRadius === radiusOption ? colors.primary : colors.border || '#e5e7eb',
                },
              ]}
              onPress={() => handleRadiusChange(radiusOption)}>
              <Text
                style={[
                  styles.radiusButtonText,
                  { color: currentRadius === radiusOption ? '#fff' : colors.foreground },
                ]}>
                {radiusOption >= 1000 ? `${radiusOption / 1000}km` : `${radiusOption}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category filters with modern design */}
      <View style={[styles.filterContainer, { backgroundColor: colors.card }]}>
        <View style={styles.filterHeader}>
          <View style={styles.iconBadge}>
            <Ionicons name="filter-outline" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.filterLabel, { color: colors.foreground }]}>Place Category</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}>
          {CATEGORY_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedCategory === filter.id ? colors.primary : colors.background,
                  borderColor:
                    selectedCategory === filter.id ? colors.primary : colors.border || '#e5e7eb',
                },
              ]}
              onPress={() => handleCategoryChange(filter.id)}>
              <Ionicons
                name={filter.icon as any}
                size={14}
                color={selectedCategory === filter.id ? '#fff' : colors.foreground}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedCategory === filter.id ? '#fff' : colors.foreground },
                ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Landmarks count with modern design */}
      {!isLoading && (
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.iconBadge}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            <Text style={{ fontWeight: '700' }}>{filteredLandmarks.length}</Text>{' '}
            {filteredLandmarks.length === 1 ? 'place' : 'places'} • {getRadiusText()} radius
          </Text>
        </View>
      )}

      {/* Loading with modern design */}
      {isLoading && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Searching nearby places...
          </Text>
        </View>
      )}

      {/* Landmarks list with modern design */}
      {!isLoading && landmarks.length > 0 && (
        <View style={[styles.landmarksContainer, { backgroundColor: colors.card }]}>
          <View style={styles.landmarksHeader}>
            <Text style={[styles.landmarksTitle, { color: colors.foreground }]}>
              Nearby Places{' '}
              {selectedLandmark
                ? '(1 selected)'
                : `(${startIndex + 1}-${Math.min(endIndex, filteredLandmarks.length)} of ${filteredLandmarks.length})`}
            </Text>
            {selectedLandmark && (
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => setSelectedLandmark(null)}>
                <Text style={[styles.clearButtonText, { color: colors.primary }]}>Show All</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            style={styles.landmarksList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled>
            {displayedLandmarks.map((landmark, index) => {
              const isSelected = selectedLandmark && selectedLandmark.name === landmark.name;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.landmarkItem,
                    { backgroundColor: colors.background, borderColor: colors.border || '#e5e7eb' },
                    isSelected && {
                      backgroundColor: colors.primary + '10',
                      borderColor: colors.primary,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleLandmarkPress(landmark)}>
                  <View
                    style={[
                      styles.landmarkIconContainer,
                      isSelected && {
                        backgroundColor: colors.primary,
                      },
                    ]}>
                    <Ionicons
                      name={getPlaceTypeIcon(landmark.type) as any}
                      size={18}
                      color={isSelected ? '#fff' : colors.primary}
                    />
                  </View>
                  <View style={styles.landmarkInfo}>
                    <Text
                      style={[styles.landmarkName, { color: colors.foreground }]}
                      numberOfLines={1}>
                      {landmark.name}
                    </Text>
                    <Text style={[styles.landmarkDetails, { color: colors.mutedForeground }]}>
                      {landmark.type} • {landmark.distance}km away
                    </Text>
                    {landmark.rating && (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[styles.landmarkRating, { color: colors.mutedForeground }]}>
                          {landmark.rating.toFixed(1)}{' '}
                          {landmark.userRatingsTotal && `(${landmark.userRatingsTotal})`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pagination with modern design */}
          {!selectedLandmark && totalPages > 1 && (
            <View
              style={[styles.paginationContainer, { borderTopColor: colors.border || '#e5e7eb' }]}>
              <Text style={[styles.paginationInfo, { color: colors.mutedForeground }]}>
                Page {currentPage} of {totalPages}
              </Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    {
                      backgroundColor: currentPage === 1 ? colors.background : colors.primary,
                      borderColor: colors.border || '#e5e7eb',
                      opacity: currentPage === 1 ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}>
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentPage === 1 ? colors.mutedForeground : '#fff'}
                  />
                  <Text
                    style={[
                      styles.paginationButtonText,
                      { color: currentPage === 1 ? colors.mutedForeground : '#fff' },
                    ]}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    {
                      backgroundColor:
                        currentPage === totalPages ? colors.background : colors.primary,
                      borderColor: colors.border || '#e5e7eb',
                      opacity: currentPage === totalPages ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}>
                  <Text
                    style={[
                      styles.paginationButtonText,
                      { color: currentPage === totalPages ? colors.mutedForeground : '#fff' },
                    ]}>
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentPage === totalPages ? colors.mutedForeground : '#fff'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {!isLoading && landmarks.length === 0 && (
        <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No places found</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Try increasing the search radius to find more places nearby
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  radiusContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  radiusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  radiusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  radiusBadgeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  radiusButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  radiusButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterChips: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  landmarksContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  landmarksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  landmarksTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  landmarksList: {
    maxHeight: 400,
  },
  landmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  landmarkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  landmarkInfo: {
    flex: 1,
  },
  landmarkName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  landmarkDetails: {
    fontSize: 12,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  landmarkRating: {
    fontSize: 11,
    fontWeight: '600',
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  paginationInfo: {
    fontSize: 13,
    fontWeight: '600',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
