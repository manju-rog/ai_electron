import { configureStore } from '@reduxjs/toolkit';
import settings from './settingsSlice';
import chat from './chatSlice';

export const store = configureStore({ reducer: { settings, chat } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;