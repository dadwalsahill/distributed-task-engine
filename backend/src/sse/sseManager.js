// Manages Server-Sent Event connections and broadcasts task updates
const clients = new Map(); // clientId -> res

export const sseManager = {
  add(id, res) {
    clients.set(id, res);
  },

  remove(id) {
    clients.delete(id);
  },

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients.values()) {
      try {
        res.write(payload);
      } catch (_) {
        // client disconnected mid-write, ignore
      }
    }
  },

  count() {
    return clients.size;
  },
};