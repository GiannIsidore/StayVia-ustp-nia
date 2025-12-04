import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface MarkerData {
  latitude: number;
  longitude: number;
  title: string;
  color: string;
  icon: string;
  isPrimary?: boolean;
  category?: string;
}

interface NativeMapProps {
  center: {
    latitude: number;
    longitude: number;
  };
  zoom?: number;
  markers?: MarkerData[];
  circles?: {
    latitude: number;
    longitude: number;
    radius: number;
    color?: string;
  }[];
  onMapPress?: (lat: number, lon: number) => void;
  style?: any;
}

// Predefined color palette - safe, accessible colors
const SAFE_COLORS = {
  primary: '#667EEA',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F59E0B',
  red: '#EF4444',
  green: '#10B981',
  cyan: '#06B6D4',
  yellow: '#EAB308',
  indigo: '#6366F1',
  default: '#6B7280',
} as const;

// Validate and sanitize color
function getSafeColor(color: string): string {
  if (!color) return SAFE_COLORS.default;

  // If it's already a hex color, validate it
  if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
    return color;
  }

  // Check if it's in our safe palette
  if (color in SAFE_COLORS) {
    return SAFE_COLORS[color as keyof typeof SAFE_COLORS];
  }

  return SAFE_COLORS.default;
}

export default function NativeMap({
  center,
  zoom = 15,
  markers = [],
  circles = [],
  onMapPress,
  style,
}: NativeMapProps) {
  const mapRef = useRef<MapView>(null);
  const latitudeDelta = 360 / Math.pow(2, zoom);
  const longitudeDelta = latitudeDelta;

  // Track if this is the first render to avoid unnecessary animation
  const isFirstRender = useRef(true);

  // Animate map to new center when it changes (but not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (mapRef.current && center.latitude && center.longitude) {
      mapRef.current.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta,
          longitudeDelta,
        },
        1000 // 1 second smooth animation
      );
    }
  }, [center.latitude, center.longitude]);

  const handlePress = (e: any) => {
    if (!onMapPress) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onMapPress(latitude, longitude);
  };

  // Separate primary markers from regular markers
  const primaryMarkers = markers.filter((m) => m.isPrimary);
  const regularMarkers = markers.filter((m) => !m.isPrimary);

  // Debug logging
  useEffect(() => {
    console.log('🗺️ NativeMap - Received props:', {
      center,
      markersCount: markers.length,
      primaryCount: primaryMarkers.length,
      regularCount: regularMarkers.length,
      circlesCount: circles.length,
    });

    if (markers.length > 0) {
      console.log('🗺️ NativeMap - First marker:', {
        ...markers[0],
        hasValidCoords: !!(markers[0].latitude && markers[0].longitude),
      });
    }

    // Show toast for debugging
    if (markers.length > 0) {
      Toast.show({
        type: 'info',
        text1: 'NativeMap Debug',
        text2: `${markers.length} markers, ${primaryMarkers.length} primary, ${regularMarkers.length} regular`,
        visibilityTime: 3000,
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'NativeMap Warning',
        text2: 'No markers received',
        visibilityTime: 2000,
      });
    }
  }, [markers.length, primaryMarkers.length, regularMarkers.length]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta,
          longitudeDelta,
        }}
        onPress={handlePress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        customMapStyle={[
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        ]}>
        {/* Render circles */}
        {circles.map((circle, idx) => (
          <Circle
            key={`circle-${idx}`}
            center={{
              latitude: circle.latitude,
              longitude: circle.longitude,
            }}
            radius={circle.radius}
            strokeColor={circle.color || '#6366F1'}
            fillColor={(circle.color || '#6366F1') + '15'}
            strokeWidth={2}
          />
        ))}

        {/* Primary markers (property location) - matching old implementation */}
        {primaryMarkers.map((marker, idx) => {
          // Validate coordinates
          if (!marker.latitude || !marker.longitude) {
            console.warn('⚠️ NativeMap - Invalid primary marker coordinates:', marker);
            return null;
          }

          console.log(`📍 Rendering primary marker ${idx}:`, {
            lat: marker.latitude,
            lon: marker.longitude,
            title: marker.title,
          });

          return (
            <Marker
              key={`primary-${marker.latitude}-${marker.longitude}-${idx}`}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              title={marker.title}>
              <View style={styles.primaryMarkerContainer}>
                <Ionicons name="location" size={20} color="#667EEA"  />
              </View>
            </Marker>
          );
        })}

        {regularMarkers.map((marker, idx) => {
          // Extract category from title if it contains a dash
          const titleParts = marker.title.split(' - ');
          const displayTitle = titleParts[0];
          const category = titleParts[1] || marker.category || '';

          // Pass icon name directly - getPlaceTypeIcon already returns valid Ionicons names
          const iconName = marker.icon || 'location-outline';

          // Validate coordinates
          if (!marker.latitude || !marker.longitude) {
            console.warn('⚠️ NativeMap - Invalid landmark marker coordinates:', marker);
            return null;
          }

          if (idx < 3) {
            console.log(`📍 Rendering landmark marker ${idx}:`, {
              lat: marker.latitude,
              lon: marker.longitude,
              title: displayTitle,
              icon: iconName,
            });
          }

          return (
            <Marker
              key={`marker-${marker.latitude}-${marker.longitude}-${idx}`}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              title={displayTitle}
              description={category}>
              <View style={styles.landmarkMarkerContainer}>
                <Ionicons name={iconName as any} size={20} color="#667EEA" />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  primaryMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  landmarkMarkerContainer: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    borderColor: '#667EEA',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // Shadow for Android
    elevation: 5,
  },
});
