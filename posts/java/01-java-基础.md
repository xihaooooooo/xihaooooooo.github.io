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

- 运行时动态获取类信息、创建对象、调用方法，打破编译期限制

```java
// 拿到字节码对象
Class<?> clz = Class.forName("com.example.User");
// 反射创建对象
Object obj = clz.getDeclaredConstructor().newInstance();
// 暴力访问私有字段
Field field = clz.getDeclaredField("name");
field.setAccessible(true);
field.set(obj, "反射设的值");
```

- 核心类：`Class`、`Constructor`、`Method`、`Field`
- 应用：Spring IOC 依赖注入、AOP 动态代理、注解处理器、ORM 字段映射、JDBC 驱动加载
- 缺点：
  - 性能开销（编译器没法优化，比直接调用慢几十倍）
  - **破坏封装**：`setAccessible(true)` 可跳过访问权限检查
  - 编译期无法检查，错误推迟到运行期

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

---

## 11. HashMap 底层原理（高频）

- **JDK 1.7**：数组 + 链表，头插法（扩容时死循环）
- **JDK 1.8+**：数组 + 链表 + **红黑树**
  - 链表长度 ≥ 8 且数组长度 ≥ 64 → 链表转红黑树
  - 红黑树节点数 ≤ 6 → 退化回链表
- **put 流程**：
  1. 计算 key 的 `hashCode()` 高 16 位与低 16 位异或（扰动函数，降低碰撞）
  2. `(n-1) & hash` 定位数组下标
  3. 无冲突 → 直接插入；有冲突 → 链表/红黑树处理
  4. 超过阈值（容量 × 负载因子）→ 扩容（2 倍），rehash
- **扩容机制 (resize)**：
  - 1.7：重新计算所有元素位置
  - 1.8：利用高位 bit 判断（原位置或原位置 + 旧容量），更快
- **负载因子 0.75 的考虑**：空间利用率与查询效率的折中
- **为什么容量是 2 的幂次**：`(n-1) & hash` 等价于 `hash % n`，位运算更快
- **线程不安全**：扩容期间数据丢失 / 死循环；可用 `ConcurrentHashMap`

---

## 12. ArrayList vs LinkedList

| | ArrayList | LinkedList |
|--|-----------|------------|
| 底层 | Object[] 数组 | 双向链表 |
| 随机访问 O(1) | 通过下标直接定位 | 需要遍历，O(n) |
| 插入/删除 | 尾部快，中间需搬移 O(n) | 找到位置后只需改指针 O(1) |
| 内存 | 连续空间，浪费少 | 每个节点多存两个指针 |
| 实现 | RandomAccess 接口（标记，遍历时优先 for 循环） | 未实现 |
| 适用 | 查多改少 | 改多查少 |

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

| | interface | abstract class |
|--|-----------|----------------|
| 关键字 | interface | abstract class |
| 方法 | JDK8+ 可有 default/static 方法 | 可有抽象方法 + 具体方法 |
| 变量 | 只能是 public static final 常量 | 可声明成员变量 |
| 继承 | 可实现多个接口（多继承） | 只能继承一个抽象类 |
| 构造器 | 无 | 有，供子类调用 |
| 语义 | is-like-a（行为契约） | is-a（模板模式） |

设计理念：**接口是行为的抽象，抽象类是类的抽象。**

---

## 15. 重载 (Overload) vs 重写 (Override)

| | 重载 | 重写 |
|--|------|------|
| 发生位置 | 同一个类中 | 父子类之间 |
| 参数列表 | **必须不同**（类型/个数/顺序） | 必须相同 |
| 返回类型 | 可不同 | 相同或子类型（协变返回） |
| 访问修饰符 | 无限制 | 不能比父类更严格 |
| 异常 | 无限制 | 不能抛出更宽泛的受检异常 |
| 绑定时机 | 编译期（静态绑定） | 运行期（动态绑定） |
| 多态体现 | 编译时多态 | 运行时多态 |

---

## 16. final、finally、finalize

- **final**
  - 类 → 不能被继承（如 String、Integer）
  - 方法 → 不能被重写
  - 变量 → 基础类型值不可变，引用类型地址不可变（内容可变）
- **finally**
  - try-catch-finally 中，无论是否异常都会执行
  - 唯一不执行的情况：try 中调用 `System.exit(0)`
  - 若 finally 中有 return，会覆盖 catch 中的 return
- **finalize**
  - Object 类方法，GC 回收对象前调用一次
  - JDK 9 已标记为 `@Deprecated`，不建议使用（执行时机不确定）

---

## 17. Java 是值传递还是引用传递？

- **Java 是值传递（pass by value）**
- 基础类型：传值的拷贝，方法内修改不影响原变量
- 引用类型：传引用**地址的拷贝**，方法内修改对象属性会影响原对象；但让引用指向新对象不会影响原引用

```java
public static void main(String[] args) {
    User u = new User("zhangsan");
    change(u);
    System.out.println(u.name); // lisi — 修改了原对象属性

    User u2 = new User("wangwu");
    reset(u2);
    System.out.println(u2.name); // wangwu — 引用指向新对象，不影响原引用
}
```

---

## 18. 包装类与自动装箱/拆箱

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

## 19. 序列化与反序列化

- **序列化**：将对象转为字节流，便于持久化或网络传输
- **反序列化**：字节流还原为对象
- 实现：实现 `java.io.Serializable` 接口（标记接口）
- `serialVersionUID`：版本控制，保证序列化与反序列化的类兼容性；未显式定义时 JVM 自动计算，可能导致 InvalidClassException
- `transient`：修饰的字段不参与序列化
- `static` 字段：属于类，不参与序列化
- 深拷贝：可通过序列化/反序列化实现（二进制流或 JSON）

---

## 20. 动态代理

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

## 21. 内部类

| 类型 | 定义 | 特点 |
|------|------|------|
| 成员内部类 | 定义在类中，方法外 | 可访问外部类所有成员（包括 private） |
| 静态内部类 | 用 static 修饰 | 只能访问外部类静态成员 |
| 局部内部类 | 定义在方法/代码块中 | 作用域仅限当前方法 |
| 匿名内部类 | new 接口/抽象类直接创建 | 最常用（Lambda 前）：事件监听、线程创建 |

---

## 22. ClassLoader 与双亲委派

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

## 23. JDK 11 / 17 / 21 新特性速览

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
