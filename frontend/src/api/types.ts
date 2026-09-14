/**
 * Backend contract. `src/api/schema.d.ts` is generated from /openapi.json by `npm run api:types`
 * (the backend owns the contract); everything here is a named view onto it.
 */
import type { components, paths } from './schema';

export type { paths };
type Schemas = components['schemas'];

export type BodyPart = Schemas['BodyPart'];
export type Technique = Schemas['Technique'];
export type ShotType = Schemas['ShotType'];
export type PlayPattern = Schemas['PlayPattern'];
export type PreferredFoot = Schemas['PreferredFoot'];

export const BODY_PARTS = [
  'Right Foot',
  'Left Foot',
  'Head',
  'Other',
] as const satisfies readonly BodyPart[];
export const TECHNIQUES = [
  'Normal',
  'Volley',
  'Half Volley',
  'Lob',
  'Backheel',
  'Overhead Kick',
  'Diving Header',
] as const satisfies readonly Technique[];
export const SHOT_TYPES = [
  'Open Play',
  'Free Kick',
  'Corner',
  'Penalty',
] as const satisfies readonly ShotType[];
export const PLAY_PATTERNS = [
  'Regular Play',
  'From Corner',
  'From Free Kick',
  'From Throw In',
  'From Counter',
  'Other',
] as const satisfies readonly PlayPattern[];
export const PREFERRED_FEET = [
  'Right',
  'Left',
  'Unknown',
] as const satisfies readonly PreferredFoot[];

export type Point = Schemas['PointIn'];
export type PredictRequest = Schemas['PredictRequest'];
export type PredictResponse = Schemas['PredictResponse'];
export type Geometry = Schemas['Geometry'];
export type GeometryPlayer = Schemas['PlayerGeometry'];
export type ExplanationItem = Schemas['ExplanationItem'];
export type HealthResponse = Schemas['Health'];

export type Competition = Schemas['CompetitionOut'];
export type Match = Schemas['MatchOut'];
export type ShotSummary = Schemas['ShotSummary'];
export type ShotMeta = Schemas['ShotMeta'];
export type ShotDetail = Schemas['ShotDetail'];
export type SearchResponse = Schemas['SearchResponse'];
export type SearchParams = NonNullable<
  paths['/library/shots/search']['get']['parameters']['query']
>;
