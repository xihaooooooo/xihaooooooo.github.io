# JVM

---

## 1. JVM 运行时数据区（内存模型）

### 全景图

| 区域 | 线程共享 | 存储内容 | 异常 |
|------|---------|----------|------|
| **堆** | 是 | 对象/数组实例（GC 主要区域） | OOM |
| **方法区（元空间）** | 是 | 类信息、常量、静态变量、JIT 缓存 | OOM |
| **程序计数器** | 否 | 当前线程字节码行号指示器 | — |
| **虚拟机栈** | 否 | 栈帧（局部变量表 + 操作数栈 + 返回地址等） | StackOverflowError |
| **本地方法栈** | 否 | Native 方法 | StackOverflowError |
| **直接内存（堆外）** | 是 | NIO ByteBuffer 分配的非堆内存 | OOM |

### 1.1 堆（Heap）

堆是 GC 管理的核心区域，绝大多数 Java 对象的归宿。现代 JVM 的堆通常是**分代结构**：

**新生代（Young Generation）**：大部分对象"朝生夕死"，存活时间短。分为三块——一个 Eden 区和两个 Survivor 区（S0、S1，也叫 From/To）。对象在 Eden 区出生，经历 Minor GC 后如果还活着，就复制到 Survivor 区，在 S0 和 S1 之间反复倒腾，每次存活就年龄 +1。默认比例 Eden : S0 : S1 = 8 : 1 : 1（通过 `-XX:SurvivorRatio` 调整）。

**老年代（Old/Tenured Generation）**：经历了多次 Minor GC 还没死掉的对象（年龄超过 `MaxTenuringThreshold`，默认 15），或者 Eden 装不下的大对象（通过 `-XX:PretenureSizeThreshold` 指定阈值），直接进入老年代。老年代的 GC 频率低但要等 Major GC / Full GC 才清理，回收代价大。

**为什么要有 Survivor 区？** 没有 Survivor 区的话，Minor GC 后还在存活的对象要么留在 Eden（很快又满了，GC 频率暴涨），要么直接进老年代（大量短命对象污染老年代，Full GC 频率暴涨）。Survivor 区充当了"缓冲过滤层"——让真正短命的对象在新生代内被多次过滤，只有长寿对象才进老年代。

**对象进入老年代的四种路径**：
1. 年龄达标：在 Survivor 间每熬过一次 Minor GC，年龄 +1，到 15 岁进入老年代
2. 动态年龄判断：如果 Survivor 中年龄为 N 的对象总大小超过 Survivor 的一半，N 岁及以上的统统晋升
3. 大对象：超过 `PretenureSizeThreshold` 的对象直接在老年代分配（避免在 Eden 和 Survivor 之间大量拷贝）
4. 空间担保：Minor GC 时 Survivor 放不下的存活对象直接进入老年代

**字符串常量池的位置**：JDK 1.7 之后从方法区移到了堆中。原因是永久代/元空间大小是固定的，而 String 的用量不可预测（尤其在大量使用 String.intern() 的场景），放在堆中由 GC 统一管理更灵活。

### 1.2 方法区 / 元空间（Method Area / Metaspace）

方法区是 JVM 规范中定义的逻辑概念，HotSpot 在不同版本的物理实现不同。

**永久代（PermGen，JDK 1.7 及以前）**：
- 物理存在堆中，大小由 `-XX:PermSize` 和 `-XX:MaxPermSize` 控制
- 问题一：大小固定不易调——太小容易 OOM，太大浪费堆空间
- 问题二：PermGen 和堆的 GC 耦合在一起，Full GC 时一起回收，时间更长
- 问题三：不同 JVM 实现不一定有永久代，规范层面本不要求

**元空间（Metaspace，JDK 1.8+）**：
- 改为使用**本地内存（Native Memory）**，不再在堆中
- 大小由 `-XX:MetaspaceSize`（初始）和 `-XX:MaxMetaspaceSize`（上限）控制
- 默认不设上限，理论上只受 OS 物理内存限制，避免了 PermGen 的固定大小 OOM 问题
- 类卸载更彻底——元空间满了会触发类卸载（回收加载器已被回收的类的元数据），而 PermGen 的类卸载条件更严苛
- 与堆完全解耦，GC 互不影响

**元空间的内存布局**：分为两块——Klass Metaspace（存储类的元信息，紧挨堆以便通过压缩指针访问）和 Non-Klass Metaspace（存储方法字节码、常量池、注解等）。

### 1.3 虚拟机栈（VM Stack）

