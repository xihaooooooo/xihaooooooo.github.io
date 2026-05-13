# Java 基础

---

## 1. 面向对象四大特性（封装、继承、多态、抽象）

### 1.1 封装（Encapsulation）

**核心**：把数据和操作绑在一起，对外只暴露必要的方法，内部实现细节隐藏起来。

- 具体做法：**private 字段 + public getter/setter**
- 好处：调用方不关心内部怎么存怎么算，随时可以改，不影响外部

```java
public class User {
    private int age; // 不让你直接摸，只能走 setter

    public void setAge(int age) {
        if (age < 0 || age > 150) throw new IllegalArgumentException("不合理");
        this.age = age; // 可以做校验、日志、权限检查
    }

    public int getAge() { return age; }
}
```

> 面试话术：降低耦合、提高可维护性、属性私有 + 公共方法访问。Spring Bean 就是封装的典型 — 字段 private，通过注入和接口暴露能力。

### 1.2 继承（Inheritance）

**核心**：子类继承父类的字段和方法，复用父类代码，表达 "is-a" 关系。

```java
class Animal {
    String name;
    void eat() { System.out.println(name + " 在吃"); }
}

class Dog extends Animal {
    void bark() { System.out.println(name + " 汪汪"); }
}
```

关键点：

- Java **单继承** — 一个类只有一个亲爹（但可以多层继承：A extends B extends C）
- 可以实现多个接口，间接达到多继承效果
- 子类**不能缩小**父类方法的访问权限（public → private 不行）
- 构造器**不会被继承**，但子类构造器会隐式/显式调用 super()
- **组合优先于继承**：《Effective Java》建议，能用 "有一个"（has-a）就别用 "是一个"（is-a），减少耦合

### 1.3 多态（Polymorphism）

**核心**：同一个行为，不同对象表现不同。父类引用指向子类对象，调同一个方法走不同逻辑。

三个前提：
1. 有继承/实现关系
2. 子类重写父类方法
3. 父类引用指向子类对象

```java
Animal a1 = new Dog();
Animal a2 = new Cat();
a1.sound(); // 汪汪
a2.sound(); // 喵喵
// 编译看左边（Animal），运行看右边（Dog/Cat）
```

两种形态：

| | 编译时多态 | 运行时多态 |
|--|-----------|-----------|
| 机制 | 重载 Overload | 重写 Override |
| 绑定时机 | 编译期（静态绑定） | 运行期（动态绑定） |
| 方法签名 | 方法名相同，参数列表必须不同 | 方法名和参数列表必须一致 |

**底层原理**：JVM 通过**虚方法表（vtable）** 在运行时找到实际对象的方法地址，实现动态分发。

---

## 2. == 与 equals

### == 运算符
- **基本类型**：直接比值
- **引用类型**：比较**引用地址**（栈中存的指针），看两个引用是否指向堆中同一个对象

### equals() 方法
- 定义在 `Object` 类中，默认实现就是 `==`
  ```java
  public boolean equals(Object obj) {
      return (this == obj);
  }
  ```
- String、Integer 等包装类**重写了 equals**，比的是内容而非地址
- 自定义类想按字段比相等，必须重写 equals

### 高频案例

```java
// 基础类型：比的值
int a = 10, b = 10;
System.out.println(a == b); // true

// String 字面量 vs new
String s1 = "abc";
String s2 = "abc";
String s3 = new String("abc");
System.out.println(s1 == s2);      // true — 都在字符串常量池，复用同一对象
System.out.println(s1 == s3);      // false — new 在堆里，地址不同
System.out.println(s1.equals(s3)); // true — equals 比的是内容

// Integer 缓存池陷阱
Integer i1 = 127, i2 = 127;
Integer i3 = 128, i4 = 128;
System.out.println(i1 == i2); // true — -128~127 走缓存
System.out.println(i3 == i4); // false — 超范围 new 新对象
System.out.println(i3.equals(i4)); // true — equals 比内容
```

> 口诀：基本类型 == 比值，引用类型 == 比地址，equals 看谁重写。**重写 equals 必须重写 hashCode**（否则 HashMap 里按内容相等的两个对象可能被放到不同桶里）。

---

## 3. hashCode 与 equals 的约定

### Hash 表工作原理

HashMap 先通过 hashCode 快速定位桶（bucket），桶内再用 equals 精确匹配。这就像先查字典按字母找章节，再逐条看是不是同一个词。

### 约定（Object 规范）

| 规则 | 说明 |
|------|------|
| equals 相等 → hashCode 相等 | 必须满足，否则 HashMap 找不到 |
| hashCode 相等 ⇏ equals 相等 | 哈希冲突，链表/红黑树里继续比 |
| equals 不相等 | hashCode 可等可不等（不等则 HashMap 性能更好，冲突少） |

### 违反约定的后果

```java
// 只重写 equals，忘重写 hashCode
class User {
    String name;
    @Override public boolean equals(Object o) {
        return o instanceof User && ((User) o).name.equals(this.name);
    }
    // 没重写 hashCode — 用的是 Object 的 native 方法，返回内存地址
}

User u1 = new User("tom");
User u2 = new User("tom");
System.out.println(u1.equals(u2));       // true — 按内容相等
Map<User, String> map = new HashMap<>();
map.put(u1, "val");
System.out.println(map.get(u2));         // null！— hashCode 不同，定位到了不同桶
```

