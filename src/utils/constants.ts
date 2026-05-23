export const CAMERA = {
  FOV_DEFAULT: 75,
  FOV_SCOPE:   20,
  NEAR:        0.1,
  FAR:         500,
  SCOPE_TRANSITION_MS: 120,   
} as const;

export const PLAYER = {
  HEIGHT:           1.7,      
  MOUSE_SENSITIVITY: 0.002,
  PITCH_LIMIT:       1.4,     
} as const;

export const BULLET = {
  SPEED:         80,          
  MAX_DISTANCE:  200,
  RADIUS:        0.06,
} as const;

export const ENVIRONMENT = {
  ROOFTOP_SIZE:   20,         
  BUILDING_COUNT: 12,
  STREET_LIGHT_COUNT: 8,
  FOG_NEAR:       30,
  FOG_FAR:        120,
} as const;

export const WAVE = {
  COUNTDOWN_SEC:  3,
  ADVANCE_DELAY_MS: 2000,     
} as const;

export const SCORE = {
  HIT_POINTS:   10,
  KILL_POINTS:  50,
  WAVE_BONUS:   200,
  MISS_PENALTY:  0,           
} as const;

export const AUDIO = {
  MASTER_VOLUME: 0.8,
  SHOT_VOLUME:   0.6,
  HIT_VOLUME:    0.9,
} as const;
