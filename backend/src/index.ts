import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
