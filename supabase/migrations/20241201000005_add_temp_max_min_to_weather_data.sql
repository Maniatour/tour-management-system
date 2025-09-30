-- Add temp_max and temp_min columns to weather_data table
ALTER TABLE public.weather_data 
ADD COLUMN IF NOT EXISTS temp_max DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS temp_min DOUBLE PRECISION;

-- Add comments to explain the new columns
COMMENT ON COLUMN public.weather_data.temp_max IS 'Maximum temperature for the day in Celsius';
COMMENT ON COLUMN public.weather_data.temp_min IS 'Minimum temperature for the day in Celsius';
