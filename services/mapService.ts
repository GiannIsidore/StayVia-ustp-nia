export interface Landmark {
  name: string;
  type: string;
  allTypes: string[];
  distance: number;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
  priceLevel?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  wheelchair?: string;
  description?: string;
}

export interface NearbyPlacesParams {
  latitude: number;
  longitude: number;
  radius?: number;
}

//
// 🏷️ Determine the primary type from OSM tags with priority order
//
function determinePrimaryType(tags: any): string {
  // Priority order: Most specific to least specific

  // 1. Education (highest priority for students)
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'university') return 'university';
  if (tags.amenity === 'college') return 'college';
  if (tags.amenity === 'kindergarten') return 'kindergarten';
  if (tags.amenity === 'library') return 'library';

  // 2. Healthcare
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'clinic') return 'clinic';
  if (tags.amenity === 'doctors') return 'doctors';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.amenity === 'dentist') return 'dentist';
  if (tags.amenity === 'veterinary') return 'veterinary';

  // 3. Transportation
  if (tags.amenity === 'bus_station') return 'bus_station';
  if (tags.public_transport === 'station') return 'transit_station';
  if (tags.public_transport === 'stop_position') return 'bus_stop';
  if (tags.amenity === 'taxi') return 'taxi_stand';
  if (tags.amenity === 'ferry_terminal') return 'ferry_terminal';

  // 4. Food & Dining
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'fast_food') return 'fast_food';
  if (tags.amenity === 'bar') return 'bar';
  if (tags.amenity === 'pub') return 'pub';
  if (tags.amenity === 'food_court') return 'food_court';
  if (tags.amenity === 'ice_cream') return 'ice_cream';

  // 5. Shopping
  if (tags.shop === 'supermarket') return 'shop_supermarket';
  if (tags.shop === 'convenience') return 'shop_convenience';
  if (tags.shop === 'mall') return 'shop_mall';
  if (tags.shop === 'department_store') return 'shop_department_store';
  if (tags.shop === 'bakery') return 'shop_bakery';
  if (tags.shop === 'clothes') return 'shop_clothes';
  if (tags.shop === 'electronics') return 'shop_electronics';
  if (tags.shop === 'books') return 'shop_books';
  if (tags.shop === 'hardware') return 'shop_hardware';
  if (tags.shop === 'furniture') return 'shop_furniture';
  if (tags.shop) return `shop_${tags.shop}`;

  // 6. Finance
  if (tags.amenity === 'bank') return 'bank';
  if (tags.amenity === 'atm') return 'atm';

  // 7. Leisure & Sports
  if (tags.leisure === 'park') return 'leisure_park';
  if (tags.leisure === 'playground') return 'leisure_playground';
  if (tags.leisure === 'sports_centre') return 'leisure_sports_centre';
  if (tags.leisure === 'stadium') return 'leisure_stadium';
  if (tags.leisure === 'swimming_pool') return 'leisure_swimming_pool';
  if (tags.leisure === 'fitness_centre') return 'leisure_fitness_centre';
  if (tags.leisure === 'pitch') return 'leisure_pitch';
  if (tags.leisure === 'garden') return 'leisure_garden';
  if (tags.leisure) return `leisure_${tags.leisure}`;

  // 8. Tourism
  if (tags.tourism === 'hotel') return 'tourism_hotel';
  if (tags.tourism === 'hostel') return 'tourism_hostel';
  if (tags.tourism === 'museum') return 'tourism_museum';
  if (tags.tourism === 'attraction') return 'tourism_attraction';
  if (tags.tourism === 'viewpoint') return 'tourism_viewpoint';
  if (tags.tourism === 'artwork') return 'tourism_artwork';
  if (tags.tourism === 'gallery') return 'tourism_gallery';
  if (tags.tourism) return `tourism_${tags.tourism}`;

  // 9. Worship
  if (tags.amenity === 'place_of_worship') {
    const religion = tags.religion || 'unknown';
    return `worship_${religion}`;
  }

  // 10. Public Services
  if (tags.amenity === 'police') return 'police';
  if (tags.amenity === 'fire_station') return 'fire_station';
  if (tags.amenity === 'post_office') return 'post_office';
  if (tags.amenity === 'townhall') return 'townhall';
  if (tags.amenity === 'courthouse') return 'courthouse';
  if (tags.amenity === 'community_centre') return 'community_centre';

  // 11. Entertainment
  if (tags.amenity === 'cinema') return 'cinema';
  if (tags.amenity === 'theatre') return 'theatre';
  if (tags.amenity === 'arts_centre') return 'arts_centre';
  if (tags.amenity === 'nightclub') return 'nightclub';

  // 12. Parking
  if (tags.amenity === 'parking') return 'parking';
  if (tags.amenity === 'bicycle_parking') return 'bicycle_parking';

  // 13. Offices
  if (tags.office === 'government') return 'office_government';
  if (tags.office === 'insurance') return 'office_insurance';
  if (tags.office === 'estate_agent') return 'office_estate_agent';
  if (tags.office) return `office_${tags.office}`;

  // 14. Historic
  if (tags.historic === 'monument') return 'historic_monument';
  if (tags.historic === 'memorial') return 'historic_memorial';
  if (tags.historic === 'castle') return 'historic_castle';
  if (tags.historic) return `historic_${tags.historic}`;

  // 15. Default fallback
  return tags.amenity || tags.shop || tags.leisure || tags.tourism || 'place';
}

