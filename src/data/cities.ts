// City database for birth chart location lookup
export interface CityEntry {
  name: string; country: string; lat: number; lng: number; tz: string; altNames?: string[]; popular?: boolean
}
export const CITIES: CityEntry[] = [
  // India — Popular
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, tz: '+05:30', altNames: ['Bombay'], popular: true },
  { name: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209, tz: '+05:30', altNames: ['New Delhi'], popular: true },
  { name: 'Bangalore', country: 'India', lat: 12.9716, lng: 77.5946, tz: '+05:30', altNames: ['Bengaluru'], popular: true },
  { name: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707, tz: '+05:30', altNames: ['Madras'], popular: true },
  { name: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639, tz: '+05:30', altNames: ['Calcutta'], popular: true },
  { name: 'Hyderabad', country: 'India', lat: 17.385, lng: 78.4867, tz: '+05:30', popular: true },
  { name: 'Pune', country: 'India', lat: 18.5204, lng: 73.8567, tz: '+05:30', popular: true },
  { name: 'Ahmedabad', country: 'India', lat: 23.0225, lng: 72.5714, tz: '+05:30', popular: true },
  // India — Major
  { name: 'Jaipur', country: 'India', lat: 26.9124, lng: 75.7873, tz: '+05:30' },
  { name: 'Lucknow', country: 'India', lat: 26.8467, lng: 80.9462, tz: '+05:30' },
  { name: 'Surat', country: 'India', lat: 21.1702, lng: 72.8311, tz: '+05:30' },
  { name: 'Kanpur', country: 'India', lat: 26.4499, lng: 80.3319, tz: '+05:30' },
  { name: 'Nagpur', country: 'India', lat: 21.1458, lng: 79.0882, tz: '+05:30' },
  { name: 'Indore', country: 'India', lat: 22.7196, lng: 75.8577, tz: '+05:30' },
  { name: 'Bhopal', country: 'India', lat: 23.2599, lng: 77.4126, tz: '+05:30' },
  { name: 'Visakhapatnam', country: 'India', lat: 17.6868, lng: 83.2185, tz: '+05:30', altNames: ['Vizag'] },
  { name: 'Patna', country: 'India', lat: 25.6093, lng: 85.1376, tz: '+05:30' },
  { name: 'Vadodara', country: 'India', lat: 22.3072, lng: 73.1812, tz: '+05:30', altNames: ['Baroda'] },
  { name: 'Agra', country: 'India', lat: 27.1767, lng: 78.0081, tz: '+05:30' },
  { name: 'Varanasi', country: 'India', lat: 25.3176, lng: 83.0068, tz: '+05:30', altNames: ['Benares', 'Kashi'] },
  { name: 'Amritsar', country: 'India', lat: 31.634, lng: 74.8723, tz: '+05:30' },
  { name: 'Allahabad', country: 'India', lat: 25.4358, lng: 81.8463, tz: '+05:30', altNames: ['Prayagraj'] },
  { name: 'Coimbatore', country: 'India', lat: 11.0168, lng: 76.9558, tz: '+05:30' },
  { name: 'Vijayawada', country: 'India', lat: 16.5062, lng: 80.648, tz: '+05:30' },
  { name: 'Jodhpur', country: 'India', lat: 26.2389, lng: 73.0243, tz: '+05:30' },
  { name: 'Madurai', country: 'India', lat: 9.9252, lng: 78.1198, tz: '+05:30' },
  { name: 'Guwahati', country: 'India', lat: 26.1445, lng: 91.7362, tz: '+05:30' },
  { name: 'Chandigarh', country: 'India', lat: 30.7333, lng: 76.7794, tz: '+05:30' },
  { name: 'Thiruvananthapuram', country: 'India', lat: 8.5241, lng: 76.9366, tz: '+05:30', altNames: ['Trivandrum'] },
  { name: 'Bhubaneswar', country: 'India', lat: 20.2961, lng: 85.8245, tz: '+05:30' },
  { name: 'Dehradun', country: 'India', lat: 30.3165, lng: 78.0322, tz: '+05:30' },
  { name: 'Ujjain', country: 'India', lat: 23.1793, lng: 75.7684, tz: '+05:30' },
  { name: 'Rishikesh', country: 'India', lat: 30.0869, lng: 78.2676, tz: '+05:30' },
  { name: 'Haridwar', country: 'India', lat: 29.9457, lng: 78.1642, tz: '+05:30' },
  { name: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, tz: '+05:30', altNames: ['Cochin'] },
  { name: 'Goa', country: 'India', lat: 15.2993, lng: 74.124, tz: '+05:30', altNames: ['Panaji'] },
  { name: 'Shimla', country: 'India', lat: 31.1048, lng: 77.1734, tz: '+05:30' },
  { name: 'Noida', country: 'India', lat: 28.5355, lng: 77.391, tz: '+05:30' },
  { name: 'Gurgaon', country: 'India', lat: 28.4595, lng: 77.0266, tz: '+05:30', altNames: ['Gurugram'] },
  { name: 'Srinagar', country: 'India', lat: 34.0837, lng: 74.7973, tz: '+05:30' },
  { name: 'Raipur', country: 'India', lat: 21.2514, lng: 81.6296, tz: '+05:30' },
  { name: 'Darjeeling', country: 'India', lat: 27.036, lng: 88.2627, tz: '+05:30' },
  // Nepal
  { name: 'Kathmandu', country: 'Nepal', lat: 27.7172, lng: 85.324, tz: '+05:45', popular: true },
  { name: 'Pokhara', country: 'Nepal', lat: 28.2096, lng: 83.9856, tz: '+05:45' },
  // Sri Lanka
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.9271, lng: 79.8612, tz: '+05:30' },
  // Bangladesh
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, tz: '+06:00' },
  // Pakistan
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011, tz: '+05:00' },
  { name: 'Lahore', country: 'Pakistan', lat: 31.5204, lng: 74.3587, tz: '+05:00' },
  // USA
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006, tz: '-05:00', popular: true },
  { name: 'Los Angeles', country: 'USA', lat: 34.0522, lng: -118.2437, tz: '-08:00' },
  { name: 'Chicago', country: 'USA', lat: 41.8781, lng: -87.6298, tz: '-06:00' },
  { name: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194, tz: '-08:00' },
  { name: 'Houston', country: 'USA', lat: 29.7604, lng: -95.3698, tz: '-06:00' },
  { name: 'Washington DC', country: 'USA', lat: 38.9072, lng: -77.0369, tz: '-05:00' },
  { name: 'Seattle', country: 'USA', lat: 47.6062, lng: -122.3321, tz: '-08:00' },
  { name: 'Boston', country: 'USA', lat: 42.3601, lng: -71.0589, tz: '-05:00' },
  { name: 'Miami', country: 'USA', lat: 25.7617, lng: -80.1918, tz: '-05:00' },
  { name: 'Atlanta', country: 'USA', lat: 33.749, lng: -84.388, tz: '-05:00' },
  { name: 'Dallas', country: 'USA', lat: 32.7767, lng: -96.797, tz: '-06:00' },
  { name: 'Denver', country: 'USA', lat: 39.7392, lng: -104.9903, tz: '-07:00' },
  { name: 'Edison', country: 'USA', lat: 40.5187, lng: -74.4121, tz: '-05:00' },
  // Canada
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, tz: '-05:00', popular: true },
  { name: 'Vancouver', country: 'Canada', lat: 49.2827, lng: -123.1207, tz: '-08:00' },
  { name: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673, tz: '-05:00' },
  { name: 'Brampton', country: 'Canada', lat: 43.7315, lng: -79.8618, tz: '-05:00' },
  // UK
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, tz: '+00:00', popular: true },
  { name: 'Manchester', country: 'UK', lat: 53.4808, lng: -2.2426, tz: '+00:00' },
  { name: 'Birmingham', country: 'UK', lat: 52.4862, lng: -1.8904, tz: '+00:00' },
  { name: 'Leicester', country: 'UK', lat: 52.6369, lng: -1.1398, tz: '+00:00' },
  { name: 'Edinburgh', country: 'UK', lat: 55.9533, lng: -3.1883, tz: '+00:00' },
  { name: 'Glasgow', country: 'UK', lat: 55.8642, lng: -4.2518, tz: '+00:00' },
  // Australia
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, tz: '+10:00', popular: true },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631, tz: '+10:00' },
  { name: 'Brisbane', country: 'Australia', lat: -27.4698, lng: 153.0251, tz: '+10:00' },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lng: 115.8605, tz: '+08:00' },
  // Middle East
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, tz: '+04:00', popular: true },
  { name: 'Abu Dhabi', country: 'UAE', lat: 24.4539, lng: 54.3773, tz: '+04:00' },
  { name: 'Doha', country: 'Qatar', lat: 25.2854, lng: 51.531, tz: '+03:00' },
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, tz: '+03:00' },
  { name: 'Jeddah', country: 'Saudi Arabia', lat: 21.4858, lng: 39.1925, tz: '+03:00' },
  { name: 'Muscat', country: 'Oman', lat: 23.588, lng: 58.3829, tz: '+04:00' },
  { name: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lng: 47.9774, tz: '+03:00' },
  // Southeast Asia
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, tz: '+08:00', popular: true },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869, tz: '+08:00' },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018, tz: '+07:00' },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, tz: '+07:00' },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842, tz: '+08:00' },
  // East Asia
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, tz: '+09:00', popular: true },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978, tz: '+09:00' },
  { name: 'Beijing', country: 'China', lat: 39.9042, lng: 116.4074, tz: '+08:00' },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737, tz: '+08:00' },
  { name: 'Hong Kong', country: 'China', lat: 22.3193, lng: 114.1694, tz: '+08:00' },
  { name: 'Taipei', country: 'Taiwan', lat: 25.033, lng: 121.5654, tz: '+08:00' },
  // Europe
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tz: '+01:00', popular: true },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, tz: '+01:00', popular: true },
  { name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.582, tz: '+01:00' },
  { name: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821, tz: '+01:00' },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, tz: '+01:00' },
  { name: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, tz: '+01:00' },
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738, tz: '+01:00' },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038, tz: '+01:00' },
  { name: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686, tz: '+01:00' },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964, tz: '+01:00' },
  { name: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.19, tz: '+01:00' },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393, tz: '+00:00' },
  { name: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686, tz: '+01:00' },
  { name: 'Dublin', country: 'Ireland', lat: 53.3498, lng: -6.2603, tz: '+00:00' },
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784, tz: '+03:00' },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173, tz: '+03:00' },
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lng: 21.0122, tz: '+01:00' },
  { name: 'Prague', country: 'Czech Republic', lat: 50.0755, lng: 14.4378, tz: '+01:00' },
  { name: 'Athens', country: 'Greece', lat: 37.9838, lng: 23.7275, tz: '+02:00' },
  // Africa
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473, tz: '+02:00' },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241, tz: '+02:00' },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219, tz: '+03:00' },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, tz: '+01:00' },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, tz: '+02:00' },
  { name: 'Casablanca', country: 'Morocco', lat: 33.5731, lng: -7.5898, tz: '+01:00' },
  { name: 'Accra', country: 'Ghana', lat: 5.6037, lng: -0.187, tz: '+00:00' },
  { name: 'Addis Ababa', country: 'Ethiopia', lat: 9.02, lng: 38.7469, tz: '+03:00' },
  // South America
  { name: 'Sao Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333, tz: '-03:00', altNames: ['São Paulo'] },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816, tz: '-03:00' },
  { name: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428, tz: '-05:00' },
  { name: 'Bogota', country: 'Colombia', lat: 4.711, lng: -74.0721, tz: '-05:00', altNames: ['Bogotá'] },
  { name: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693, tz: '-04:00' },
  // New Zealand
  { name: 'Auckland', country: 'New Zealand', lat: -36.8485, lng: 174.7633, tz: '+12:00' },
  // Mauritius
  { name: 'Port Louis', country: 'Mauritius', lat: -20.1619, lng: 57.4989, tz: '+04:00' },
]

export function searchCities(query: string, limit = 8): CityEntry[] {
  if (!query || query.trim().length < 2) return []
  const q = query.toLowerCase().trim()
  const results: { city: CityEntry; score: number }[] = []
  for (const city of CITIES) {
    let score = 0
    const nameLower = city.name.toLowerCase()
    const countryLower = city.country.toLowerCase()
    if (nameLower === q) score = 100
    else if (nameLower.startsWith(q)) score = 80
    else if (nameLower.includes(q)) score = 60
    else if (city.altNames?.some(alt => alt.toLowerCase().includes(q))) score = 50
    else if (countryLower.includes(q)) score = 40
    else continue
    if (city.popular) score += 5
    results.push({ city, score })
  }
  results.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))
  return results.slice(0, limit).map(r => r.city)
}

export function getPopularCities(): CityEntry[] {
  return CITIES.filter(c => c.popular)
}