每个线程在启动时创建一个虚拟机栈，栈由多个**栈帧（Stack Frame）** 组成。方法被调用时创建一个新的栈帧压入栈顶，方法返回时弹出。

一个栈帧的内部结构：

**局部变量表（Local Variable Array）**：存储方法参数和方法内定义的局部变量。基本类型存值，引用类型存指针。槽位（Slot）可复用——变量出了作用域后它的槽位可以被后续变量用，这也是为什么局部变量必须先赋值再使用（JVM 不会自动清零复用的槽位）。long 和 double 占两个槽位，其他类型占一个。

**操作数栈（Operand Stack）**：字节码指令的执行场所。比如做 `a + b`，字节码先把 a 压栈、再把 b 压栈，执行 add 指令时从栈顶弹出两个数加完再压回去。深度在编译期就确定好，写入 class 文件的 Code 属性中。

**动态链接（Dynamic Linking）**：指向运行时常量池中该方法的引用，用于支持方法调用时的动态绑定。

**返回地址（Return Address）**：记录调用者 PC 寄存器的值，方法返回后恢复调用者的执行位置。

**附加信息**：调试信息、异常处理表等。

**栈的异常**：
- `StackOverflowError`：线程请求的栈深度超过允许的最大深度（单线程栈满，如无限递归）。`-Xss` 设置每个线程的栈大小（默认约 1MB）。
- `OutOfMemoryError`：Java 虚拟机栈支持动态扩展，但扩展时无法申请到足够内存（多线程场景，每个线程 1MB 默认栈，1GB 内存最多 ≈ 1000 个线程）。

### 1.4 本地方法栈（Native Method Stack）

与虚拟机栈功能相同，只不过它是为 Native 方法（JNI 调用的 C/C++ 方法）服务的。HotSpot 把虚拟机栈和本地方法栈合二为一了，所以绝大多数时候可以当作一回事。

### 1.5 程序计数器（Program Counter Register）

当前线程正在执行的字节码指令的行号指示器。分支、循环、跳转、异常处理、线程恢复都依赖它。它是 JVM 五个内存区域中唯一不会抛 OOM 或 StackOverflowError 的区域。线程执行 Native 方法时，PC 计数器为空（undefined）。

### 1.6 直接内存（Direct Memory）

不是 JVM 规范中的内存区域，但实际使用非常频繁。NIO 的 `ByteBuffer.allocateDirect()` 通过 `Unsafe.allocateMemory()` 在堆外分配内存，Java 堆中只保留一个引用指向这块本机内存。好处是避免了 Java 堆和 Native 堆之间的数据拷贝（常规 IO 数据流：磁盘 → 内核缓冲区 → JVM 堆 → 应用程序；Direct IO：磁盘 → 内核缓冲区 → 直接内存 → 应用程序），零拷贝零开销。代价是创建和销毁慢于普通堆内存分配，且不受 JVM GC 直接管理，需要等待 GC 回收引用时由虚引用（PhantomReference）触发 `Cleaner` 来释放。如果频繁分配大块 DirectByteBuffer 同时 GC 不触发，可能先于堆 OOM 直接爆掉物理内存。

### 1.7 JDK 1.7 → 1.8 的变化总结

| 变化点 | 1.7 | 1.8 |
|--------|-----|-----|
| 方法区物理实现 | 永久代（堆中） | 元空间（本地内存） |
| 方法区大小 | `-XX:MaxPermSize` | `-XX:MaxMetaspaceSize`（默认无限） |
| 字符串常量池 | 方法区（永久代） | 堆中 |
| 运行时常量池 | 方法区（永久代） | 元空间 |
| 静态变量 | 方法区（永久代） | 堆中（Class 对象的字段） |
| 方法区类卸载 | 条件严苛，很少触发 | 元空间满即触发 |

**为什么把字符串常量池移到堆**：永久代的空间通常很小（几十到几百 MB），而 String.intern() 可能塞入大量字符串，即使不 OOM，GC 也收集不到它（永久代的 GC 只在 Full GC 时回收），导致内存"慢性泄漏"。移到堆后，字符串常量和普通对象一样被 Minor GC 及时回收，运维压力大幅降低。

**为什么把静态变量移到堆**：1.8 中静态变量作为 Class 对象的字段存储在堆中（Class 对象本身就在堆中）。这样设计更统一——不再需要区分"类变量在方法区、实例变量在堆"，它们都在堆里，由 GC 统一管理。

---

## 2. 对象的创建过程

### 五步走

**① 类加载检查**：JVM 遇到 `new` 指令时，先检查对应的类是否已经加载、连接、初始化。如果没加载过，触发类加载过程（详见第三章）。这一步保证了类元信息在对象创建前已经就绪。

