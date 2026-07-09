import { logError } from './observability';
import { fetchWards as fetchWardsShared, lookupWard as lookupWardShared, type City } from '$lib/wards';

const onError = (message: string, err: unknown) => logError('wards', message, err);

export const fetchWards = (city: City) => fetchWardsShared(city, onError);
export const lookupWard = (lat: number, lng: number) => lookupWardShared(lat, lng, onError);