### 正确示范

```java
@Override
public int hashCode() {
    return Objects.hash(name, age); // 参与 equals 的字段也参与 hashCode
}
```

> 原则：**equals 用到的字段，hashCode 也必须用**，保证"相等对象的哈希值一定相等"。

---

## 4. String、StringBuilder、StringBuffer

| 类型 | 可变性 | 线程安全 | 性能 |
|------|--------|----------|------|
| String | 不可变（final 类，char[]） | — | 拼接会产生大量新对象 |
| StringBuilder | 可变 | 不安全 | 单线程下快 |
| StringBuffer | 可变 | synchronized | 多线程安全 |

### String 为什么不可变？

- **字符串常量池复用**：不可变才能安全共享，多个引用指向同一份数据
- **HashMap 的 key 安全**：key 通常是 String，如果可变 hashCode 会变，导致 get 找不到
- **线程安全**：不可变天然安全
- **安全防护**：类加载名、文件路径不会被恶意篡改

底层 `final char[]`（JDK8）或 `final byte[]`（JDK9+），不暴露修改入口。

### 拼接性能

```java
// 慢 — 循环内每次 + 都 new 一个 StringBuilder，N 次创建 N 个临时对象
String s = "";
for (int i = 0; i < 10000; i++) {
    s += i; // 编译为 new StringBuilder(s).append(i).toString()
}

// 快 — 只有一个 StringBuilder，内部 char[] 扩容
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i);
}
```

> 单行拼接 `"a" + "b"` 编译器会自动优化为 StringBuilder，不用管。**循环内拼接必须用 StringBuilder。**

### 线程安全

```java
// StringBuffer 每个方法都有 synchronized，安全但慢
StringBuffer buf = new StringBuffer();

// 现代做法：方法内局部变量用 StringBuilder（天然线程安全，不逃逸）
StringBuilder sb = new StringBuilder();
```

---

## 5. 深拷贝 vs 浅拷贝

- **浅拷贝**：拷贝引用 — 原对象和副本指向同一个内部对象
- **深拷贝**：完全复制 — 内部对象也独立

```java
// 浅拷贝：User 实现了 Cloneable，但内部的 Address 成员只是复制了引用
User clone = (User) user.clone();
clone.address.city = "北京";   // user.address.city 也变了！
```

**实现方式**：

- 实现 `Cloneable` + 重写 `clone()` — 需逐层深拷贝内部对象，嵌套深了很繁琐
- 序列化/反序列化 — JSON 或 `ObjectInputStream/ObjectOutputStream`，一步到位但慢
- **Cloneable 是标记接口**，不重写 `clone()` 照样抛 `CloneNotSupportedException`
- `clone()` 是浅拷贝（除非手动深拷贝），谨慎使用

---

## 6. 泛型

- **类型擦除**：编译期检查类型安全，运行时类型参数被擦除为边界或 Object
- 擦除原因：兼容 JDK5 之前的旧代码，字节码层面 `List<String>` 和 `List<Integer>` 是同一个 `List`
- `? extends T`：上界通配符，只能读不能写（生产者 — Producer）
- `? super T`：下界通配符，只能写不能读（消费者 — Consumer）

```java
// PECS 示例
void copy(List<? extends Number> src, List<? super Number> dest) {
    for (Number n : src) dest.add(n);  // 从 src 读，往 dest 写
}
```

- 泛型不能是基本类型（`List<int>` 不行），必须用包装类
- 静态方法泛型 `<T>` 写在返回值前：`public static <T> T get(T t)`

---

## 7. 反射

运行时动态获取类信息、创建对象、调用方法，打破编译期限制。一切反射操作的入口都是 `Class` 对象。

### 7.1 获取 Class 对象的三种方式

- `Class.forName("全限定名")` — 最灵活，框架用得多（Spring、JDBC 都需要从配置文件读类名，编译期不知道）
- `类名.class` — 最安全，编译期就知道类型，返回带泛型的 `Class<T>`
- `对象.getClass()` — 已经有实例时用

三种方式拿到的是同一个 Class 对象——JVM 中每个类只有一个 Class 实例。

### 7.2 核心类一览

反射的四大核心类都在 `java.lang.reflect` 包中：

| 核心类 | 作用 | 关键方法 |
|--------|------|----------|
| `Class` | 类的字节码描述，入口 | `forName()` / `getDeclaredFields()` / `getDeclaredMethods()` |
| `Constructor` | 构造器 | `newInstance(Object... args)` 创建对象 |
| `Method` | 方法 | `invoke(对象, 参数...)` 调用方法 |
| `Field` | 字段 | `get(对象)` / `set(对象, 值)` 读写字段 |

**getXxx vs getDeclaredXxx**：带 Declared = 只拿本类声明的（含 private，不含父类）；不带 = 只拿 public 的（含父类继承的）。

### 7.3 核心工作流

