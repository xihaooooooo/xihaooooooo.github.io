# JVM

---

## 1. JVM 运行时数据区（内存模型）

| 区域 | 线程共享 | 存储内容 | 异常 |
|------|---------|----------|------|
| **堆** | 是 | 对象/数组实例（GC 主要区域） | OOM |
| **方法区（元空间）** | 是 | 类信息、常量、静态变量、JIT 缓存 | OOM |
| **程序计数器** | 否 | 当前线程字节码行号指示器 | — |
| **虚拟机栈** | 否 | 栈帧（局部变量表 + 操作数栈 + 返回地址等） | StackOverflowError |
| **本地方法栈** | 否 | Native 方法 | StackOverflowError |

### 1.7 vs 1.8

- 1.7：方法区 = 永久代（`-XX:MaxPermSize`），在堆中
- 1.8：方法区 = 元空间（本地内存，`-XX:MaxMetaspaceSize`），字符串常量池移到堆

---

## 2. 对象的创建过程

```
1. 类加载检查 → 2. 分配内存（指针碰撞 / 空闲列表）
→ 3. 初始化零值 → 4. 设置对象头（Mark Word + 类型指针）
→ 5. <init>() 构造方法
```

分配方式由 GC 是否带压缩整理决定：Serial/ParNew 用指针碰撞，CMS 用空闲列表

---

## 3. 类加载机制

### 加载过程

```
加载 → 链接（验证 → 准备 → 解析）→ 初始化
```

- **加载**：全限定名获取字节流 → 方法区生成 Class 对象
- **验证**：文件格式、元数据、字节码、符号引用校验
- **准备**：为静态变量分配内存并赋默认值
- **解析**：符号引用 → 直接引用
- **初始化**：`<clinit>()` 执行静态变量赋值和静态代码块

### 双亲委派模型

```
Bootstrap ClassLoader（启动类：rt.jar）
      ↑
Extension ClassLoader（扩展类：jre/lib/ext）
      ↑
Application ClassLoader（应用类：classpath）
      ↑
自定义 ClassLoader
```

- 工作流程：**向上委托 → 向下查找**
- 优点：避免类重复加载、防止核心类被篡改
- **破坏双亲委派的场景**：Tomcat 多 WebApp 隔离、JDBC SPI（Thread Context ClassLoader）

---

## 4. 垃圾回收

### 判断对象死亡

**可达性分析**：从 GC Roots 出发，沿引用链不可达 → 可回收

**GC Roots 包括**：
- 虚拟机栈（栈帧中的本地变量表）引用的对象
- 方法区中静态变量引用的对象
- 方法区中常量引用的对象
- JNI（Native 方法）引用的对象
- synchronized 持有的对象

### 四种引用

| 引用类型 | 回收时机 | 使用场景 |
|----------|----------|----------|
| 强引用 | 永不回收（除非不可达） | 普通 new |
| 软引用 | 内存不足时回收 | 缓存（图片、网页） |
| 弱引用 | 下一次 GC（不管内存够不够） | ThreadLocal、WeakHashMap |
| 虚引用 | 任何时候，仅通知用 | 堆外内存回收追踪 |

### 垃圾回收算法

| 算法 | 过程 | 优缺点 |
|------|------|--------|
| 标记-清除 | 标记 → 清除 | 效率一般、**内存碎片** |
| 标记-整理 | 标记 → 把存活对象向一端移动 | 无碎片、成本高 |
| 复制 | 内存分两块 → 存活对象复制的另一块 | 无碎片、浪费一半空间 |
| 分代收集 | 新生代(复制) + 老年代(标记-整理/清除) | 综合最优 |

### 经典垃圾回收器

| 回收器 | 特点 | 适用 |
|--------|------|------|
| Serial / Serial Old | 单线程，STW | Client 模式、小堆 |
| Parallel Scavenge / Parallel Old | 多线程，吞吐量优先 | JDK 8 默认 |
| ParNew + CMS | 低延迟（CMS 并发标记-清除） | 互联网应用 |
| G1 | Region 分块，可预测停顿 | JDK 9+ 默认 |
| ZGC | 超低延迟，TB 级堆，染色指针 | JDK 11+，大内存 |

### CMS 的缺点

- 标记-清除有碎片 → 需预留空间 → 可能 Concurrent Mode Failure → 回退 Serial Old（长时间 STW）
- 浮垃圾（并发标记产生的新垃圾需要在下次 GC 处理）
- 对 CPU 敏感（并发阶段占用）

### G1 特点

- 堆分割成多个大小相等的 Region（逻辑上仍分新生代/老年代）
- 每次回收价值最高的 Region（Garbage-First）
- 可设置预期停顿时间 `-XX:MaxGCPauseMillis`

---

## 5. JVM 调优参数

| 参数 | 含义 |
|------|------|
| `-Xms` / `-Xmx` | 堆初始/最大大小 |
| `-Xmn` | 新生代大小 |
| `-XX:SurvivorRatio` | Eden/S0 比例，默认 8 |
| `-XX:MetaspaceSize` / `-XX:MaxMetaspaceSize` | 元空间 |
| `-XX:+PrintGCDetails` | 打印 GC 日志 |
| `-XX:+UseG1GC` | 使用 G1 |

---

## 6. 常见 OOM 场景

| 异常 | 原因 |
|------|------|
| `Java heap space` | 堆内存不足（对象太多/太大） |
| `GC overhead limit exceeded` | GC 时间占比超 98%，回收不到 2% 堆 |
| `Metaspace` | 类加载过多（CGLIB 动态代理、大量 JSP） |
| `StackOverflowError` | 递归过深、方法调用层级太多 |
| `Direct buffer memory` | NIO 直接内存不足 |

---

## 7. 强引用 / 软引用 / 弱引用 / 虚引用代码示例

```java
// 强引用
Object obj = new Object();

// 软引用 — 内存不足时回收
SoftReference<Object> softRef = new SoftReference<>(new Object());

// 弱引用 — 下次 GC 必回收
WeakReference<Object> weakRef = new WeakReference<>(new Object());

// 虚引用 — 仅跟踪回收通知
PhantomReference<Object> phantomRef = new PhantomReference<>(new Object(), new ReferenceQueue<>());
```
