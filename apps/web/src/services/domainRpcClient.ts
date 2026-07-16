type ServiceObject = Record<string, unknown>;

const metaEnv = import.meta.env ?? {};
const DOMAIN_RPC_BASE = (metaEnv.VITE_DOMAIN_API_BASE_URL || '/api/domain').replace(/\/$/, '');
const DOMAIN_API_MODE = metaEnv.VITE_DOMAIN_API_MODE || 'backend';

function shouldUseDomainBackend(): boolean {
  return typeof window !== 'undefined' && DOMAIN_API_MODE !== 'mock';
}

async function callDomainRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${DOMAIN_RPC_BASE}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service, method, args }),
  });

  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText || 'Domain API request failed.';
    throw new Error(message);
  }

  return payload?.data as T;
}

export function createDomainRpcProxy<TService extends ServiceObject>(service: string, localService: TService): TService {
  return new Proxy(localService, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function') return value;
      const localMethod = value as (...args: unknown[]) => Promise<unknown>;

      return async (...args: unknown[]) => {
        if (!shouldUseDomainBackend()) {
          return localMethod.apply(target, args);
        }

        try {
          return await callDomainRpc(service, property, args);
        } catch (error) {
          if (DOMAIN_API_MODE === 'strict') throw error;
          return localMethod.apply(target, args);
        }
      };
    },
  });
}
