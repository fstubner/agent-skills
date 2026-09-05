# Job worker

Workers claim a job, tell the billing partner it finished, and mark it done.

We run four workers in production. Retries are handled by the process manager:
if `runOnce` throws, the worker restarts and picks up work again.