**② 分配内存**：从堆中划出一块空间给新对象。大小在类加载完成后就确定了，所以这一步纯粹是内存分配，不涉及复杂计算。

分配方式有两种，取决于堆是否规整（由 GC 是否带压缩整理决定）：
- **指针碰撞（Bump the Pointer）**：堆内存规整——已用的在一边，空闲的在另一边，中间一根指针分界。分配时把指针向前挪动对象大小的距离即可。Serial、ParNew 使用这种方式，因为它们的回收算法带压缩。
- **空闲列表（Free List）**：堆内存不规整——已用和空闲交错分布。JVM 维护一个记录了所有空闲块的列表，分配时从中找一个足够大的块划给对象。CMS 使用这种方式，因为它基于标记-清除不压缩。

**并发分配的线程安全问题**：多个线程同时 `new` 对象时，指针碰撞法面临"A 线程挪了一半指针、B 线程又来读"的竞争。JVM 的解决方式是 **TLAB（Thread Local Allocation Buffer）**——每个线程在 Eden 区预先分配一小块私有空间（默认占 Eden 1%），线程内部分配对象时直接在 TLAB 里用指针碰撞，不需要同步。TLAB 用满了才需要 CAS 申请一块新的。通过 `-XX:+/-UseTLAB` 控制。

**③ 初始化零值**：分配到的内存被置为零（基本类型默认值、引用类型 null）。这一步保证了不赋初始值的字段也有默认值可用，而且对 GC 友好——GC 读到零值知道这不是有效引用，不会误标记。

**④ 设置对象头**：对象头包含两部分：
- **Mark Word（标记字）**：存储对象自身的运行时数据——hashCode、GC 分代年龄、锁状态标志、偏向线程 ID 等。32 位 JVM 占 4 字节，64 位占 8 字节。这块内存的比特位会根据对象所处的锁状态动态复用（参见并发编程的 synchronized 锁升级）。
- **类型指针（Klass Pointer）**：指向方法区中该对象的类元数据（Klass 对象），JVM 通过它确定对象是哪个类的实例。在开启了压缩指针的 64 位 JVM 中（默认开启），这个指针从 8 字节压缩到 4 字节。

**⑤ 执行 `<init>()` 构造方法**：到这里对象已经是一个可用的完整对象了（所有字段都有默认值），但还需要按代码逻辑赋初值。`<init>()` 方法由编译器从构造方法代码块、实例变量赋值语句和父类构造器调用拼接而成，执行完成后对象才算真正"创建好"。

### TLAB 的实际影响

TLAB 是无锁优化的典型应用——看似每个 `new` 操作都直接操作堆，实际上大多数情况下只操作线程本地的缓冲区。这也是为什么即使在高并发创建对象的场景下，Java 的内存分配速度也不慢。只有当对象大小超过 TLAB 剩余空间时，才走"慢路径"去 Eden 的空闲区域直接分配。

---

## 3. 类加载机制

### 加载过程

```
加载 → 链接（验证 → 准备 → 解析）→ 初始化
```

**加载**：通过类的全限定名获取定义此类的二进制字节流（class 文件、JAR 包、网络、动态代理生成等均可），将其静态存储结构转化为方法区中的运行时数据结构，并在堆中生成一个 `java.lang.Class` 对象作为访问入口。注意，加载阶段和链接的某些部分是交叉进行的（如一部分验证在加载阶段就已经开始了）。

**验证**：确保 class 文件的字节流符合 JVM 规范，不会危害 JVM 安全。分四个阶段：文件格式验证（魔数 CAFEBABE、版本号是否支持）、元数据验证（是否有父类、是否继承了 final 类）、字节码验证（类型转换是否合法、操作数栈和指令是否匹配）、符号引用验证（引用的类/方法/字段是否存在、是否有权限访问）。JVM 启用了栈映射表（StackMapTable）可跳过字节码验证的大部分工作量。

**准备**：为类变量（static 修饰的变量）分配内存并赋初始值——不是代码中写的值，而是类型的默认零值。例如 `static int value = 123;`，准备阶段 value 是 0，要到初始化阶段才变成 123。一个例外：被 `final` 修饰的 static 基本类型或 String 常量，在准备阶段就已赋成指定的值（因为编译期已知，直接写入常量池了）。

**解析**：将常量池中的符号引用（类、字段、方法的名字和描述符的符号字符串）替换为直接引用（偏移量、内存地址）。符号引用与 JVM 无关——同一个 class 文件放到任何 JVM 上符号引用都一样。直接引用是 JVM 实现相关的——同一个符号引用在不同 JVM 实例中的直接引用可能不同。