```java
// 1. 拿到 Class
Class<?> clz = Class.forName("com.example.User");

// 2. 反射创建对象（JDK9+ 标准写法）
Object obj = clz.getDeclaredConstructor().newInstance();

// 3. 读写字段（私有字段需要 setAccessible）
Field name = clz.getDeclaredField("name");
name.setAccessible(true);           // 关掉 JVM 访问检查
name.set(obj, "新名字");

// 4. 调用方法（invoke 返回 Object，需手动转型）
Method getter = clz.getMethod("getName");
String result = (String) getter.invoke(obj);
```

有参构造器同理：`clz.getDeclaredConstructor(String.class, int.class).newInstance("张三", 25)`。

静态字段/方法操作时第一个参数传 `null`（不需要实例）。

### 7.4 setAccessible 的本质

`setAccessible(true)` **不是**修改了修饰符（`name` 仍然是 private），而是**跳过了 JVM 的访问权限检查**。它设置的是 `AccessibleObject` 父类的一个 boolean 标志，底层通过 native 方法绕过验证。

JDK 9+ 模块化系统加了更严格的封装——即使反射也访问不到非公开模块的内部 API，需要 `--add-opens` 参数显式放行。

### 7.5 性能：为什么反射慢？

| 调用方式 | 相对耗时 | 瓶颈 |
|----------|----------|------|
| 直接调用 | 1x | — |
| 反射（每次查 Method） | ~50x | 每次都查方法表 |
| 反射（缓存 Method 对象） | ~5-10x | 仍有装箱拆箱和间接调用 |
| setAccessible 后 | ~3-5x | 少了权限检查，但 JIT 还是无法内联 |

四个慢的原因：
1. **JIT 不能内联** — 反射是间接调用，编译器没法把方法体嵌入调用方
2. **参数反复装箱** — invoke 的参数是 `Object[]`，基础类型每次都要装箱
3. **安全校验残留** — 即使 setAccessible，每次调用仍有部分检查逻辑
4. **方法查找** — `getMethod()` 要遍历方法表做字符串匹配

> 优化方式很简单：把 Method/Field 对象缓存起来复用，避免重复查找。

### 7.6 反射 + 注解 = 框架的基石

自定义注解 + 运行时反射扫描，是 Spring、MyBatis 等框架的底层逻辑。比如 `@Column("user_name")` 注解标在字段上，ORM 框架通过 `field.getAnnotation(Column.class)` 读注解值，拼出 SQL 的字段映射。

Spring 同理：`@Autowired` 走反射注入依赖，`@Transactional` 走动态代理增强方法。

### 7.7 实际应用

| 场景 | 反射做了什么 |
|------|-------------|
| Spring IOC | 扫描 @Autowired，反射注入 Bean |
| Spring AOP（JDK 代理） | Proxy + InvocationHandler，invoke 中织入增强 |
| MyBatis / Hibernate | ResultSet → 对象，字段名匹配并反射赋值 |
| JDBC 驱动加载 | `Class.forName("com.mysql.cj.jdbc.Driver")` 触发静态块注册 |
| Jackson / Gson | 反射读写字段，无视 private |
| 单元测试 | 测试/Mock 私有方法或字段 |

### 7.8 注意事项

- **编译期不检查**：类名、方法名写错只有运行时才知道（`ClassNotFoundException`、`NoSuchMethodException`）
- **不要滥用**：反射的正确场合是写框架/中间件，业务代码大量用反射通常说明设计有问题
- **泛型擦除陷阱**：`method.getReturnType()` 返回的是擦除后类型（`List` 而非 `List<String>`），需要 `getGenericReturnType()` 才能拿到完整泛型信息
- **绕过泛型检查**：`ArrayList<String>` 能通过反射 add 任何类型——运行时泛型已擦除，安全检查只在编译期

---

## 8. 异常体系

```
Throwable
├── Error（不可恢复：OOM、StackOverflow）
└── Exception
    ├── RuntimeException（非受检：NPE、ClassCast、IndexOutOfBounds）
    └── 受检异常（IOException、SQLException）
```

- **受检异常**：编译器强制要求处理（try-catch 或 throws），调用方必须知道
- **非受检异常**：编译器不管，通常是程序 bug，应修改代码而非捕获
- 处理原则：**要么处理，要么往外抛**（catch or declare）
- try-catch-finally 执行顺序：
  1. try 无异常 → try → finally
  2. try 有异常，catch 未 return → try(异常点停) → catch → finally
  3. finally 中有 return → 会覆盖 catch 的 return（坑）
- JDK7 `try-with-resources`：`try (BufferedReader br = ...)` 自动关闭资源，不用 finally

---

## 9. Java 8 新特性（高频）

- **Lambda 表达式**：`(参数) -> { 方法体 }`
- **Stream API**：filter / map / reduce / collect / flatMap
- **Optional**：优雅处理 null，`ofNullable()` / `orElse()` / `ifPresent()`
- **函数式接口**：`@FunctionalInterface`，如 Predicate、Function、Consumer、Supplier
- **方法引用**：`String::length`、`System.out::println`
- **默认方法**：接口可有 default 实现
- **新的日期 API**：`LocalDate`、`LocalTime`、`LocalDateTime`（不可变、线程安全）

---

## 10. BIO / NIO / AIO

