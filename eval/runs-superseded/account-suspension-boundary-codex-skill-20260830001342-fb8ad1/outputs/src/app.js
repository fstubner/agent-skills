import { getAccount, suspend } from './controllers/accounts.js';

export function createApp({ accounts, auditEvents }) {
  return {
    async request(method, pathname) {
      const match = pathname.match(/^\/accounts\/([^/]+)$/);
      if (method === 'GET' && match) {
        const account = getAccount(accounts, match[1]);
        return { status: account ? 200 : 404, body: account };
      }
      const suspendMatch = pathname.match(/^\/accounts\/([^/]+)\/suspend$/);
      if (method === 'POST' && suspendMatch) {
        const account = suspend(accounts, auditEvents, suspendMatch[1]);
        return { status: account ? 200 : 404, body: account };
      }
      return { status: 404, body: null };
    },
    stores: { accounts, auditEvents }
  };
}
