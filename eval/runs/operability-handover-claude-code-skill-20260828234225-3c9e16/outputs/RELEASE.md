# Release

## Deployment

```bash
kubectl set image deploy/dispatch api=$IMAGE --record
```

This triggers a rolling update with 1 replica at a time (configured as `maxUnavailable: 1, maxSurge: 1`).

## Health Gate

Wait for all replicas to become ready before considering the deploy complete:

```bash
kubectl rollout status deploy/dispatch --timeout=5m
```

Then verify the service is responding:

```bash
curl -s http://SERVICE_IP:3000/health | jq .status
curl -s http://SERVICE_IP:3000/ready | jq .ready
```

Both must return success (200 status) before the release is live.

## Rollback

If the deploy is bad:

```bash
kubectl rollout undo deploy/dispatch
```

Verify the rollback:

```bash
kubectl rollout status deploy/dispatch --timeout=5m
curl -s http://SERVICE_IP:3000/health | jq .status
```

The previous stable image will become live within seconds.

## Flagging

No feature flags in this release.

## Schema Changes

No database schema changes in this release.
