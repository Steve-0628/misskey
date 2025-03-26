import * as misskey from 'misskey-js';
import { Cache } from '@/scripts/cache';

export const rolesCache = new Cache(Infinity);
export const userListsCache = new Cache<misskey.entities.UserList[]>(Infinity);
export const antennasCache = new Cache<misskey.entities.Antenna[]>(Infinity);
