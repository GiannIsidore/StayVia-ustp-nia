import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Landmark, getPlaceTypeIcon } from '@/services/mapService';

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
  { id: 'essentials', label: 'Essentials', icon: '⭐' },
  { id: 'all', label: 'All', icon: '📱' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎮' },
  { id: 'finance', label: 'Finance', icon: '💳' },
  { id: 'services', label: 'Services', icon: '🔧' },
  { id: 'worship', label: 'Worship', icon: '❤️' },
];

// Web version - uses a simple placeholder map
export default function MapViewWithLandmarks({
  latitude,
  longitude,
  title,
  landmarks,
  isLoading,
  colors,
  onRadiusChange,
  radius = 1000,
  onCategoryChange,
  category = 'essentials',
}: MapViewWithLandmarksProps) {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [currentRadius, setCurrentRadius] = useState(radius);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredLandmarks = landmarks;

  // Paginate landmarks
  const totalPages = Math.ceil(filteredLandmarks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLandmarks = filteredLandmarks.slice(startIndex, endIndex);

  const displayedLandmarks = selectedLandmark ? [selectedLandmark] : paginatedLandmarks;

  // Google Maps static image URL
  const mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=14&size=600x300&markers=color:blue%7C${latitude},${longitude}${filteredLandmarks
    .slice(0, 10)
    .map((l) => `&markers=color:red%7Csize:small%7C${l.latitude},${l.longitude}`)
    .join('')}&key=YOUR_API_KEY`;

  return (
    <View>
      {/* Map Placeholder for Web */}
      <View style={[styles.mapContainer, { backgroundColor: colors.muted || '#f3f4f6' }]}>
        <View style={styles.mapPlaceholder}>
          <Text style={[styles.mapPlaceholderTitle, { color: colors.foreground }]}>
            📍 Map View (Web Debug Mode)
          </Text>
          <Text style={[styles.mapPlaceholderText, { color: colors.mutedForeground }]}>
            Location: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
          <Text style={[styles.mapPlaceholderText, { color: colors.mutedForeground }]}>
            {title}
          </Text>
          <Text style={[styles.mapPlaceholderSubtext, { color: colors.mutedForeground }]}>
            Maps are available on mobile devices
          </Text>
          <TouchableOpacity
            style={[styles.openMapButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
              window.open(url, '_blank');
            }}>
            <Text style={styles.openMapButtonText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Radius selector */}
      <View style={[styles.radiusContainer, { backgroundColor: colors.card }]}>
        <View style={styles.radiusHeader}>
          <View style={styles.radiusLabelContainer}>
            <Text style={styles.radiusIcon}>📡</Text>
            <Text style={[styles.radiusLabel, { color: colors.foreground }]}>Search Radius</Text>
          </View>
          <View style={[styles.radiusBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.radiusBadgeText}>{getRadiusText()}</Text>
          </View>
        </View>

        <View style={styles.radiusButtons}>
          {[200, 500, 750, 1000, 1500, 2000].map((radiusOption) => (
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

      {/* Category filters */}
      <View style={[styles.filterContainer, { backgroundColor: colors.card }]}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterIcon}>🔍</Text>
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
              <Text style={styles.filterChipIcon}>{filter.icon}</Text>
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

      {/* Landmarks count */}
      {!isLoading && (
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            {filteredLandmarks.length} {filteredLandmarks.length === 1 ? 'place' : 'places'}
            {selectedCategory !== 'essentials' &&
              selectedCategory !== 'all' &&
              ` (${selectedCategory})`}{' '}
            • {getRadiusText()} radius
          </Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Searching nearby places...
          </Text>
        </View>
      )}

      {/* Landmarks list */}
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
                style={styles.clearButton}
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
                    isSelected && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
                  ]}
                  onPress={() => handleLandmarkPress(landmark)}>
                  <View
                    style={[
                      styles.landmarkIconContainer,
                      {
                        backgroundColor: isSelected ? '#FEF3C7' : colors.background,
                        borderWidth: isSelected ? 1 : 0,
                        borderColor: '#F59E0B',
                      },
                    ]}>
                    <Text style={styles.landmarkIcon}>📍</Text>
                  </View>
                  <View style={styles.landmarkInfo}>
                    <Text style={[styles.landmarkName, { color: colors.foreground }]}>
                      {landmark.name}
                    </Text>
                    <Text style={[styles.landmarkDetails, { color: colors.mutedForeground }]}>
                      {landmark.type} • {landmark.distance}km away
                    </Text>
                  </View>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pagination */}
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
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {!isLoading && landmarks.length === 0 && (
        <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No places found within {getRadiusText()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 14,
    marginBottom: 4,
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  openMapButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openMapButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  radiusContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radiusIcon: {
    fontSize: 16,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  radiusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  radiusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  landmarksContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  landmarksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  landmarksTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  landmarksList: {
    maxHeight: 300,
  },
  landmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  landmarkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  landmarkIcon: {
    fontSize: 16,
  },
  landmarkInfo: {
    flex: 1,
  },
  landmarkName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  landmarkDetails: {
    fontSize: 12,
  },
  checkmark: {
    fontSize: 20,
    color: '#F59E0B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  filterContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterIcon: {
    fontSize: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  paginationInfo: {
    fontSize: 12,
    fontWeight: '500',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
