import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Msg = { role: 'user' | 'assistant'; content: string };

type ChatState = { messages: Msg[]; busy: boolean; error?: string };
const initial: ChatState = { messages: [], busy: false };

const slice = createSlice({
  name: 'chat',
  initialState: initial,
  reducers: {
    push(state, action: PayloadAction<Msg>) { state.messages.push(action.payload); },
    setBusy(state, action: PayloadAction<boolean>) { state.busy = action.payload; },
    setError(state, action: PayloadAction<string | undefined>) { state.error = action.payload; },
    clear(state) { state.messages = []; state.error = undefined; }
  }
});

export const { push, setBusy, setError, clear } = slice.actions;
export default slice.reducer;