| | BIO | NIO | AIO |
|--|-----|-----|-----|
| 模型 | 阻塞同步 | 非阻塞同步（多路复用） | 异步非阻塞 |
| 线程 | 1连接:1线程 | 1线程:N连接(Selector+Channel) | 回调 |
| 实现 | 传统 Socket | epoll/select | Java 7 NIO.2 |

**BIO (Blocking I/O)**：`ServerSocket.accept()` 和 `InputStream.read()` 都会阻塞，一个线程只能处理一个连接。连接多了线程也暴涨，上下文切换开销大，适合连接数少的场景。

```java
ServerSocket server = new ServerSocket(8080);
Socket client = server.accept(); // 阻塞等连接
```

**NIO (Non-blocking I/O)**：一个 Selector 轮询多个 Channel，哪个就绪就处理哪个，一个线程就能管成百上千个连接。核心三件套：`Channel`（读写通道）、`Buffer`（数据缓冲区）、`Selector`（多路复用器）。Linux 下底层走 epoll，只有活跃的连接才会被处理。

**AIO (Asynchronous I/O)**：操作系统读完数据后主动回调/通知，读的时候不阻塞，读完自动通知。代码最简洁，写起来像同步，但实际生态没铺开，主流还是用 NIO（Netty、Tomcat 8+ 都基于 NIO）。

---

## 11. HashMap 底层原理（高频）

### 数据结构

JDK 1.7 是 `数组 + 链表`，JDK 1.8+ 升级为 `数组 + 链表 + 红黑树`：

```
数组 (Node[])
[0] → Node → Node (链表)
[1] → null
[2] → TreeNode → TreeNode (红黑树)
[3] → Node
...
```

Node 节点存四个东西：`hash`、`key`、`value`、`next`。TreeNode 是 Node 的子类，多了 `parent`、`left`、`right`、`prev`（维护双向链表，退化时直接用）、`red` 五个字段。

默认容量 16，最大 2^30。链表转红黑树的条件是**双阈值**：链表长度 ≥ 8 **且**数组长度 ≥ 64；数组不够 64 时优先扩容而非树化——因为数组小了，扩容能直接打散元素，比树化代价小。

### hash 扰动函数

```java
// HashMap.hash() 的实际源码
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

为什么不直接用 `key.hashCode()`？

定位桶用 `(n-1) & hash`，当 n = 16 时 n-1 = 15 = `0000...01111`，只有低 4 位参与运算。如果两个 key 的 hashCode 低 4 位相同但高位不同，就会撞到同一个桶。扰动函数把高 16 位信息"混"进低 16 位——高位变化 → 低位也变 → 碰撞更低。

key 为 null 时 hash 固定为 0，所以 HashMap 允许 null key（存在第 0 号桶）。ConcurrentHashMap 和 Hashtable 不允许 null key。

### put 流程详解

```java
// 简化的 put 流程
final V putVal(int hash, K key, V value, ...) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // 1. 数组为空 → 先初始化（懒加载，resize() 同时负责初始化和扩容）
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    // 2. 桶为空 → 直接放
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    else {
        // 3. 桶不空 → 处理冲突
        //    a) 头节点就是 → 直接覆盖
        //    b) 头节点是 TreeNode → 走红黑树插入
        //    c) 否则遍历链表：找到相同 key 覆盖，找不到尾插，再判断是否树化
    }
    // 4. size++ 后检查是否超过 threshold → 扩容
}
```

关键细节：
- **数组是懒初始化的** — `new HashMap<>(32)` 只是设了 threshold，第一次 put 才真正 new 数组。1.7 则是构造时就建好数组，膨胀感更重
- **JDK 8 链表用尾插法** — 1.7 头插法在扩容时会反转顺序，多线程下形成环；尾插法保持顺序，避免了环但仍有并发数据覆盖
- **key 相同判定**：`hash 相等 && (== 或 equals 相等)` — 先比 hash 是快速筛掉大部分，再用 equals 精确判定

### get 流程

get 比 put 简单，没有扩容和树化逻辑：

1. 计算 hash → 定位桶
2. 桶为空 → 返回 null
3. 头节点命中（hash 相等 + equals 相等）→ 直接返回
4. 头节点是 TreeNode → 走红黑树查找 O(log n)
5. 否则遍历链表 O(k)

### 为什么选择红黑树而非 AVL / B-Tree？

- **AVL**：平衡更严格（左右子树高度差 ≤ 1），查询略快但插入/删除旋转次数多。HashMap 需要频繁插入，红黑树的"松平衡"更适合
- **B-Tree**：为磁盘 I/O 设计（一个节点存多个 key，减少磁盘寻道），HashMap 在内存中工作，不需要
- **红黑树**：插入最多两次旋转，删除最多三次旋转，HashMap 这种重写轻读的场景刚刚好

TreeNode 还额外维护了双向链表（`prev`/`next`），退化时不需要重新构造链表，直接转回 Node 就行。

### 扩容机制 (resize)

每次扩容容量翻倍，newThr = oldThr << 1。

**1.7 死循环详细过程**：

```
扩容前: A → B → C → null（头插法转移）

线程1 刚拿到 A 和 next=B，挂起
线程2 完整执行扩容，链表变为 C → B → A → null
线程1 恢复，头插 A，然后操作 next=B
      但 B.next 在线程2 里已被改成 A...
      A → B → A → 死循环