**初始化**：执行 `<clinit>()` 方法——由编译器收集类的所有静态变量赋值语句和静态代码块（static 块），按源代码出现顺序合并而成。`<clinit>()` 在类加载过程中只执行一次，线程安全（JVM 自动加锁），且子类的 `<clinit>` 执行前会保证父类的 `<clinit>` 先执行完毕。

**触发初始化的六种情况**（主动引用）：
1. `new`、`getstatic`（读静态字段）、`putstatic`（写静态字段）、`invokestatic`（调静态方法）——注意 final 编译时常量除外
2. 通过反射 `Class.forName()` 调用（`initialize=true`）
3. 初始化子类时，父类必须先初始化
4. 虚拟机启动时标记为 `main()` 方法所在的主类
5. 动态语言支持（MethodHandle 的 REF_getStatic 等）
6. 接口中定义了 default 方法，其实现类初始化前接口需先初始化

### 双亲委派模型

```
Bootstrap ClassLoader（启动类：<JAVA_HOME>/lib，C++ 实现，Java 层返回 null）
      ↑
Platform ClassLoader（平台类：<JAVA_HOME>/lib/ext，JDK 9 替代 Extension ClassLoader）
      ↑
Application ClassLoader（应用类：classpath）
      ↑
自定义 ClassLoader
```

**工作流程**：一个类加载器收到加载请求后，先不自己加载，而是委托父加载器去尝试。一路向上，最顶层的 Bootstrap ClassLoader 如果找不到，才逐层向下让子加载器自己加载。一句话：**向上委托，向下查找**。

**两个核心好处**：
- **避免类重复加载**：每个类加载器有自己独立的命名空间。同一个全限定名的类，如果已被父加载器加载，子加载器就不会再加载，保证了 Java 核心类库（java.lang 等）在整个 JVM 中只有一份。
- **防止核心类被篡改**：如果有人写了一个 `java.lang.String` 放在 classpath 下，Application ClassLoader 委托到 Bootstrap 时发现已经被加载了，就不会加载这个恶意类，从而保护了 JVM 的安全基础。

**破坏双亲委派的典型场景**：

**Tomcat 的多 WebApp 隔离**：一个 Tomcat 可能跑多个 Web 应用，每个应用有自己的类库（可能是不同版本的 Spring、MySQL 驱动等）。如果按双亲委派，父加载器加载了 Spring 5.0，子应用 A 想用 Spring 4.0 就被拦截了。所以 Tomcat 为每个 WebApp 创建独立的 WebappClassLoader，重写了 `loadClass()` 方法，优先自己加载（不走双亲委派），只有自己找不到的才委托给父加载器。同时还保证了不同 WebApp 之间类的完全隔离。

**JDBC SPI（服务提供者接口）**：JDBC 的核心接口（`DriverManager`、`Connection`）在 `java.sql` 包中，由 Bootstrap ClassLoader 加载。但具体的数据库驱动（`com.mysql.cj.jdbc.Driver`）在 classpath 下，由 Application ClassLoader 加载。Bootstrap ClassLoader 向下看不到子加载器加载的类——按双亲委派模型，DriverManager 找不到 MySQL 驱动。解法是**线程上下文类加载器（Thread Context ClassLoader，TCCL）**：通过 `Thread.currentThread().getContextClassLoader()` 拿到发起方（Application ClassLoader）去加载驱动，从而绕开了双亲委派。

---

## 4. 垃圾回收

### 判断对象死亡

**可达性分析**：从一组称为"GC Roots"的根对象出发，顺着引用链一路追踪，能和根对象连上的是"活的"，连不上的是"死的"（可以回收）。这是 Java 的主流判定方式，与引用计数法相比不会受循环引用问题困扰。

**引用计数法的局限**：Python、PHP 等语言使用的方案——对象有一个引用计数器，引用时 +1，引用失效时 -1，归零即回收。但 A 引用 B 且 B 同时引用 A（循环引用），两个对象的计数都不为 0，永远不被回收。可达性分析是从外部找"这条引用链还有没有活人"——A 和 B 互相抱团但如果没有任何 GC Root 指向它们，就一起判死，完美解决了循环引用。

**GC Roots 详解**：

