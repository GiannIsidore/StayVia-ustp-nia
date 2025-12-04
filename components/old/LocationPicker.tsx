import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { fetchNearbyLandmarks, Landmark, getPlaceTypeIcon } from '@/services/mapService';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02; // ~2.2km vertical view
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export interface LocationData {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  initialLocation?: LocationData;
  onLocationChange: (location: LocationData) => void;
  colors: any; // Theme colors
}

export default function LocationPicker({
  initialLocation,
  onLocationChange,
  colors,
}: LocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loadingLandmarks, setLoadingLandmarks] = useState(false);
  const [radiusSlider, setRadiusSlider] = useState(1000); // 1000m = 1km default
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const mapRef = useRef<MapView>(null);

  // Get user's current location on mount if no initial location
  useEffect(() => {
    if (!initialLocation) {
      getCurrentLocation();
    }
  }, []);

  // Refetch landmarks when radius changes
  useEffect(() => {
    if (selectedLocation) {
      fetchLandmarks(selectedLocation);
    }
  }, [radiusSlider]);

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

  const handleMapPress = (event: any) => {
    // If a landmark is selected, deselect it
    if (selectedLandmark) {
      setSelectedLandmark(null);
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newLocation = { latitude, longitude };
    handleLocationUpdate(newLocation);
  };

  const handleMarkerDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newLocation = { latitude, longitude };
    handleLocationUpdate(newLocation);
  };

  const handleRecenterPress = () => {
    getCurrentLocation();
  };

  const handleLocationUpdate = async (newLocation: LocationData) => {
    setSelectedLocation(newLocation);
    onLocationChange(newLocation);
    fetchLandmarks(newLocation);
  };

  const fetchLandmarks = async (location: LocationData) => {
    setLoadingLandmarks(true);
    console.log('Fetching landmarks for:', location, 'radius:', radiusSlider);
    try {
      const nearbyLandmarks = await fetchNearbyLandmarks({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radiusSlider,
      });
      console.log('Found landmarks:', nearbyLandmarks.length);
      setLandmarks(nearbyLandmarks);
    } catch (error) {
      console.error('Error fetching landmarks:', error);
    } finally {
      setLoadingLandmarks(false);
    }
  };

  const handleLandmarkPress = (landmark: Landmark) => {
    // Toggle selection - no zoom
    if (selectedLandmark && selectedLandmark.name === landmark.name) {
      setSelectedLandmark(null);
    } else {
      setSelectedLandmark(landmark);
    }
  };

  // Calculate display text for radius
  const getRadiusText = () => {
    if (radiusSlider >= 1000) {
      return `${(radiusSlider / 1000).toFixed(1)}km`;
    }
    return `${radiusSlider}m`;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.foreground }]}>Property Location</Text>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={
            selectedLocation
              ? {
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }
              : {
                  latitude: 10.3157,
                  longitude: 123.8854, // Default to Cebu City
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }
          }
          region={
            selectedLocation
              ? {
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }
              : undefined
          }
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}>
          {selectedLocation && (
            <>
              {/* Radius circle showing search area */}
              <Circle
                center={selectedLocation}
                radius={radiusSlider}
                strokeColor="rgba(102, 126, 234, 0.5)"
                fillColor="rgba(102, 126, 234, 0.1)"
                strokeWidth={2}
              />

              {/* Property location marker */}
              <Marker
                coordinate={selectedLocation}
                draggable
                onDragEnd={handleMarkerDragEnd}
                title="Property Location"
                description="Drag to adjust">
                <View style={styles.markerContainer}>
                  <Ionicons name="location" size={36} color="#667EEA" />
                </View>
              </Marker>

              {/* Landmark markers - hide others when one is selected */}
              {landmarks.map((landmark, index) => {
                const isSelected = selectedLandmark && selectedLandmark.name === landmark.name;
                const shouldShow = !selectedLandmark || isSelected;

                if (!shouldShow) return null;

                return (
                  <Marker
                    key={`landmark-${index}`}
                    coordinate={{
                      latitude: landmark.latitude,
                      longitude: landmark.longitude,
                    }}
                    title={landmark.name}
                    description={`${landmark.type} • ${landmark.distance}km away`}
                    onPress={() => handleLandmarkPress(landmark)}>
                    <View style={styles.landmarkMarkerContainer}>
                      <Ionicons
                        name={getPlaceTypeIcon(landmark.type) as any}
                        size={18}
                        color="#667EEA"
                      />
                    </View>
                  </Marker>
                );
              })}
            </>
          )}
        </MapView>

        {/* Recenter button */}
        <TouchableOpacity
          style={[styles.recenterButton, { backgroundColor: colors.card }]}
          onPress={handleRecenterPress}>
          <Ionicons name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Radius control with buttons */}
      {selectedLocation && (
        <View style={[styles.radiusContainer, { backgroundColor: colors.card }]}>
          <View style={styles.radiusHeader}>
            <View style={styles.radiusLabelContainer}>
              <Ionicons name="radio-outline" size={16} color={colors.primary} />
              <Text style={[styles.radiusLabel, { color: colors.foreground }]}>Search Radius</Text>
            </View>
            <View style={[styles.radiusBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.radiusBadgeText}>{getRadiusText()}</Text>
            </View>
          </View>

          <View style={styles.radiusButtons}>
            {[200, 500, 750, 1000, 1500, 2000].map((radius) => (
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

      {/* Landmarks count indicator */}
      {selectedLocation && !loadingLandmarks && (
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            {landmarks.length} {landmarks.length === 1 ? 'place' : 'places'} found within{' '}
            {getRadiusText()}
          </Text>
        </View>
      )}

      {/* Loading indicator */}
      {loadingLandmarks && (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Searching nearby places...
          </Text>
        </View>
      )}

      {/* Landmarks list */}
      {selectedLocation && !loadingLandmarks && landmarks.length > 0 && (
        <View style={[styles.landmarksContainer, { backgroundColor: colors.card }]}>
          <View style={styles.landmarksHeader}>
            <Text style={[styles.landmarksTitle, { color: colors.foreground }]}>Nearby Places</Text>
            {selectedLandmark && (
              <TouchableOpacity
                style={styles.clearButton}
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
                    isSelected && { backgroundColor: colors.background },
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
                    <Ionicons
                      name={getPlaceTypeIcon(landmark.type) as any}
                      size={16}
                      color={isSelected ? '#F59E0B' : colors.primary}
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
                  </View>
                  {isSelected ? (
                    <Ionicons name="close-circle" size={20} color="#F59E0B" />
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
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mapContainer: {
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  landmarkMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  radiusContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
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
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  radiusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  radiusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 12,
    borderRadius: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
  },
  landmarksContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  landmarksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  landmarksTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  landmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  landmarkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  landmarkInfo: {
    flex: 1,
  },
  landmarkName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  landmarkMeta: {
    fontSize: 11,
  },
  moreText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
