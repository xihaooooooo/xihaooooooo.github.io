# Redis

---

## 1. 数据类型及应用场景

| 类型 | 底层结构 | 应用场景 |
|------|---------|----------|
| String | SDS（简单动态字符串） | 缓存、计数器、分布式锁、session |
| Hash | ziplist / hashtable | 对象缓存、购物车 |
| List | quicklist（ziplist+linkedlist 结合体） | 消息队列、时间线 |
| Set | intset / hashtable | 标签、共同好友、抽奖去重 |
| ZSet | ziplist / skiplist+hashtable | 排行榜、延迟队列（score=时间戳） |
| Stream | radix tree | 持久化消息队列、消费者组 |
| Bitmap | String | 签到统计、布隆过滤器 |
| HyperLogLog | — | UV 统计（非精确、节省空间） |
| GEO | ZSet | 附近的人 |

---

## 2. 缓存三大问题

### 缓存穿透

- **现象**：查询不存在的数据 → 缓存无 → 每次打到 DB
- **解决**：
  - 布隆过滤器（快速判断 key 是否存在）
  - 缓存空值（过期时间设短）
  - 参数校验（不合法 key 直接拦截）

### 缓存击穿

- **现象**：热点 key 过期 → 大量请求瞬间涌入 DB
- **解决**：
  - 互斥锁（获取锁后查 DB 写缓存）
  - 逻辑过期（value 中存过期时间，异步续期不阻塞读）
  - 永不过期（通过后台任务更新）

### 缓存雪崩

- **现象**：大量 key 同时过期 / Redis 宕机 → DB 压力骤增
- **解决**：
  - 过期时间 + 随机值（打散过期时间）
  - 多级缓存（本地缓存 + Redis）
  - 限流降级
  - Redis 集群 / 哨兵高可用

---

## 3. 缓存一致性

### Cache Aside Pattern（旁路缓存，最常用）

```
读：先读缓存 → 缓存有 → 返回
             → 缓存无 → 读 DB → 写缓存 → 返回

写：先更新 DB → 再删除缓存
      ↑ 注意：不能先删缓存（并发写可能把脏数据写回缓存）
```

### 延迟双删

```
1. 删除缓存
2. 更新 DB
3. 延迟 N ms
4. 再次删除缓存
```

用于极端并发场景（读写并发时，先删缓存仍有窗口写入脏数据）

---

## 4. 分布式锁

### 单机 Redis

```bash
SET lock_key unique_value NX EX 30
```

- `NX`：不存在才设置（互斥）
- `EX 30`：30 秒过期（防死锁）
- unique_value：释放时判断 value 是否相同，防止误删他人的锁

### 释放（Lua 原子操作）

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

### Redisson 看门狗

- 自动续期：每 10 秒检查，若锁还在持有，重设为 30 秒
- 避免业务执行时间超过锁过期时间导致锁释放

### Redlock（多节点）

- N 个独立 Redis 实例（通常 5 个）
- 成功获取 N/2 + 1 个节点的锁 → 分布式锁成功
- 争议：效率低，大多数场景单机足够

---

## 5. 单线程为什么快

- 纯内存操作（纳秒级响应）
- 单线程避免锁竞争、上下文切换开销
- **IO 多路复用**（Linux epoll）：一个线程监听多个连接
- 高效数据结构：SDS、quicklist、skiplist、ziplist

> Redis 6.0+ 引入多线程 IO（仅处理网络读写），命令执行仍是单线程

---

## 6. 持久化

### RDB（Redis DataBase）

- 指定时间间隔做**内存快照**
- `bgsave`：fork 子进程，COW（写时复制）
- 优点：文件紧凑、恢复快
- 缺点：两次快照之间的数据会丢失

### AOF（Append Only File）

- 追加每条**写命令**到文件
- 策略：always（每条刷盘）/ **everysec**（每秒刷，推荐）/ no（OS 负责）
- AOF 重写（bgrewriteaof）：压缩冗余命令，瘦身
- 优点：最多丢 1 秒数据
- 缺点：文件大、恢复慢

### 混合持久化（Redis 4.0+）

RDB + AOF 混合：重写时先用 RDB 记录当前快照，再追加增量 AOF

---

## 7. 过期删除与内存淘汰

### 过期删除策略

- **惰性删除**：访问 key 时检查是否过期
- **定期删除**：每 100ms 随机抽取一批 key 检查
- 两者结合，惰性兜底

### 内存淘汰策略（8 种）

| 策略 | 说明 |
|------|------|
| noeviction | 不淘汰，写满报错（默认） |
| allkeys-lru | 所有 key 中 LRU 淘汰 |
| volatile-lru | 有过期时间的 key 中 LRU 淘汰 |
| allkeys-lfu | 所有 key 中 LFU 淘汰 |
| volatile-lfu | 有过期时间的 key 中 LFU 淘汰 |
| allkeys-random | 所有 key 中随机淘汰 |
| volatile-random | 有过期时间的 key 中随机淘汰 |
| volatile-ttl | 最快过期的 key 淘汰 |

> 一般缓存场景用 **allkeys-lru**

---

## 8. 集群方案

| 方案 | 特点 |
|------|------|
| 主从复制 | 读写分离、数据冗余，不能自动故障转移 |
| 哨兵（Sentinel） | 监控 + 自动故障转移 + 通知 |
| Cluster | 去中心化、分片（16384 个 slot）、自动故障转移 |

### Cluster 分片

- `slot = CRC16(key) % 16384`
- 每个节点负责一部分 slot
- 客户端可重定向（MOVED / ASK）

---

## 9. 大 Key / 热 Key

### 大 Key

- **问题**：阻塞 Redis、网络带宽高、迁移困难
- **处理**：拆分（Hash 按 field 拆分）、避免大 value、用 `unlink` 替代 `del`（异步删除）

### 热 Key

- **问题**：单节点 CPU 打满、带宽瓶颈
- **处理**：本地缓存、多副本（读写分离）、对 key 加随机前缀分散访问

---

## 10. Redis 线程模型演进

| 版本 | 变化 |
|------|------|
| 6.0 前 | 纯单线程（读网络 + 解析命令 + 执行 + 写网络） |
| 6.0 | 多线程 IO（网络读写多线程，命令执行仍单线程） |
| 7.0+ | 继续优化多线程 IO |