- **虚拟机栈（栈帧中的本地变量表）引用的对象**：正在执行的方法中的局部变量、参数引用的对象。这是最活跃的一类——当前线程正在用的对象绝不能被回收。
- **方法区中静态变量引用的对象**：类变量（static）引用的对象，只要类没被卸载，这些对象就必须存活。
- **方法区中常量引用的对象**：`static final` 或运行时常量池中引用的对象。
- **JNI（Native 方法）引用的对象**：Native 代码中分配或在 Native 代码中引用的 Java 对象。
- **synchronized 持有的对象**：当前被任何线程作为锁使用的对象（Mark Word 中记录了锁持有者），不能回收。

**finalize() 的"自救"与终结**：一个对象被判死后，会经历两次标记过程。第一次标记后，如果对象没有覆盖 `finalize()` 或已经被调过一次，直接回收。如果覆盖了 `finalize()` 且还没被调用，对象会被放入 F-Queue 队列，由 JVM 的低优先级 Finalizer 线程执行其 `finalize()`——对象可以在 `finalize()` 中把自己重新挂到引用链上（"自救"），从而逃过本次回收。但 `finalize()` 只会被自动调一次，且执行时机完全不可控，JDK 9 起已标记为 @Deprecated，不建议在任何新代码中使用。

### 四种引用

| 引用类型 | 回收时机 | 使用场景 |
|----------|----------|----------|
| 强引用 | 永不回收（除非不可达） | 普通 new |
| 软引用 | 内存不足时回收 | 缓存（图片、网页） |
| 弱引用 | 下一次 GC（不管内存够不够） | ThreadLocal、WeakHashMap |
| 虚引用 | 任何时候，仅通知用 | 堆外内存回收追踪 |

**软引用的实际应用**：在 Android 或服务端图片缓存中，用 `SoftReference` 包裹图片对象，当堆内存吃紧时 JVM 自动回收这类对象，释放内存给更关键的业务使用。这样就不需要在代码中手动管理缓存失效——"内存不够了你自己回收就好"。

**弱引用的典型应用——WeakHashMap**：当 key 只有 `WeakHashMap` 自己的弱引用在引用它时，下一次 GC 会回收这个 key，WeakHashMap 自动把它对应的 entry 删掉。适合做"旁路缓存"——缓存的数据有主存储（如数据库），key 可以随时被 GC。

**虚引用的唯一用途**：回收通知。创建时必须关联一个 `ReferenceQueue`。当对象被 GC 决定回收时，虚引用被加入队列，程序收到通知后可以执行资源清理（如 NIO 的 DirectByteBuffer 用虚引用触发 `Cleaner` 来释放堆外内存）。虚引用本身不能通过 `get()` 获得对象（永远返回 null），所以只能用于跟踪回收事件。

### 垃圾回收算法

| 算法 | 过程 | 优缺点 |
|------|------|--------|
| 标记-清除 | 标记 → 清除 | 效率一般、**内存碎片** |
| 标记-整理 | 标记 → 把存活对象向一端移动 | 无碎片、成本高 |
| 复制 | 内存分两块 → 存活对象复制的另一块 | 无碎片、浪费一半空间 |
| 分代收集 | 新生代(复制) + 老年代(标记-整理/清除) | 综合最优 |

**为什么新生代用复制算法**：新生代的对象"朝生夕死"，大部分在一次 Minor GC 后就死了，存活率低（通常只有 2-5%）。复制算法不需要标记清除的两次扫描——直接把少量存活对象复制到 Survivor 区，然后清空整个 Eden 区，两步搞定。时间和空间上都很高效。

**为什么老年代不直接用复制**：老年代对象存活率高，如果用复制，需要一大块备用空间来收容存活对象，而且每次 GC 都得拷贝大量对象，效率极差。所以老年代走标记-清除或标记-整理。

### 经典垃圾回收器

| 回收器 | 特点 | 适用 |
|--------|------|------|
| Serial / Serial Old | 单线程，STW | Client 模式、小堆 |
| Parallel Scavenge / Parallel Old | 多线程，吞吐量优先 | JDK 8 默认 |
| ParNew + CMS | 低延迟（CMS 并发标记-清除） | 互联网应用 |
| G1 | Region 分块，可预测停顿 | JDK 9+ 默认 |
| ZGC | 超低延迟，TB 级堆，染色指针 | JDK 11+，大内存 |
| Shenandoah | 并发回收，低延迟 | JDK 12+，与 ZGC 竞争 |
| Epsilon | 不做 GC（仅分配），测试用 | JDK 11+ |

**回收器组合规则**：新生代和老年代的回收器必须配对使用。Serial + Serial Old、Parallel Scavenge + Parallel Old（JDK 8 默认组合）、ParNew + CMS 是经典三组。G1/ZGC 不再区分新生代和老年代回收器——它们自己管全域。