```

这就是头插法的致命缺陷——反转链表顺序 + 多线程 = 成环。get() 落到这个环上就永远循环，CPU 100%。

**1.8 高位 bit 判断**：

扩容后容量变为 2 倍（如 16 → 32），多了一个新 bit 参与定位。只需判断 hash 在这个新 bit 上是 0 还是 1：

```
旧容量 16 (10000)，新容量 32 (100000)
n-1 旧: 01111 （5bit）
n-1 新: 11111 （6bit）——多了第 6 位

hash & 10000 == 0？ → 留在原位
hash & 10000 != 0？ → 移到原位置 + 旧容量
```

这样不需要重新算 hash，也不需要重新竞争桶锁，效率远超 1.7。

### 几个常问设计决策

**容量为什么是 2 的幂次？**

三个原因叠加：
1. `(n-1) & hash` 替代 `hash % n`，位运算快于取模
2. 扩容时能用高位 bit 判断新位置，元素只在两个位置（要不原位，要不原位 + 旧容量）
3. (n-1) 低位全是 1，hash 的所有参与位都能均匀分布，减少碰撞。如果 n 是 17，n-1=16=`10000`，低 4 位全是 0，所有 key 的下标只有 0 和 16 两种可能

**负载因子为什么是 0.75？**

空间 vs 时间的经典折中：
- 0.5：一半桶空着，空间浪费 50%，但查询快
- 1.0：桶几乎满了才扩容，空间利用好但链表很长，查询慢
- 0.75：通过泊松分布计算，在此因子下链表长度达到 8 的概率仅亿分之六，空间利用也合理（约 75% 桶被使用）

**构造器指定初始容量怎么处理？**

`new HashMap(10)` 并不会真的建容量 10 的数组——它会取 ≥ 10 的最小 2 的幂次，即 16。实际计算：

```java
static final int tableSizeFor(int cap) {
    int n = cap - 1;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;
}
```

所以 `new HashMap(10)` → capacity = 16，`new HashMap(33)` → capacity = 64。

### key 的设计要点

想要 HashMap 正确工作，key 必须满足：

- **不可变性** — key 放进 HashMap 后如果内容变了，hashCode 跟着变，get 就找不到了。String 和 Integer 都是不可变的 final 类，天然适合做 key。如果用自己的对象当 key，放进去后**不能改参与 hashCode 的字段**
- **重写 equals 必须重写 hashCode** — 否则 equals 相等的两个 key，hash 不同，定位到不同桶，get 找不到。HashMap 的正确性依赖这个约定
- **hashCode 尽量均匀** — 避免大量 key 落到同一个桶，否则链表长了/树化了，性能退回线性

### 线程安全方案对比

HashMap 完全不安全。替代方案从弱到强：

| | 原理 | 并发度 | 特点 |
|--|------|--------|------|
| `Collections.synchronizedMap()` | 所有方法加 synchronized | 全表互斥 | 简单但性能最差 |
| `Hashtable` | 同上（遗留类） | 全表互斥 | 不用了，连 null 都不让放 |
| `ConcurrentHashMap` 1.7 | 分段锁 Segment（默认 16 段） | 16 个线程同时写 | 跨段操作要锁多个段 |
| `ConcurrentHashMap` 1.8 | CAS + synchronized 锁单桶 | 桶级别并发 | put 失败 CAS 自旋，桶内用 synchronized |

ConcurrentHashMap 1.8 的 put 流程：
1. key/null 检查（不允许）
2. 计算 hash，数组未初始化则 initTable()（CAS 保证单线程初始化）
3. 桶为空 → CAS 写入，成功就完事
4. 桶正在扩容 → 帮忙迁移（ForwardingNode）
5. 否则 synchronized 锁住桶头 → 遍历链表/红黑树 → 插入/覆盖
6. 最后用 LongAdder 更新计数，不需要加锁

### 常见面试追问

- **HashMap 是怎么实现 fail-fast 的？** — `modCount` 记录结构修改次数。迭代时 checkForComodification() 发现 modCount 变了立刻抛 ConcurrentModificationException。用迭代器的 remove() 则没事，因为迭代器自己也维护了一把 expectedModCount
- **JDK 8 为什么把链表转红黑树的阈值设成 8 而不是 10 或 6？** — 8 是泊松分布给出的"几乎不可能自然发生"的边界，真到了就说明不正常，及时树化兜底。6 退化为链表是留 1 格缓冲防止反复切换
- **扩容的时候其他线程能读写吗？** — ConcurrentHashMap 可以，它把整个桶数组分段迁移，迁移过的桶能正常访问。HashMap 完全不能，读写都得不到正确结果
- **为什么 ConcurrentHashMap 的 key 和 value 不允许 null？** — 二义性问题：get 返回 null 到底是 key 不存在，还是 value 就是 null？在并发场景下没法通过 containsKey 再验证，因为中间状态已变。Doug Lea 直接不让放 null 从源头消除歧义

---

## 12. ArrayList vs LinkedList

| | ArrayList | LinkedList |
|--|-----------|------------|
| 底层 | `Object[]` 数组 | 双向链表（Node 存 prev + next） |
| 随机访问 | O(1)，下标直接定位 | 需要遍历，O(n) |
| 插入/删除 | 尾部快，中间需搬移 O(n) | **先定位再改指针**，定位本身 O(n) |
| 内存 | 连续空间，无额外指针开销 | 每个节点多存两个引用（prev/next），额外 16 字节 |
| 实现接口 | RandomAccess 标记接口 | 未实现 RandomAccess，同时是 Deque 实现 |
| 适用 | 查多、尾部追加、需要下标随机访问 | 头尾插入多、不需要随机访问、或需要双端队列操作 |

### ArrayList 扩容

默认容量 10，每次 grow 到 1.5 倍。扩容时 `Arrays.copyOf` 复制整个数组，大容量下代价不小：

```java
// 扩容核心逻辑（JDK 源码简化）
int newCapacity = oldCapacity + (oldCapacity >> 1); // 1.5 倍
elementData = Arrays.copyOf(elementData, newCapacity);
```

如果预估到数据量，构造时给个合理初始容量能减少扩容次数（`new ArrayList<>(1000)`）。

### 常见误区：插入/删除 LinkedList 一定比 ArrayList 快？

**不一定。** 分两种情况：

- **头尾操作**：LinkedList 确实 O(1)，ArrayList 尾部也 O(1)（不扩容时），但 ArrayList **头部插入**需要搬移所有元素 O(n)，LinkedList 完胜
- **中间操作**：要看能不能直接拿到节点引用。`list.add(index, e)` 需要**先遍历到 index 位置**（O(n)），找到后才改指针（O(1)）。ArrayList 虽然 copy 数组是 O(n)，但元素少+连续内存在现代 CPU 缓存下实际上**可能比 LinkedList 的指针跳转更快**

结论：面试时说"LinkedList 插入快"一定要带前提——"如果已经有了对应位置的节点引用则 O(1)，否则要先遍历 O(n)"。

### RandomAccess 标记

遍历 ArrayList 用普通 for 优于迭代器（直接下标访问 vs 额外创建 Iterator 对象）。遍历 LinkedList 必须用迭代器或增强 for（普通 for 每次都从头遍历，O(n²)）。

```java
// ArrayList：用普通 for，下标直击
for (int i = 0; i < list.size(); i++) { list.get(i); }