//
// 📌 Haversine distance - High precision calculation
//
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Return high precision distance (3 decimal places for accuracy)
  return Math.round(R * c * 1000) / 1000;
}

//
// 🛰️ Main OSM fetcher
//
export async function fetchNearbyLandmarks(params: NearbyPlacesParams): Promise<Landmark[]> {
  const { latitude, longitude, radius = 1500 } = params;

  // Validate coordinates
  if (
    !latitude ||
    !longitude ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    console.error('[MapService] Invalid coordinates provided');
    return [];
  }

  try {
    console.log(`[MapService] Fetching places within ${radius}m of (${latitude}, ${longitude})`);

    // ❗ Avoid large bounding boxes (Overpass rate-limits these)
    const searchRadius = Math.min(Math.max(radius, 100), 3000); // Min 100m, Max 3000m

    // Use the actual requested radius for bounding box to minimize over-fetching
    // We'll filter precisely by distance in post-processing
    const bboxRadius = radius; // Use exact radius instead of searchRadius for tighter bounds

    const latDelta = bboxRadius / 111320;
    const lonDelta = bboxRadius / (111320 * Math.cos((latitude * Math.PI) / 180));

    const bbox = [
      latitude - latDelta,
      longitude - lonDelta,
      latitude + latDelta,
      longitude + lonDelta,
    ].join(',');

    console.log(`[MapService] Bounding box: ${bbox} (radius: ${bboxRadius}m)`);

    // 🧠 Comprehensive Overpass query for all relevant place types
    const overpassQuery = `
      [out:json][timeout:30];
      (
        // AMENITIES - Core services and facilities
        node["amenity"](${bbox});
        way["amenity"](${bbox});
        relation["amenity"](${bbox});

        // SHOPS - All retail and commercial
        node["shop"](${bbox});
        way["shop"](${bbox});

        // LEISURE - Parks, sports, entertainment
        node["leisure"](${bbox});
        way["leisure"](${bbox});
        relation["leisure"](${bbox});

        // TOURISM - Tourist attractions, hotels, etc.
        node["tourism"](${bbox});
        way["tourism"](${bbox});

        // EDUCATION - Schools, universities, libraries
        node["amenity"~"^(school|university|college|kindergarten|library)$"](${bbox});
        way["amenity"~"^(school|university|college|kindergarten|library)$"](${bbox});

        // HEALTHCARE - Hospitals, clinics, pharmacies
        node["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist|veterinary)$"](${bbox});
        way["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist|veterinary)$"](${bbox});

        // TRANSPORTATION - Bus stops, terminals, parking
        node["amenity"~"^(bus_station|taxi|parking|bicycle_parking|ferry_terminal)$"](${bbox});
        node["public_transport"](${bbox});
        way["public_transport"](${bbox});

        // FINANCE - Banks, ATMs
        node["amenity"~"^(bank|atm)$"](${bbox});
        way["amenity"~"^(bank|atm)$"](${bbox});

        // FOOD & DRINK - Restaurants, cafes, fast food
        node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream)$"](${bbox});
        way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream)$"](${bbox});

        // WORSHIP - Churches, mosques, temples
        node["amenity"~"^(place_of_worship)$"](${bbox});
        way["amenity"~"^(place_of_worship)$"](${bbox});

        // PUBLIC SERVICES - Police, fire, post office, government
        node["amenity"~"^(police|fire_station|post_office|townhall|courthouse)$"](${bbox});
        way["amenity"~"^(police|fire_station|post_office|townhall|courthouse)$"](${bbox});

        // OFFICES - Important business offices
        node["office"~"^(government|insurance|estate_agent|employment_agency)$"](${bbox});
        way["office"~"^(government|insurance|estate_agent|employment_agency)$"](${bbox});

        // HISTORIC & CULTURAL - Museums, monuments, art
        node["historic"](${bbox});
        node["amenity"~"^(arts_centre|community_centre|theatre)$"](${bbox});
        way["amenity"~"^(arts_centre|community_centre|theatre)$"](${bbox});
      );
      out center tags;
    `;

    // Use primary Overpass API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          console.warn('[MapService] Rate limited by Overpass API');
          throw new Error('Rate limited. Please try again in a moment.');
        }
        throw new Error(`Overpass error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.elements?.length) {
        console.log('[MapService] No places found in this area');
        return [];
      }

      return processOverpassData(data, latitude, longitude, radius);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[MapService] Request timeout');
        throw new Error('Request timed out. Please try again.');
      }
      throw fetchError;
    }
  } catch (err: any) {
    console.error('[MapService] Error fetching landmarks:', err.message || err);
    return [];
  }
}

//
// 🔄 Process Overpass API data
//
function processOverpassData(
  data: any,
  latitude: number,
  longitude: number,
  radius: number
): Landmark[] {
  try {
    const radiusKm = radius / 1000;
    // Add a small buffer (2%) to account for rounding, but still filter strictly
    const maxDistanceKm = radiusKm * 0.98; // 98% of radius to ensure strict filtering
    const seenNames = new Set<string>(); // Track duplicates
    const results: Landmark[] = [];

    console.log(
      `[MapService] Processing data with strict radius: ${radiusKm}km (max: ${maxDistanceKm}km)`
    );

    for (const el of data.elements) {
      try {
        // Extract coordinates
        const coords =
          el.lat && el.lon
            ? { lat: el.lat, lon: el.lon }
            : el.center
              ? { lat: el.center.lat, lon: el.center.lon }
              : null;

        if (!coords || !coords.lat || !coords.lon) continue;

        // Calculate distance with high precision
        const dist = calculateDistance(latitude, longitude, coords.lat, coords.lon);

        // Strict filtering: only include landmarks within 98% of the radius
        // This accounts for any rounding errors and ensures visual accuracy
        if (dist > maxDistanceKm) {
          console.log(
            `[MapService] Filtered out: ${el.tags?.name || 'Unnamed'} at ${dist}km (exceeds ${maxDistanceKm}km)`
          );
          continue;
        }

        const tags = el.tags || {};

        // Skip if no useful tags
        if (
          !tags.amenity &&
          !tags.shop &&
          !tags.leisure &&
          !tags.tourism &&
          !tags.office &&
          !tags.historic
        ) {
          continue;
        }

        // Extract name with multiple fallbacks
        const name =
          tags.name ||
          tags['name:en'] ||
          tags['name:local'] ||
          tags.brand ||
          tags.operator ||
          `Unnamed ${tags.amenity || tags.shop || tags.leisure || tags.tourism || 'Place'}`;

        // Skip duplicates (common in OSM data)
        const locationKey = `${name}-${Math.round(coords.lat * 1000)}-${Math.round(coords.lon * 1000)}`;
        if (seenNames.has(locationKey)) continue;
        seenNames.add(locationKey);

        // Determine primary type with priority order
        const primaryType = determinePrimaryType(tags);
        const formattedType = formatPlaceType(primaryType);

        // Build comprehensive address
        const addressParts = [
          tags['addr:housenumber'],
          tags['addr:street'],
          tags['addr:barangay'],
          tags['addr:city'] || tags['addr:municipality'],
          tags['addr:province'],
          tags['addr:postcode'],
        ].filter(Boolean);

        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '';

        // Extract additional useful information
        const phone = tags.phone || tags['contact:phone'] || '';
        const website = tags.website || tags['contact:website'] || '';
        const openingHours = tags.opening_hours || '';
        const wheelchair = tags.wheelchair || '';

        results.push({
          name,
          type: formattedType,
          allTypes: [
            tags.amenity,
            tags.shop,
            tags.leisure,
            tags.tourism,
            tags.office,
            tags.historic,
            tags.public_transport,
          ].filter(Boolean),
          distance: dist,
          address: fullAddress,
          latitude: coords.lat,
          longitude: coords.lon,
          // Additional metadata
          phone,
          website,
          openingHours,
          wheelchair,
          description: tags.description || '',
        });
      } catch (elementError) {
        // Skip problematic elements but continue processing others
        console.warn('[MapService] Error processing element:', elementError);
        continue;
      }
    }

    // Sort by distance (closest first)
    const sortedResults = results.sort((a, b) => a.distance - b.distance);

    console.log(
      `[MapService] Successfully processed ${sortedResults.length} unique places from ${data.elements.length} elements`
    );
    return sortedResults;
  } catch (err) {
    console.error('[MapService] Error processing Overpass data:', err);
    return [];
  }
}

//
// 📍 Type formatting - Comprehensive place type mapping
//
export function formatPlaceType(type: string): string {
  const clean = type
    .replace(/^(shop_|leisure_|tourism_|office_|historic_|natural_|worship_)/, '')
    .toLowerCase();

  const map: Record<string, string> = {
    // Education
    school: 'School',
    university: 'University',
    college: 'College',
    kindergarten: 'Kindergarten',
    library: 'Library',

    // Healthcare
    hospital: 'Hospital',
    clinic: 'Clinic',
    doctors: 'Doctor',
    pharmacy: 'Pharmacy',
    dentist: 'Dentist',
    veterinary: 'Veterinary Clinic',

    // Transportation
    bus_station: 'Bus Station',
    transit_station: 'Transit Station',
    bus_stop: 'Bus Stop',
    taxi_stand: 'Taxi Stand',
    ferry_terminal: 'Ferry Terminal',
    parking: 'Parking',
    bicycle_parking: 'Bike Parking',

    // Food & Dining
    restaurant: 'Restaurant',
    cafe: 'Cafe',
    fast_food: 'Fast Food',
    bar: 'Bar',
    pub: 'Pub',
    food_court: 'Food Court',
    ice_cream: 'Ice Cream Shop',

    // Shopping
    supermarket: 'Supermarket',
    convenience: 'Convenience Store',
    mall: 'Mall',
    department_store: 'Department Store',
    bakery: 'Bakery',
    clothes: 'Clothing Store',
    electronics: 'Electronics Store',
    books: 'Bookstore',
    hardware: 'Hardware Store',
    furniture: 'Furniture Store',

    // Finance
    bank: 'Bank',
    atm: 'ATM',

    // Leisure & Sports
    park: 'Park',
    playground: 'Playground',
    sports_centre: 'Sports Centre',
    stadium: 'Stadium',
    swimming_pool: 'Swimming Pool',
    fitness_centre: 'Gym',
    pitch: 'Sports Field',
    garden: 'Garden',

    // Tourism & Accommodation
    hotel: 'Hotel',
    hostel: 'Hostel',
    museum: 'Museum',
    attraction: 'Tourist Attraction',
    viewpoint: 'Viewpoint',
    artwork: 'Artwork',
    gallery: 'Art Gallery',

    // Worship
    christian: 'Church',
    muslim: 'Mosque',
    buddhist: 'Buddhist Temple',
    hindu: 'Hindu Temple',
    jewish: 'Synagogue',
    unknown: 'Place of Worship',

    // Public Services
    police: 'Police Station',
    fire_station: 'Fire Station',
    post_office: 'Post Office',
    townhall: 'Town Hall',
    courthouse: 'Courthouse',
    community_centre: 'Community Centre',

    // Entertainment
    cinema: 'Cinema',
    theatre: 'Theatre',
    arts_centre: 'Arts Centre',
    nightclub: 'Nightclub',

    // Offices
    government: 'Government Office',
    insurance: 'Insurance Office',
    estate_agent: 'Real Estate Office',
    employment_agency: 'Employment Agency',

    // Historic
    monument: 'Monument',
    memorial: 'Memorial',
    castle: 'Castle',
    ruins: 'Historic Ruins',
  };

  return map[clean] || clean.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

//
// 🧭 Icon Mapper for Ionicons - Comprehensive icon mapping
//
export function getPlaceTypeIcon(type: string): string {
  const lower = type.toLowerCase();

  // Property/Home
  if (lower.includes('property') || lower.includes('home')) return 'home-outline';

  // Education
  if (lower.includes('school')) return 'school-outline';
  if (lower.includes('university') || lower.includes('college')) return 'school-outline';
  if (lower.includes('kindergarten')) return 'happy-outline';
  if (lower.includes('library')) return 'library-outline';

  // Healthcare
  if (lower.includes('hospital')) return 'medical-outline';
  if (lower.includes('clinic') || lower.includes('doctor')) return 'medkit-outline';
  if (lower.includes('pharmacy')) return 'medkit-outline';
  if (lower.includes('dentist')) return 'medkit-outline';
  if (lower.includes('veterinary')) return 'paw-outline';

  // Transportation
  if (lower.includes('bus') && (lower.includes('station') || lower.includes('stop')))
    return 'bus-outline';
  if (lower.includes('transit') || lower.includes('ferry')) return 'train-outline';
  if (lower.includes('taxi')) return 'car-outline';
  if (lower.includes('parking')) return 'car-outline';
  if (lower.includes('bicycle')) return 'bicycle-outline';

  // Food & Dining
  if (lower.includes('restaurant')) return 'restaurant-outline';
  if (lower.includes('cafe') || lower.includes('coffee')) return 'cafe-outline';
  if (lower.includes('fast food') || lower.includes('fast_food')) return 'fast-food-outline';
  if (lower.includes('bar') || lower.includes('pub')) return 'beer-outline';
  if (lower.includes('ice cream') || lower.includes('ice_cream')) return 'ice-cream-outline';
  if (lower.includes('food court') || lower.includes('food_court')) return 'restaurant-outline';
  if (lower.includes('bakery')) return 'storefront-outline';

  // Shopping
  if (lower.includes('supermarket') || lower.includes('mall')) return 'cart-outline';
  if (lower.includes('convenience') || lower.includes('store')) return 'storefront-outline';
  if (lower.includes('clothes') || lower.includes('clothing')) return 'shirt-outline';
  if (lower.includes('electronics')) return 'phone-portrait-outline';
  if (lower.includes('book')) return 'book-outline';
  if (lower.includes('hardware')) return 'hammer-outline';
  if (lower.includes('furniture')) return 'bed-outline';

  // Finance
  if (lower.includes('bank')) return 'business-outline';
  if (lower.includes('atm')) return 'card-outline';

  // Leisure & Sports
  if (lower.includes('park') || lower.includes('garden')) return 'leaf-outline';
  if (lower.includes('playground')) return 'happy-outline';
  if (lower.includes('sports') || lower.includes('stadium') || lower.includes('pitch'))
    return 'football-outline';
  if (lower.includes('swimming') || lower.includes('pool')) return 'water-outline';
  if (lower.includes('gym') || lower.includes('fitness')) return 'fitness-outline';

  // Tourism & Accommodation
  if (lower.includes('hotel') || lower.includes('hostel')) return 'bed-outline';
  if (lower.includes('museum')) return 'business-outline';
  if (lower.includes('attraction')) return 'star-outline';
  if (lower.includes('viewpoint')) return 'eye-outline';
  if (lower.includes('artwork') || lower.includes('gallery')) return 'color-palette-outline';

  // Worship
  if (lower.includes('church') || lower.includes('christian')) return 'add-outline';
  if (lower.includes('mosque') || lower.includes('muslim')) return 'moon-outline';
  if (lower.includes('temple') || lower.includes('buddhist') || lower.includes('hindu'))
    return 'star-half-outline';
  if (lower.includes('synagogue') || lower.includes('jewish')) return 'star-outline';
  if (lower.includes('worship')) return 'heart-outline';

  // Public Services
  if (lower.includes('police')) return 'shield-checkmark-outline';
  if (lower.includes('fire')) return 'flame-outline';
  if (lower.includes('post office') || lower.includes('post_office')) return 'mail-outline';
  if (lower.includes('townhall') || lower.includes('courthouse')) return 'business-outline';
  if (lower.includes('community')) return 'people-outline';

  // Entertainment
  if (lower.includes('cinema')) return 'film-outline';
  if (lower.includes('theatre')) return 'mic-outline';
  if (lower.includes('arts')) return 'color-palette-outline';
  if (lower.includes('nightclub')) return 'musical-notes-outline';

  // Offices
  if (lower.includes('government')) return 'business-outline';
  if (lower.includes('insurance')) return 'shield-checkmark-outline';
  if (lower.includes('estate') || lower.includes('real estate')) return 'home-outline';
  if (lower.includes('office')) return 'business-outline';

  // Historic
  if (lower.includes('monument') || lower.includes('memorial')) return 'trophy-outline';
  if (lower.includes('castle')) return 'business-outline';
  if (lower.includes('historic') || lower.includes('ruins')) return 'time-outline';

  // Default fallback
  return 'location-outline';
}
