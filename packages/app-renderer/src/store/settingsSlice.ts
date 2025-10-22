import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Provider = 'anthropic' | 'openai' | 'auto' | 'mock';

type SettingsState = {
  provider: Provider;
  model: string;
  autopilot: boolean; // UI toggle
};

const initialState: SettingsState = {
  provider: 'auto',
  model: 'claude-sonnet-4',
  autopilot: false
};

const slice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setProvider(state, action: PayloadAction<Provider>) { state.provider = action.payload; },
    setModel(state, action: PayloadAction<string>) { state.model = action.payload; },
    setAutopilot(state, action: PayloadAction<boolean>) { state.autopilot = action.payload; }
  }
});

export const { setProvider, setModel, setAutopilot } = slice.actions;
export default slice.reducer;