// LinkedList：用迭代器/增强 for，链表跟着指针走
for (String s : list) { ... }
```

框架代码里经常看到 `if (list instanceof RandomAccess)` 来选遍历策略。RandomAccess 没有方法，纯粹是**标记接口**，告诉外界"这个 List 支持快速随机访问"。

### 什么时候用哪个

- **ArrayList** — 99% 的场景。数组尾部追加快，内存紧凑，缓存友好，下标访问直接用
- **LinkedList** — 需要频繁头尾操作、不需要随机访问、或者实现了 Deque 接口的场景（但 `ArrayDeque` 往往更好）。LinkedList 还额外实现了 List 接口，但几乎没人用它的随机访问能力
- **写多 + 随机访问少** → 考虑 `ArrayDeque` 而非 LinkedList（ArrayDeque 也是数组，无链表开销，头尾操作也是 O(1)）

---

## 13. Java 集合框架全景

```
Collection
├── List（有序可重复）：ArrayList、LinkedList、Vector（线程安全）
├── Set（无序不可重复）：HashSet、LinkedHashSet、TreeSet
└── Queue（FIFO）：LinkedList、PriorityQueue、ArrayDeque

Map（K-V 键值对）
├── HashMap（数组+链表+红黑树，线程不安全）
├── LinkedHashMap（维护插入顺序）
├── TreeMap（红黑树，按 Key 自然排序）
├── Hashtable（线程安全，全表锁，已淘汰）
└── ConcurrentHashMap（分段锁 → CAS+synchronized，线程安全首选）
```

---

## 14. 接口 (interface) vs 抽象类 (abstract class)

核心区别一句话：**抽象类管"你是什么"，接口管"你能干什么"。**

| | interface | abstract class |
|--|-----------|----------------|
| 关键字 | interface | abstract class |
| 方法 | JDK8+ 可有 default/static 方法；JDK9+ 可有 private 方法 | 可有抽象方法 + 具体方法 |
| 变量 | 只能是 public static final 常量 | 可声明成员变量 |
| 继承 | 可实现多个接口（多继承） | 只能继承一个抽象类 |
| 构造器 | 无 | 有，供子类调用 |
| 语义 | is-like-a（行为契约） | is-a（模板模式） |

### 打个比方

你要设计一个"门"：

- **抽象类 = 门框**：所有的门都有一样的门框结构、安装方式、材质属性。门框定了，门的大框架就定了。只能继承一个门框——你没法同时是个木门框又是个铁门框
- **接口 = 门上的功能牌**："这扇门能报警"、"这扇门能刷卡"、"这扇门能指纹解锁"。一个门可以挂多个牌子（多实现），什么门都能挂

`AlarmDoor extends Door implements Alarm, CardReader, Fingerprint`——Door 是这门的基本身份（抽象类），Alarm/CardReader/Fingerprint 是这门会干的事（接口）。

### 什么时候用哪个？

**用抽象类**：一堆类长得像、代码有重复、有共同的成员变量要共享。比如所有 Service 都有 `dataSource` 字段和 `log()` 方法，直接提成一个 `BaseService`。

最常见套路——**模板方法模式**：父类写好流程骨架（"1查数据 → 2校验 → 3写库"），子类只需要填空（"怎么查""怎么校验"）。流程归父类管，细节子类自己写。

**用接口**：完全不同的类，但都需要同一项能力。比如 `User` 和 `Order` 都要"能被比较大小"——都实现 `Comparable`。这两个类八竿子打不着，根本抽不出公共父类，但它们都要"会比较"这个行为。

**两件套**：接口写契约 + 抽象骨架类写默认实现。JDK 集合框架全是这个套路——`List` 接口定规矩，`AbstractList` 骨架类帮你把大部分的活干了，你只要实现 `get(int)` 和 `size()` 两个方法就能搞出一个完整 List。

### JDK 版本演变

- JDK 7 及以前：接口里的方法全是抽象的，没有方法体
- JDK 8：加了 `default` 方法（有实现体）和 `static` 方法。这样给接口加新方法不会搞炸所有实现类——有一份默认实现兜底
- JDK 9：加了 `private` 方法。多个 default 方法之间共享代码用，外面看不到

---

## 15. 重载 (Overload) vs 重写 (Override)

**一句话区分**：重载是"同名不同参"，编译期定；重写是"子类换实现"，运行期定。

### 重载 (Overload) — 同一个类内

方法名相同，参数列表必须不同（类型、个数、或顺序）。返回值可相同可不同，但**只看参数**——光改返回值不算重载，编译器报错。

```java
void log(String msg) { }
void log(String msg, int level) { }  // 个数不同
void log(int code) { }               // 类型不同
void log(String msg, int... args) {} // 可变参数也算
```

编译器看参数就能决定调哪个，所以是**静态绑定**（编译时多态）。

### 重写 (Override) — 父子类之间

子类把父类的方法重新实现一遍。方法签名（方法名 + 参数列表）必须一模一样，三个约束：

- **返回值**：可以是父类返回类型的子类（协变返回），JDK 5 开始支持
- **访问修饰符**：不能比父类更严，父类是 protected 你不能改成 private
- **异常**：不能抛出比父类更宽泛的受检异常

`@Override` 注解强烈建议写上——不是摆饰，是编译器帮你检查到底有没有真的重写。方法名拼错了或者参数类型不对，编译器直接报错。

编译器看到 `animal.sound()` 不知道到底跑 Dog 还是 Cat 的代码，得运行时看实际对象——**动态绑定**（运行时多态）。

### 记忆口诀

- **重载 = 我来选**：编译器看参数签名直接定，同一个类里的事情
- **重写 = 对象说了算**：父类引用指到哪个子类就跑哪个的方法，父子之间的事

---

## 16. Java 是值传递还是引用传递？

**结论：Java 永远是值传递。** 争论的根源在于"值"到底指什么。

### 打个比方

- **基本类型** = 你把试卷**复印**了一份给别人改。他在复印件上涂改，跟你手上的原件没关系
- **引用类型** = 你把钥匙**复制**了一把给别人。他拿复制钥匙开了你家的门、搬了家具，你能看到变化。但你把钥匙熔了重铸成别家钥匙，跟他的复制钥匙没关系

传的是"引用地址"这个值的拷贝，不是对象本身。

### 完整示例

```java
class User {
    String name;
    User(String name) { this.name = name; }
}

