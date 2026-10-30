// Package queue runs background jobs (Gmail syncs) on Redis, or in-process
// when REDIS_URL isn't set.
package queue

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Job struct {
	Kind   string `json:"kind"`
	UserID string `json:"userId"`
}

const (
	listKey = "kharcha:jobs"
	// A user's sync is enqueued at most once per window.
	dedupeTTL = 10 * time.Minute
)

type Queue interface {
	Enqueue(ctx context.Context, job Job) (bool, error)
	Run(ctx context.Context, workers int, handle func(context.Context, Job) error)
}

func New(redisURL string, log *slog.Logger) (Queue, error) {
	if redisURL == "" {
		log.Info("REDIS_URL not set: using in-process job queue")
		return &memQueue{ch: make(chan Job, 256), log: log, pending: map[string]time.Time{}}, nil
	}
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &redisQueue{rdb: rdb, log: log}, nil
}

func key(j Job) string { return "kharcha:job:" + j.Kind + ":" + j.UserID }

type redisQueue struct {
	rdb *redis.Client
	log *slog.Logger
}

func (q *redisQueue) Enqueue(ctx context.Context, job Job) (bool, error) {
	ok, err := q.rdb.SetNX(ctx, key(job), 1, dedupeTTL).Result()
	if err != nil || !ok {
		return false, err
	}
	b, _ := json.Marshal(job)
	return true, q.rdb.LPush(ctx, listKey, b).Err()
}

func (q *redisQueue) Run(ctx context.Context, workers int, handle func(context.Context, Job) error) {
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			for ctx.Err() == nil {
				res, err := q.rdb.BRPop(ctx, 5*time.Second, listKey).Result()
				if errors.Is(err, redis.Nil) || ctx.Err() != nil {
					continue
				}
				if err != nil {
					q.log.Error("queue pop", "err", err)
					time.Sleep(time.Second)
					continue
				}
				var job Job
				if json.Unmarshal([]byte(res[1]), &job) != nil {
					continue
				}
				if err := handle(ctx, job); err != nil {
					q.log.Error("job failed", "kind", job.Kind, "user", job.UserID, "err", err)
				}
				q.rdb.Del(context.WithoutCancel(ctx), key(job))
			}
		})
	}
	wg.Wait()
}

type memQueue struct {
	ch      chan Job
	log     *slog.Logger
	mu      sync.Mutex
	pending map[string]time.Time
}

func (q *memQueue) Enqueue(_ context.Context, job Job) (bool, error) {
	q.mu.Lock()
	if t, ok := q.pending[key(job)]; ok && time.Since(t) < dedupeTTL {
		q.mu.Unlock()
		return false, nil
	}
	q.pending[key(job)] = time.Now()
	q.mu.Unlock()
	select {
	case q.ch <- job:
		return true, nil
	default:
		return false, errors.New("job queue full")
	}
}

func (q *memQueue) Run(ctx context.Context, workers int, handle func(context.Context, Job) error) {
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job := <-q.ch:
					if err := handle(ctx, job); err != nil {
						q.log.Error("job failed", "kind", job.Kind, "user", job.UserID, "err", err)
					}
					q.mu.Lock()
					delete(q.pending, key(job))
					q.mu.Unlock()
				}
			}
		})
	}
	wg.Wait()
}
