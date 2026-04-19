
class TaskQueue {
  constructor() {
    // clientId -> array of task objects, sorted by priority desc
    this.clientQueues = new Map();
    // clientId -> accumulated virtual time (fairness counter)
    this.virtualTime = new Map();
  }

  enqueue(task) {
    const { client_api_key: clientId } = task;

    if (!this.clientQueues.has(clientId)) {
      this.clientQueues.set(clientId, []);
      // New clients start at current minimum virtual time so they aren't
      // immediately disadvantaged vs existing clients.
      const minVt = this._minVirtualTime();
      this.virtualTime.set(clientId, minVt);
    }

    const queue = this.clientQueues.get(clientId);
    queue.push(task);
    // Keep each client's queue sorted by priority descending
    queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Dequeue the next task using Weighted Fair Queuing.
   * Returns null if nothing is queued.
   */
  dequeue() {
    const activeClients = [];
   
    for (const [clientId, queue] of this.clientQueues.entries()) {
      if (queue.length > 0) {
        activeClients.push(clientId);
      }
    }
   

    if (activeClients.length === 0) return null;

    // Pick the client with the lowest virtual time (least served so far)
    activeClients.sort(
      (a, b) => this.virtualTime.get(a) - this.virtualTime.get(b)
    );

    const chosenClient = activeClients[0];
    const queue = this.clientQueues.get(chosenClient);
    const task = queue.shift();
    const weight = 6 - task.priority; // priority 5 -> weight 1, priority 1 -> weight 5
    this.virtualTime.set(
      chosenClient,
      this.virtualTime.get(chosenClient) + weight
    );

    // Cleanup empty queues
    if (queue.length === 0) {
      this.clientQueues.delete(chosenClient);
    }

    return task;
  }

  remove(taskId) {
    for (const [clientId, queue] of this.clientQueues.entries()) {
      const idx = queue.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        if (queue.length === 0) this.clientQueues.delete(clientId);
        return true;
      }
    }
    return false;
  }

  size() {
    let total = 0;
    for (const q of this.clientQueues.values()) total += q.length;
    return total;
  }

  _minVirtualTime() {
    if (this.virtualTime.size === 0) return 0;
    return Math.min(...this.virtualTime.values());
  }
}

export const taskQueue = new TaskQueue();