static void change(User u) {
    u.name = "lisi";            // 改的是同一对象的属性
}

static void reset(User u) {
    u = new User("zhaoliu");    // 形参指向新对象，不影响实参
}

public static void main(String[] args) {
    User u = new User("zhangsan");
    change(u);
    System.out.println(u.name); // lisi — 属性被改了

    User u2 = new User("wangwu");
    reset(u2);
    System.out.println(u2.name); // wangwu — reset 里的赋值没影响外部引用
}
```

`change` 和 `reset` 的差别很关键：
- `change`：拿到地址拷贝 → 找到同一个堆里的对象 → 改了对象的 `name` 字段 → 外部可见
- `reset`：拿到地址拷贝 → 把**形参本身**改成了新对象的地址 → 外部的 `u2` 还是指向老对象，完全不受影响

### 内存视角：栈和堆

调用 `change(u)` 时发生了什么：

```
调用前:
  栈(main): u → [zhangsan 位于堆]
调用时:
  栈(change): u_copy → [zhangsan 位于堆]   ← u_copy 是 u 的值拷贝，但指向同一个对象
  u_copy.name = "lisi" → 直接改了堆里那个对象
方法返回:
  栈(main): u → [lisi 位于堆]               ← 对象变了
```

调用 `reset(u2)` 时：

```
调用前:
  栈(main): u2 → [wangwu 位于堆]
调用时:
  栈(reset): u_copy → [wangwu 位于堆]       ← 初始指向相同
  u_copy = new User("zhaoliu")
  栈(reset): u_copy → [zhaoliu 位于堆]      ← 拷贝改指向新对象，原对象不动
方法返回:
  栈(main): u2 → [wangwu 位于堆]             ← 完全不受影响
