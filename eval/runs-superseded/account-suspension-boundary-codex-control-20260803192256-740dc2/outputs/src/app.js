import { accountActions, getAccount } from './controllers/accounts.js';

export function createApp({ accounts, auditEvents }) {
  return {
    async request(method, pathname) {
      const match = pathname.match(/^\/accounts\/([^/]+)$/);
      if (method === 'GET' && match) {
        const account = getAccount(accounts, match[1]);
        return { status: account ? 200 : 404, body: account };
      }

      const actionMatch = pathname.match(/^\/accounts\/([^/]+)\/([^/]+)$/);
      if (method === 'POST' && actionMatch) {
        const action = Object.prototype.hasOwnProperty.call(accountActions, actionMatch[2])
          ? accountActions[actionMatch[2]]
          : null;
        if (action) {
          const account = action(accounts, auditEvents, actionMatch[1]);
          return { status: account ? 200 : 404, body: account };
        }
      }

      return { status: 404, body: null };
    },
    stores: { accounts, auditEvents }
  };
}
