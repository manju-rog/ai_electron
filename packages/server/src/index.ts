import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '4455', 10);
const app = createApp();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[KiroClone] server listening at http://127.0.0.1:${PORT}`);
});