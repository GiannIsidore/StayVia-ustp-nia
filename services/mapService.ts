const GOOGLE_API_KEY = 'AIzaSyATT95hve7Zl8BinEMLqXKOKjPEH9UaUwo';

// 🗺️ Using Google Maps prominence ranking - shows places like Google Maps does!
// No custom categories needed - Google automatically ranks by importance/reviews/popularity

export interface Landmark {
  name: string;
  type: string; // Primary formatted type for display
  allTypes: string[]; // All raw types from Google API
  distance: number; // in kilometers
  address: string;
  latitude: number;
  longitude: number;
  // Prominence metadata (like Google Maps)
  rating?: number; // Average star rating
  userRatingsTotal?: number; // Number of reviews
  businessStatus?: string; // OPERATIONAL, CLOSED_TEMPORARILY, etc.
  priceLevel?: number; // 0-4 price indicator
}

export interface NearbyPlacesParams {
  latitude: number;
  longitude: number;
  radius?: number; // in meters, default 500m (optimized)
  // No category filtering - using Google Maps prominence ranking instead!
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

/**
 * Fetch nearby landmarks using Google Places API
 * @param params Location and search parameters
 * @returns Array of nearby landmarks
 */
export async function fetchNearbyLandmarks(params: NearbyPlacesParams): Promise<Landmark[]> {
  const { latitude, longitude, radius = 1000 } = params;

  try {
    const searchRadius = radius;
    let allResults: any[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 3; // Google allows up to 3 pages (60 results max)

    // 🗺️ Fetch multiple pages to get comprehensive results (up to 60 places)
    do {
      const url = nextPageToken
        ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
        : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${searchRadius}&key=${GOOGLE_API_KEY}`;

      if (pageCount > 0) {
        console.log(`[MapService] Fetching page ${pageCount + 1}...`);
        // Google requires 2 second delay between page requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log(
          `[MapService] Fetching ALL places within ${searchRadius}m (with pagination)...`
        );
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        if (pageCount === 0) {
          // Only throw on first page error
          console.error('Google Places API error:', data.status, data.error_message);
          throw new Error(data.error_message || 'Failed to fetch nearby places');
        } else {
          // For subsequent pages, just stop pagination
          console.log(`[MapService] Page ${pageCount + 1} returned ${data.status}, stopping`);
          break;
        }
      }

      if (data.status === 'ZERO_RESULTS' || !data.results) {
        console.log('[MapService] No more places found');
        break;
      }

      allResults = allResults.concat(data.results);
      nextPageToken = data.next_page_token;
      pageCount++;

      console.log(
        `[MapService] Page ${pageCount}: Found ${data.results.length} places (total: ${allResults.length})`
      );
    } while (nextPageToken && pageCount < MAX_PAGES);

    console.log(`[MapService] ✅ Total: ${allResults.length} places from ${pageCount} pages`);
    console.log(
      '[MapService] All places:',
      allResults.map((p: any) => p.name)
    );

    // Convert radius to km for filtering
    const radiusInKm = radius / 1000;

    // 🗺️ Map ALL results with NO filtering (except distance)
    const allLandmarks: Landmark[] = allResults
      .map((place: any) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        );

        // Get the first meaningful type for display
        const primaryType = place.types?.[0] || 'place';
        const allTypes = place.types || [];

        return {
          name: place.name,
          type: formatPlaceType(primaryType),
          allTypes: allTypes,
          distance,
          address: place.vicinity || place.formatted_address || '',
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          // ⭐ Metadata from Google
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          businessStatus: place.business_status,
          priceLevel: place.price_level,
        };
      })
      .filter((landmark: Landmark) => landmark.distance <= radiusInKm)
      .sort((a: Landmark, b: Landmark) => a.distance - b.distance); // Sort by distance (closest first)

    console.log(`[MapService] Returning ${allLandmarks.length} places within ${radiusInKm}km`);
    console.log(
      '[MapService] Closest 5:',
      allLandmarks.slice(0, 5).map((l) => `${l.name} (${l.distance}km)`)
    );

    return allLandmarks;
  } catch (error) {
    console.error('Error fetching nearby landmarks:', error);
    throw error;
  }
}

// 🗑️ Removed filterLandmarksByCategory() function
// Now using Google Maps prominence ranking directly - no custom filtering needed!

/**
 * Format place type for display
 */
function formatPlaceType(type: string): string {
  const typeMap: Record<string, string> = {
    // Education
    school: 'School',
    university: 'University',
    library: 'Library',

    // Transportation
    bus_station: 'Bus Terminal',
    train_station: 'Train Terminal',
    transit_station: 'Transit Terminal',
    airport: 'Airport',
    subway_station: 'Subway Station',
    light_rail_station: 'Light Rail',
    taxi_stand: 'Taxi Stand',

    // Shopping
    shopping_mall: 'Mall',
    supermarket: 'Supermarket',
    convenience_store: 'Convenience Store',
    department_store: 'Department Store',
    store: 'Store',
    clothing_store: 'Clothing Store',
    electronics_store: 'Electronics Store',
    book_store: 'Book Store',
    shoe_store: 'Shoe Store',
    furniture_store: 'Furniture Store',
    home_goods_store: 'Home Goods',
    hardware_store: 'Hardware Store',
    pet_store: 'Pet Store',
    laundry: 'Laundry',

    // Food & Dining
    restaurant: 'Restaurant',
    cafe: 'Cafe',
    bakery: 'Bakery',
    meal_takeaway: 'Fast Food',
    meal_delivery: 'Food Delivery',
    food: 'Food',
    bar: 'Bar',

    // Lodging
    lodging: 'Hotel',
    hotel: 'Hotel',
    motel: 'Motel',
    inn: 'Inn',
    guest_house: 'Guest House',
    hostel: 'Hostel',
    campground: 'Campground',
    rv_park: 'RV Park',

    // Health & Wellness
    hospital: 'Hospital',
    pharmacy: 'Pharmacy',
    doctor: 'Doctor',
    dentist: 'Dentist',
    physiotherapist: 'Physiotherapist',
    veterinary_care: 'Veterinary',
    gym: 'Gym',
    spa: 'Spa',
    health: 'Health',

    // Finance
    bank: 'Bank',
    atm: 'ATM',
    finance: 'Bank',
    accounting: 'Accounting',
    insurance_agency: 'Insurance',

    // Services
    post_office: 'Post Office',
    police: 'Police Station',
    fire_station: 'Fire Station',
    local_government_office: 'Government Office',
    courthouse: 'Courthouse',
    embassy: 'Embassy',

    // Entertainment & Recreation
    movie_theater: 'Cinema',
    bowling_alley: 'Bowling',
    amusement_park: 'Amusement Park',
    aquarium: 'Aquarium',
    art_gallery: 'Art Gallery',
    museum: 'Museum',
    night_club: 'Night Club',
    park: 'Park',
    stadium: 'Stadium',
    zoo: 'Zoo',
    tourist_attraction: 'Tourist Spot',

    // Technology & Work
    internet_cafe: 'Internet Cafe',
    computer_store: 'Computer Store',

    // Worship
    church: 'Church',
    mosque: 'Mosque',
    temple: 'Temple',
    hindu_temple: 'Hindu Temple',
    synagogue: 'Synagogue',
    place_of_worship: 'Place of Worship',

    // Utilities
    gas_station: 'Gas Station',
    car_wash: 'Car Wash',
    car_rental: 'Car Rental',
    car_repair: 'Car Repair',
    parking: 'Parking',

    // Printing & Stationery
    print_shop: 'Print Shop',
    stationery_store: 'Stationery',

    // Other
    point_of_interest: 'Landmark',
    establishment: 'Place',
    beauty_salon: 'Beauty Salon',
    hair_care: 'Hair Salon',
    locksmith: 'Locksmith',
    moving_company: 'Moving Company',
    painter: 'Painter',
    plumber: 'Plumber',
    electrician: 'Electrician',
    roofing_contractor: 'Roofing',
    storage: 'Storage',
  };

  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get icon name for place type (for Ionicons)
 */
export function getPlaceTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    // Education
    School: 'school-outline',
    University: 'school-outline',
    Library: 'library-outline',

    // Transportation
    'Bus Terminal': 'bus-outline',
    'Train Terminal': 'train-outline',
    'Transit Terminal': 'subway-outline',
    Airport: 'airplane-outline',
    'Subway Station': 'subway-outline',
    'Light Rail': 'train-outline',
    'Taxi Stand': 'car-outline',

    // Shopping
    Mall: 'cart-outline',
    Supermarket: 'cart-outline',
    'Convenience Store': 'storefront-outline',
    'Department Store': 'business-outline',
    Store: 'storefront-outline',
    'Clothing Store': 'shirt-outline',
    'Electronics Store': 'phone-portrait-outline',
    'Book Store': 'book-outline',
    'Shoe Store': 'footsteps-outline',
    'Furniture Store': 'bed-outline',
    'Home Goods': 'home-outline',
    'Hardware Store': 'hammer-outline',
    'Pet Store': 'paw-outline',
    Laundry: 'water-outline',

    // Food & Dining
    Restaurant: 'restaurant-outline',
    Cafe: 'cafe-outline',
    Bakery: 'pizza-outline',
    'Fast Food': 'fast-food-outline',
    'Food Delivery': 'bicycle-outline',
    Food: 'fast-food-outline',
    Bar: 'beer-outline',

    // Lodging
    Hotel: 'bed-outline',
    Motel: 'bed-outline',
    Inn: 'home-outline',
    'Guest House': 'home-outline',
    Hostel: 'people-outline',
    Campground: 'bonfire-outline',
    'RV Park': 'car-outline',

    // Health & Wellness
    Hospital: 'medical-outline',
    Pharmacy: 'medkit-outline',
    Doctor: 'medical-outline',
    Dentist: 'medkit-outline',
    Physiotherapist: 'fitness-outline',
    Veterinary: 'paw-outline',
    Gym: 'fitness-outline',
    Spa: 'flower-outline',
    Health: 'fitness-outline',

    // Finance
    Bank: 'card-outline',
    ATM: 'cash-outline',
    Accounting: 'calculator-outline',
    Insurance: 'shield-outline',

    // Services
    'Post Office': 'mail-outline',
    'Police Station': 'shield-checkmark-outline',
    'Fire Station': 'flame-outline',
    'Government Office': 'business-outline',
    Courthouse: 'hammer-outline',
    Embassy: 'flag-outline',

    // Entertainment & Recreation
    Cinema: 'film-outline',
    Bowling: 'baseball-outline',
    'Amusement Park': 'happy-outline',
    Aquarium: 'fish-outline',
    'Art Gallery': 'color-palette-outline',
    Museum: 'globe-outline',
    'Night Club': 'musical-notes-outline',
    Park: 'leaf-outline',
    Stadium: 'trophy-outline',
    Zoo: 'paw-outline',
    'Tourist Spot': 'camera-outline',

    // Technology & Work
    'Internet Cafe': 'wifi-outline',
    'Computer Store': 'laptop-outline',

    // Worship
    Church: 'heart-outline',
    Mosque: 'moon-outline',
    Temple: 'home-outline',
    'Hindu Temple': 'flame-outline',
    Synagogue: 'star-outline',
    'Place of Worship': 'heart-outline',

    // Utilities
    'Gas Station': 'car-outline',
    'Car Wash': 'water-outline',
    'Car Rental': 'car-sport-outline',
    'Car Repair': 'construct-outline',
    Parking: 'square-outline',

    // Printing & Stationery
    'Print Shop': 'print-outline',
    Stationery: 'create-outline',

    // Other
    Landmark: 'star-outline',
    Place: 'location-outline',
    'Beauty Salon': 'cut-outline',
    'Hair Salon': 'cut-outline',
    Locksmith: 'key-outline',
    'Moving Company': 'car-outline',
    Painter: 'brush-outline',
    Plumber: 'water-outline',
    Electrician: 'flash-outline',
    Roofing: 'home-outline',
    Storage: 'cube-outline',
  };

  return iconMap[type] || 'location-outline';
}
