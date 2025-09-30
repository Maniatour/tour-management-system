-- Create sunrise/sunset data table for caching
CREATE TABLE IF NOT EXISTS sunrise_sunset_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  location_name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  date DATE NOT NULL,
  sunrise_time TIME NOT NULL,
  sunset_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(location_name, date)
);

-- Create weather data table for caching
CREATE TABLE IF NOT EXISTS weather_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  location_name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  date DATE NOT NULL,
  temperature DECIMAL(5, 2), -- Celsius
  humidity INTEGER, -- Percentage
  weather_main VARCHAR(50), -- Clear, Clouds, Rain, etc.
  weather_description VARCHAR(100),
  wind_speed DECIMAL(5, 2), -- m/s
  visibility INTEGER, -- meters
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(location_name, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sunrise_sunset_location_date ON sunrise_sunset_data(location_name, date);
CREATE INDEX IF NOT EXISTS idx_weather_location_date ON weather_data(location_name, date);

-- Add comments
COMMENT ON TABLE sunrise_sunset_data IS 'Cached sunrise/sunset data for goblin tour locations';
COMMENT ON TABLE weather_data IS 'Cached weather data for goblin tour locations';

-- Insert initial location data
INSERT INTO sunrise_sunset_data (location_name, latitude, longitude, date, sunrise_time, sunset_time)
VALUES 
  ('Grand Canyon South Rim', 36.1069, -112.1129, CURRENT_DATE, '06:00:00', '18:00:00'),
  ('Zion Canyon', 37.2982, -113.0263, CURRENT_DATE, '06:00:00', '18:00:00'),
  ('Page City', 36.9147, -111.4558, CURRENT_DATE, '06:00:00', '18:00:00')
ON CONFLICT (location_name, date) DO NOTHING;

INSERT INTO weather_data (location_name, latitude, longitude, date, temperature, humidity, weather_main, weather_description, wind_speed, visibility)
VALUES 
  ('Grand Canyon South Rim', 36.1069, -112.1129, CURRENT_DATE, 20.0, 50, 'Clear', 'clear sky', 3.0, 10000),
  ('Zion Canyon', 37.2982, -113.0263, CURRENT_DATE, 22.0, 45, 'Clear', 'clear sky', 2.5, 10000),
  ('Page City', 36.9147, -111.4558, CURRENT_DATE, 25.0, 40, 'Clear', 'clear sky', 4.0, 10000)
ON CONFLICT (location_name, date) DO NOTHING;