```

关键点：**形参是实参的副本，存在栈的不同位置。** 修改对象属性是顺着地址去堆里改，两边都能看到；修改形参本身只是改了自己那份拷贝，跟实参无关。

### 和 C++ 的区分

C++ 有三种传参方式，Java 只有第一种：

- **C++ 传值** = Java 传参，拷贝
- **C++ 传指针** = 也是拷贝（拷贝了地址），行为上接近 Java 传对象引用
- **C++ 传引用 (`&`)** = 形参和实参**共享同一个变量**，改形参就是改实参——Java 做不到这个

Java 经常被说成"引用传递"是因为它传了地址拷贝，行为像指针。但从语言规范的角度，规范（JLS §8.4.1）明确说"Java 是值传递"。

---

## 17. 包装类与自动装箱/拆箱

- 8 种基本类型对应 8 个包装类：byte→Byte、int→Integer、long→Long ...
- **自动装箱**：`Integer i = 10;` → 编译为 `Integer.valueOf(10)`
- **自动拆箱**：`int j = i;` → 编译为 `i.intValue()`
- Integer 缓存池：`-128 ~ 127` 范围走缓存，== 比较为 true（面试常考）
  ```java
  Integer a = 127, b = 127; // a == b → true（走缓存池）
  Integer c = 128, d = 128; // c == d → false（new 的新对象）
  ```
- 装箱/拆箱发生在泛型集合、方法调用、运算中
- 注意 NPE：`Integer n = null; int x = n;` → NullPointerException

---

## 18. 序列化与反序列化

- **序列化**：将对象转为字节流，便于持久化或网络传输
- **反序列化**：字节流还原为对象
- 实现：实现 `java.io.Serializable` 接口（标记接口）
- `serialVersionUID`：版本控制，保证序列化与反序列化的类兼容性；未显式定义时 JVM 自动计算，可能导致 InvalidClassException
- `transient`：修饰的字段不参与序列化
- `static` 字段：属于类，不参与序列化
- 深拷贝：可通过序列化/反序列化实现（二进制流或 JSON）

---

## 19. 动态代理

- **JDK 动态代理**：
  - 基于接口，`java.lang.reflect.Proxy` + `InvocationHandler`
  - 运行时动态生成代理类（实现被代理接口）
  - 被代理类必须实现至少一个接口
- **CGLIB 动态代理**：
  - 基于继承，通过 ASM 生成目标类的子类
  - 不能代理 final 类和方法
- Spring AOP 整合：
  - 默认 JDK 动态代理（有接口时）
  - 无接口时自动切换 CGLIB
  - Spring Boot 2.x+ 默认使用 CGLIB

---

## 20. 内部类

| 类型 | 定义 | 特点 |
|------|------|------|
| 成员内部类 | 定义在类中，方法外 | 可访问外部类所有成员（包括 private） |
| 静态内部类 | 用 static 修饰 | 只能访问外部类静态成员 |
| 局部内部类 | 定义在方法/代码块中 | 作用域仅限当前方法 |
| 匿名内部类 | new 接口/抽象类直接创建 | 最常用（Lambda 前）：事件监听、线程创建 |

---

## 21. ClassLoader 与双亲委派

- **类加载过程**：加载 → 验证 → 准备 → 解析 → 初始化
- **双亲委派模型**：
  ```
  Bootstrap ClassLoader (加载 jre/lib/rt.jar)
      ↑
  Extension ClassLoader (加载 jre/lib/ext/)
      ↑
  Application ClassLoader (加载 classpath)
      ↑
  自定义 ClassLoader
  ```
- 双亲委派好处：
  - 避免类的重复加载
  - 保证核心 API 不被篡改（如 String 不可能被自定义的同名类替换）
- **打破双亲委派**（需重写 `findClass` 而非 `loadClass`）：
  - JDBC 4.0（SPI 机制）
  - Tomcat WebappClassLoader（隔离多个应用的类）
  - OSGi 模块化

---

## 22. JDK 11 / 17 / 21 新特性速览

**JDK 11 (LTS)**：
- `var` 局部变量类型推断（增强 for 和 Lambda 形参）
- String 新增方法：`isBlank()`、`lines()`、`strip()`、`repeat()`
- `Files.readString()` / `writeString()` 简化文件操作
- HttpClient 标准化（替代 HttpURLConnection）

**JDK 17 (LTS)**：
- **文本块**（正式）：`""" ... """`，告别多行字符串拼接
- **Records**：`record Point(int x, int y) {}`，一行替代 data class
- **Sealed Classes**：`sealed` / `permits` 控制继承范围
- **Pattern Matching for instanceof**：`if (obj instanceof String s)` 一步完成判断 + 转换
- **Switch 表达式**：箭头语法 `case X ->`，可返回值，无穿透问题
- NPE 提示增强：明确哪个变量为 null

**JDK 21 (LTS)**：
- **虚拟线程 (Virtual Threads)**：轻量级线程，高并发低开销
- **Record Patterns**：解构 Record 类型
- **Pattern Matching for switch**：更强大的模式匹配 switch
- **Sequenced Collections**：统一 List/Set/Deque 的顺序操作接口

> 面试中 JDK 17 的特性最常被问到，建议重点掌握 Records、Sealed Classes、文本块和增强 switch 四项。