### CMS 的七个阶段与致命痛点

CMS（Concurrent Mark Sweep）的核心设计是"让 GC 的大部分工作与用户线程并发执行"，从而最小化 STW（Stop-The-World）时间。但代价也很明显：

**① 初始标记（STW）**：只标记 GC Roots 能直接关联到的对象，速度很快。

**② 并发标记**：从 GC Roots 出发遍历整个引用图，与用户线程并发执行。这是耗时最长的阶段，但不 STW。

**③ 并发预清理**：标记在并发标记期间发生了变化的对象（通过跟踪 card table 的 dirty card），为重新标记减负。

**④ 重新标记（STW）**：修正并发标记阶段因用户线程继续运行而变动的标记结果（主要是黑色对象指向白色对象的新引用）。这个 STW 比初始标记长，但远短于完整扫描。

**⑤ 并发清除**：清理不可达对象，与用户线程并发。

**⑥ 并发重置**：重置 CMS 内部数据结构，为下一次 GC 做准备。

**CMS 的致命弱点**：
- **内存碎片**：标记-清除不压缩，老年代碎片多了可能找不到连续空间分配大对象，触发 **Concurrent Mode Failure**——CMS 还在跑，老年代已满，回退到 Serial Old 单线程全 STW 回收，停顿时间从毫秒级跳到秒级甚至几十秒。
- **浮垃圾（Floating Garbage）**：并发标记期间用户线程不断产生新垃圾（新变不可达的对象），CMS 不知道这些垃圾存在，只能等到下一次 CMS 才能回收。这些"浮垃圾"需要预留空间容纳，所以 CMS 的老年代不能真正等满了才触发，通常到 68%（`-XX:CMSInitiatingOccupancyFraction`）就开始。预留不够就 Concurrent Mode Failure。
- **CPU 敏感**：并发阶段 GC 线程和用户线程一起用 CPU，CPU 核心少时（2-3 核）GC 抢占计算资源，用户程序吞吐量显著下降。
- **JDK 14 已移除**：CMS 在 JDK 9 标记 @Deprecated，JDK 14 彻底删除。

### G1 的混合回收

G1 不再把堆按连续的新生代和老年代划分，而是把整个堆切分成多个大小相等的 **Region**（默认 2048 个，每个 1-32MB，通过 `-XX:G1HeapRegionSize` 调整）。Region 可以在逻辑上标记为 Eden、Survivor、Old 或 Humongous（大对象区，占连续多个 Region）。

G1 核心流程：

**Young GC**：与传统的 Minor GC 类似，统计 Eden 区，存活对象复制到 Survivor 或老年代。

**Mixed GC（混合回收，G1 的核心价值）**：不仅回收年轻代的 Region，还同时回收一部分老年代 Region。G1 维护了每个 Region 中垃圾堆积量的统计信息，按照"哪个 Region 垃圾最多就先收哪个"的原则优先回收（这就是 Garbage-First 名字的由来）。每次 Mixed GC 回收的 Region 数量由目标停顿时间动态决定。

**全局并发标记（Global Concurrent Marking）**：CMS 类似，G1 在后台运行并发标记，统计每个 Region 的存活对象比例，为 Mixed GC 提供决策数据。

**Humongous Object**：对象大小超过一个 Region 一半的算"巨型对象"，分配在 Humongous Region 中（可能占用连续多个 Region）。巨型对象直接在老年代分配，且回收只在 Full GC 或并发标记周期中的 Clean 阶段进行。

**G1 的停顿预测模型**：`-XX:MaxGCPauseMillis`（默认 200ms）不是硬保证，而是"以此为目标"。G1 根据历史数据估算每次回收 N 个 Region 大约需要多久，然后动态调整本次回收的 Region 数量，尽可能让实际停顿时间落在目标范围内。

### CMS vs G1 vs ZGC 选型对比

| | CMS | G1 | ZGC |
|---|---|---|---|
| 停顿 | 几十-几百 ms | ~10ms（可控） | <1ms（亚毫秒） |
| 堆大小 | <8GB | 4-64GB | 128GB-TB |
| 内存碎片 | 有 | 无（Region 内复制） | 无 |
| 默认场景 | 已淘汰 | JDK 9+ 默认 | 大内存低延迟 |
| 目标吞吐 | 较好 | 略低于 CMS（记日志、SATB 开销） | 尚在追赶 |

---

## 5. JVM 调优参数

### 堆与内存

