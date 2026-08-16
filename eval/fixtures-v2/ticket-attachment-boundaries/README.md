# Ticket desk

Support agents use the browser app. The Node API owns tickets in `data/tickets.sqlite`. The browser sends ticket JSON and image attachments to the API over HTTPS. The API stores attachments under `data/uploads` and reads `SESSION_SECRET` from its environment.
