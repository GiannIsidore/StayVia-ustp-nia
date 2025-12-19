import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { fetchNearbyLandmarks, Landmark, getPlaceTypeIcon } from '@/services/mapService';
import NativeMap from './NativeMap';
import { useAccountType } from '@/hooks/useAccountType';

export interface LocationData {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  initialLocation?: LocationData;
  onLocationChange: (location: LocationData) => void;
  colors: any;
}

export default function LocationPicker({
  initialLocation,
  onLocationChange,
  colors,
}: LocationPickerProps) {
  const { accountType } = useAccountType();
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loadingLandmarks, setLoadingLandmarks] = useState(false);
  const [radiusSlider, setRadiusSlider] = useState(500);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    if (!initialLocation) {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    if (selectedLocation && accountType !== 'landlord') {
      fetchLandmarks(selectedLocation);
    }
  }, [radiusSlider, accountType, selectedLocation]);

  // Hide instructions after first interaction
  useEffect(() => {
    if (selectedLocation) {
      const timer = setTimeout(() => setShowInstructions(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedLocation]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      handleLocationUpdate(coords);
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const handleMapPress = (latitude: number, longitude: number) => {
    if (selectedLandmark) {
      setSelectedLandmark(null);
      return;
    }

    const newLocation = { latitude, longitude };
    handleLocationUpdate(newLocation);
    setShowInstructions(false);
  };

  const handleRecenterPress = () => {
    getCurrentLocation();
  };

  const handleLocationUpdate = async (newLocation: LocationData) => {
    setSelectedLocation(newLocation);
    onLocationChange(newLocation);
    if (accountType !== 'landlord') {
      fetchLandmarks(newLocation);
    }
  };

  const fetchLandmarks = async (location: LocationData) => {
    setLoadingLandmarks(true);
    try {
      const nearbyLandmarks = await fetchNearbyLandmarks({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radiusSlider,
      });
      setLandmarks(nearbyLandmarks);
    } catch (error) {
      console.error('Error fetching landmarks:', error);
    } finally {
      setLoadingLandmarks(false);
    }
  };

  const handleLandmarkPress = (landmark: Landmark) => {
    if (selectedLandmark && selectedLandmark.name === landmark.name) {
      setSelectedLandmark(null);
    } else {
      setSelectedLandmark(landmark);
    }
  };

  const getRadiusText = () => {
    if (radiusSlider >= 1000) {
      return `${(radiusSlider / 1000).toFixed(1)}km`;
    }
    return `${radiusSlider}m`;
  };

  const mapMarkers = selectedLocation
    ? [
        // Primary marker - Property location (won't cluster)
        {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          title: 'Property Location',
          color: '#667EEA',
          icon: 'home-outline',
          isPrimary: true, // This prevents clustering
        },
        // Landmark markers (will cluster) - only show for non-landlords
        ...(accountType !== 'landlord'
          ? landmarks
              .filter((landmark) => {
                if (selectedLandmark) {
                  return landmark.name === selectedLandmark.name;
                }
                return true;
              })
              .map((landmark) => ({
                latitude: landmark.latitude,
                longitude: landmark.longitude,
                title: `${landmark.name} - ${landmark.type}`,
                color: '#F59E0B',
                icon: getPlaceTypeIcon(landmark.type),
                isPrimary: false, // This allows clustering
              }))
          : []),
      ]
    : [];

  const mapCircles = selectedLocation && accountType !== 'landlord'
    ? [
        {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          radius: radiusSlider,
          color: '#667EEA',
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.foreground }]}>Property Location</Text>

      <View style={styles.mapContainer}>
        <NativeMap
          center={
            selectedLocation || {
              latitude: 8.4542,
              longitude: 124.6319,
            }
          }
          zoom={15}
          markers={mapMarkers}
          circles={mapCircles}
          onMapPress={handleMapPress}
          style={styles.map}
        />

        {/* Instructions Overlay */}
        {showInstructions && !selectedLocation && (
          <View style={styles.instructionsOverlay}>
            <View style={[styles.instructionsBox, { backgroundColor: colors.primary }]}>
              <Ionicons name="hand-left" size={24} color="#fff" />
              <Text style={styles.instructionsText}>
                Tap anywhere on the map to pin your property location
              </Text>
            </View>
          </View>
        )}

        {/* Location Confirmed Badge */}
        {selectedLocation && (
          <View style={styles.confirmedBadge}>
            <View style={[styles.confirmedBox, { backgroundColor: '#10B981' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.confirmedText}>Location Pinned</Text>
            </View>
          </View>
        )}

        {/* Control Buttons */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[styles.recenterButton, { backgroundColor: colors.card }]}
            onPress={handleRecenterPress}>
            <Ionicons name="locate" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Helper Text */}
      <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
        {selectedLocation
          ? 'Tap the map again to change the property location'
          : 'Tap the map to set your property location'}
      </Text>

      {selectedLocation && accountType !== 'landlord' && (
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
            {[200, 500, 750, 1000].map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[
                  styles.radiusButton,
                  {
                    backgroundColor: radiusSlider === radius ? colors.primary : colors.background,
                    borderColor:
                      radiusSlider === radius ? colors.primary : colors.border || '#e5e7eb',
                  },
                ]}
                onPress={() => setRadiusSlider(radius)}>
                <Text
                  style={[
                    styles.radiusButtonText,
                    {
                      color: radiusSlider === radius ? '#fff' : colors.foreground,
                    },
                  ]}>
                  {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {selectedLocation && !loadingLandmarks && accountType !== 'landlord' && (
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.iconBadge}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            <Text style={{ fontWeight: '700' }}>{landmarks.length}</Text>{' '}
            {landmarks.length === 1 ? 'place' : 'places'} found within {getRadiusText()}
          </Text>
        </View>
      )}

      {loadingLandmarks && accountType !== 'landlord' && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Searching nearby places...
          </Text>
        </View>
      )}

      {selectedLocation && !loadingLandmarks && landmarks.length > 0 && accountType !== 'landlord' && (
        <View style={[styles.landmarksContainer, { backgroundColor: colors.card }]}>
          <View style={styles.landmarksHeader}>
            <Text style={[styles.landmarksTitle, { color: colors.foreground }]}>Nearby Places</Text>
            {selectedLandmark && (
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => setSelectedLandmark(null)}>
                <Text style={[styles.clearButtonText, { color: colors.primary }]}>Show All</Text>
              </TouchableOpacity>
            )}
          </View>
          {(selectedLandmark ? [selectedLandmark] : landmarks.slice(0, 5)).map(
            (landmark, index) => {
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
                    <Text style={[styles.landmarkMeta, { color: colors.mutedForeground }]}>
                      {landmark.type} • {landmark.distance}km
                    </Text>
                    {landmark.rating && (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={[styles.landmarkRating, { color: colors.mutedForeground }]}>
                          {landmark.rating.toFixed(1)}{' '}
                          {landmark.userRatingsTotal && `(${landmark.userRatingsTotal})`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isSelected ? (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              );
            }
          )}
          {!selectedLandmark && landmarks.length > 5 && (
            <Text style={[styles.moreText, { color: colors.mutedForeground }]}>
              +{landmarks.length - 5} more places
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  mapContainer: {
    height: 360,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
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
  instructionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    maxWidth: '90%',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  confirmedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  confirmedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mapControls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    gap: 12,
  },
  recenterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  radiusContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
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
    color: '#fff',
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
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
    marginTop: 16,
    borderRadius: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  landmarksContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
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
  landmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
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
  landmarkMeta: {
    fontSize: 12,
    marginBottom: 2,
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
  moreText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    fontWeight: '500',
  },
});