| 参数 | 含义 | 何时调整 |
|------|------|----------|
| `-Xms` / `-Xmx` | 堆初始/最大大小 | 生产环境通常设成一样大，避免堆动态扩缩的开销和停顿 |
| `-Xmn` | 新生代大小 | 新生代太大 → Minor GC 频率低但单次停顿长；太小 → Minor GC 频繁。调优时先通过 GC 日志观察新生代用量再改 |
| `-XX:NewRatio` | 老年代/新生代比例（如 `-XX:NewRatio=2` 表示老年代 : 年轻代 = 2 : 1） | 与 `-Xmn` 互斥，另一种定新生代大小的方式 |
| `-XX:SurvivorRatio` | Eden/S0 比例，默认 8（Eden : S0 : S1 = 8 : 1 : 1） | Survivor 太小导致存活对象直接进老年代，调大可过滤更多短命对象 |
| `-XX:MetaspaceSize` | 元空间初始大小，触发 Full GC 的阈值 | 如果应用类多或动态加载类（如 Groovy），适当调高，避免频繁 Full GC |
| `-XX:MaxMetaspaceSize` | 元空间最大大小 | 生产环境建议设上限，防止类加载泄漏拖垮操作系统内存 |
| `-XX:MaxDirectMemorySize` | 直接内存上限 | NIO 使用多的场景必须设，默认等于 `-Xmx` 可能不够 |

### 对象晋升相关

| 参数 | 含义 | 何时调整 |
|------|------|----------|
| `-XX:MaxTenuringThreshold` | 对象晋升老年代的年龄阈值，默认 15 | 调大让对象在 Survivor 多待几轮再进老年代（减少老年垃圾）；CMS 中最大只支持 6 |
| `-XX:PretenureSizeThreshold` | 大于此值的对象直接在老年代分配 | 避免大对象在 Eden 和 Survivor 间反复拷贝 |
| `-XX:+PrintTenuringDistribution` | 打印各区年龄分布，GC 日志中的 `Desired survivor size`、`age 1: 123456 bytes` | **调优必备**，不看这个很难判断 Survivor 和晋升阈值是否合理 |

### 垃圾回收器选择

| 参数 | 含义 | 适用 |
|------|------|------|
| `-XX:+UseSerialGC` | Serial + Serial Old | 单核、<100MB 堆 |
| `-XX:+UseParallelGC` | Parallel Scavenge + Parallel Old | 吞吐量优先、批量计算（JDK 8 默认） |
| `-XX:+UseConcMarkSweepGC` | ParNew + CMS | 低延迟互联网应用（JDK 14 已移除） |
| `-XX:+UseG1GC` | 使用 G1 | 4-64GB 堆、需要可控停顿（JDK 9+ 默认） |
| `-XX:+UseZGC` | 使用 ZGC | 超大堆、亚毫秒级延迟 |

### GC 日志（JDK 9+ 统一日志格式）

JDK 9 之后 GC 日志参数统一为 `-Xlog` 系列，老旧的 `-XX:+PrintGCDetails` 和 `-XX:+PrintGCDateStamps` 已经废弃。

| 参数 | 含义 |
|------|------|
| `-Xlog:gc` | 打印 GC 基本信息（时间段、GC 类型、回收前后内存量） |
| `-Xlog:gc*` | 打印所有 GC 相关详细日志（含标记、引用处理、堆摘要等） |
| `-Xlog:gc+heap=trace` | 最详细级别，GC 前后堆的全貌 |
| `-Xlog:gc:file=/path/gc.log` | GC 日志输出到文件（支持文件轮转 `filecount` 和 `filesize`） |

### 生产环境通用配置模板

**中小型应用（<4GB 堆）**：

```bash
-Xms2G -Xmx2G
-Xss512k
-XX:MetaspaceSize=256M -XX:MaxMetaspaceSize=256M
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:MaxDirectMemorySize=512M
-Xlog:gc*:file=/app/logs/gc.log:time,uptime:filecount=10,filesize=100M
```

**大内存应用（4GB+ 堆）**：

```bash
-Xms8G -Xmx8G
-Xss512k
-XX:MetaspaceSize=512M -XX:MaxMetaspaceSize=512M
-XX:+UseG1GC
-XX:MaxGCPauseMillis=100
-XX:G1HeapRegionSize=16M
-XX:MaxGCPauseMillis=100
-XX:MaxDirectMemorySize=4G
-Xlog:gc*:file=/app/logs/gc.log:time,uptime:filecount=10,filesize=100M
```

### 调优原则

**最重要的两个参数是 `-Xms`/`-Xmx` 和 GC 日志**。堆设小了一定 OOM，设太大了 GC 扫描范围大、停顿时间长。GC 日志是调优的"心电图"——不看日志调的参数都是猜。生产环境至少开启 `-Xlog:gc` 级别的日志。

