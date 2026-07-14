import { loadApiEnvironment } from './config/environment';
import { getHealthSnapshot } from './health/health';
import { apiConsoleModule } from './modules/api-console/api-console.module';

export function describeApiApplication() {
  const environment = loadApiEnvironment();

  return {
    environment,
    health: getHealthSnapshot([apiConsoleModule.name]),
    modules: [apiConsoleModule],
  };
}