**调优思路**：不是一开始就调整 GC 参数，而是先开日志跑一段时间 → 观察 GC 频率和停顿时间 → 如果有问题（GC 太频繁、停顿太长），再根据日志定位是哪个区域在膨胀 → 针对性地调该区域的大小或晋升策略 → 继续观察 → 持续迭代。盲目看网上抄参数通常不如默认配置。

---

## 6. 常见 OOM 场景

- **`java.lang.OutOfMemoryError: Java heap space`**：最典型的 OOM，堆内存真的装不下了。可能原因：一次性查询出几百万条记录全部塞进 List、缓存无限膨胀、对象被有意或无意地长时间持有不释放。排查思路：`jmap -histo` 或 MAT 分析堆转储（heap dump），找到占据内存最大的对象，追溯引用链找出"谁在持有它"。

- **`java.lang.OutOfMemoryError: GC overhead limit exceeded`**：GC 线程（CPU 时间）消耗了 98% 以上的时间，但只回收了不到 2% 的堆空间。这意味着程序几乎没有时间执行真正的业务逻辑，全部耗在垃圾回收的死循环上了。本质是堆太小或内存泄漏——GC 拼命腾空间但腾不出来。解决方案：要么扩大堆，要么找到泄漏源。

- **`java.lang.OutOfMemoryError: Metaspace`**：方法区/元空间满了。最常见的原因是 CGLIB、Javassist 等动态代理框架无限制地生成类——每个动态代理对象生成一个 Class 文件，大量类加载器没有回收导致元空间持续膨胀。JSP 文件被编译成 Servlet 类累积也是经典场景。排查：`-XX:MaxMetaspaceSize` 设上限，`-verbose:class` 跟踪类加载，确认是否有类无限生成。

- **`java.lang.StackOverflowError`**：每个线程的栈空间有限（`-Xss` 默认约 1MB），方法调用层级太深就会溢出。常见场景：无限递归（忘了递归终止条件）、长调用链（A→B→C→...→Z 连续调用几百层）、递归处理了超长数据（尾递归优化需要编译器支持，Java 默认不做）。排查：看栈轨迹找出循环出现的调用帧即可定位。

- **`java.lang.OutOfMemoryError: Direct buffer memory`**：NIO 的 `ByteBuffer.allocateDirect()` 分配的是堆外的系统内存，不受堆大小限制，但受 `-XX:MaxDirectMemorySize` 和系统物理内存限制。直接内存对象的 Java 端引用很小（几个字节），但系统内存端可能占了几百 MB。如果分配速度超过 GC 回收 Cleaner 的速度，直接内存会先于堆 OOM。排查：看分配了多少 DirectByteBuffer，考虑设 `-XX:MaxDirectMemorySize` 做上限保护。

- **额外提醒——`unable to create new native thread`**：这个虽然不以 OOM 开头，但同样是名额耗尽。每个线程消耗一定内存（栈 + 元数据），当系统内存/线程数达到上限（`/proc/sys/kernel/threads-max` 或 `ulimit -u`），就无法创建新线程。排查：看是否线程池泄漏或堆设置过大挤占了线程内存。

---

## 7. 强引用 / 软引用 / 弱引用 / 虚引用代码示例

```java
// 强引用：只要引用链还在，GC 永不回收
Object obj = new Object();

// 软引用：内存充足时不回收，即将 OOM 时 JVM 自动回收
// 适用于"丢了也没关系但最好留着"的缓存
SoftReference<Object> softRef = new SoftReference<>(new Object());
Object cached = softRef.get();  // 可能返回 null（被回收了）

// 弱引用：下一次 GC 必回收（不管内存够不够）
// ThreadLocal 的 key 就是 WeakReference，ThreadLocalMap 靠它防止 key 泄漏
WeakReference<Object> weakRef = new WeakReference<>(new Object());
Object weakVal = weakRef.get();  // GC 后大概率返回 null

// 虚引用：get() 永远返回 null，唯一作用是配合 ReferenceQueue 接收回收通知
// NIO DirectByteBuffer 的 Cleaner 就是虚引用的子类，用来释放堆外内存
ReferenceQueue<Object> queue = new ReferenceQueue<>();
PhantomReference<Object> phantomRef = new PhantomReference<>(new Object(), queue);
```

**记忆口诀**：强→死都不放；软→内存不够放；弱→下次 GC 一定放；虚→放了就告诉你。四种引用按强度递减：**Strong > Soft > Weak > Phantom**。
