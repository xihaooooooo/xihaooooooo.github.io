# Spring 框架

---

## 1. IOC 与 DI

### 1.1 没有 IOC 之前

在没有 IOC 的世界里，每个对象负责创建自己需要的依赖。比如 `UserService` 需要 `UserRepository`：

```java
public class UserService {
    private UserRepository repo = new UserRepositoryImpl();
}
```

这带来三个问题：一是对象的创建逻辑散落在各个角落，换一个实现要改所有 new 的地方；二是类之间强耦合在具体实现上，单测没法 mock；三是对象生命周期管理混乱——谁负责释放、怎么复用、如何控制数量，全靠开发者自觉。

### 1.2 IOC 解决了什么

**IOC（控制反转）**：将"对象创建和依赖关系管理"的控制权从业务代码手中，反转给 Spring 容器。现在 `UserService` 不需要知道 `UserRepository` 怎么来的：

```java
public class UserService {
    private final UserRepository repo;  // 不再 new

    public UserService(UserRepository repo) {  // 容器把依赖送进来
        this.repo = repo;
    }
}
```

反转的关键是，过去你调用组件时是自己去 new 依赖（主动控制），现在你声明需要什么依赖，容器主动注入给你（被动接收）。控制权从调用方转到了框架方。

### 1.3 DI（依赖注入）—— IOC 的实现方式

IOC 是思想，DI 是落地手段。容器不光创建对象，还在创建过程中把该对象需要的依赖主动塞给它。三种注入方式：

**构造器注入（推荐）**：依赖通过构造函数传入，声明为 final 字段。对象一旦创建完成就是完整可用的，不存在"半成品"状态。当构造参数超过 5 个时，应该拆分类或引入设计模式——构造参数多到写不下，说明类本身的职责太多了。

**setter 注入**：通过 setter 方法注入可选依赖。对象可以先以不完整状态存在，后续通过 setter 覆盖或追加。适合依赖不是必需项的场景（如"有日志框架注入就输出，没有就不输出"），但存在一个窗口期——对象已创建但 setter 还没被调用时，如果被其他线程访问，可能拿到空依赖。

**字段注入（`@Autowired` 在字段上）**：最简洁，但代价最高。一是单元测试必须用反射框架（Mockito 的 `@InjectMocks` 本质上就是反射注入），纯 Java 代码无法 mock；二是隐藏了类的依赖数量——一个类有 10 个 `@Autowired` 字段肉眼难以察觉，但构造参数列表 10 个就非常扎眼；三是不能声明为 final，字段在构造方法执行后、容器注入前为 null，对象生命周期内可以被随时随地修改。

### 1.4 容器如何找到 Bean

Spring 通过两种方式知道"哪些类该被管理"：

**① 直接注册**：在 `@Configuration` 类中用 `@Bean` 方法显式声明。每个 `@Bean` 方法对应一个 Bean，方法名默认就是 Bean 名称。适合需要自定义实例化逻辑的场景（如第三方库对象、连接池配置）。

**② 自动扫描**：`@ComponentScan` 扫描指定包路径下带 `@Component`/`@Service`/`@Repository`/`@Controller` 的类，自动注册到容器中。Spring Boot 默认扫描启动类所在包及其子包。

两种方式的本质一样：最终都是往容器中注册一个 Bean 定义（BeanDefinition），包含类名、作用域、依赖项、初始化/销毁回调等信息。Bean 的实例化可以懒惰（BeanFactory）也可以急切（ApplicationContext）。

### 1.5 IOC 容器体系

Spring 中两个核心容器接口：

- **BeanFactory**：最底层的 Bean 容器，延迟加载——调用 `getBean()` 时才创建实例。适合资源敏感环境（如移动端、小内存设备）。
- **ApplicationContext**：在 BeanFactory 基础上扩展了 AOP、国际化、事件发布、环境变量等功能。启动时预初始化所有单例 Bean（"启动慢，运行快"），日常开发 99.9% 用的是这个。

从代码角度，IOC 容器的本质是一个巨大的 ConcurrentHashMap —— key 是 Bean 名称（`userService`），value 是该名称下所有作用域中单例的那个实例。当你 `getBean("userService")` 时，它从这个 Map 中取。它和普通 Map 的区别在于它还管理了 Bean 的生命周期、作用域和依赖关系。

---

## 2. Bean 生命周期

```
实例化 → 属性赋值 → Aware 接口（BeanNameAware → BeanFactoryAware → ApplicationContextAware）
→ BeanPostProcessor#postProcessBeforeInitialization
→ @PostConstruct → InitializingBean#afterPropertiesSet → 自定义 init-method
→ BeanPostProcessor#postProcessAfterInitialization
→ 容器中就绪
→ @PreDestroy → DisposableBean#destroy → 自定义 destroy-method → 销毁
```

### 阶段拆解

**① 实例化**：Spring 调用 Bean 的构造方法创建对象实例。此时对象还是个空壳——所有字段都是默认值（null、0、false）。如果使用构造器注入，构造方法的参数此时已经被容器解析好并传入（因为 Spring 先完成了依赖 Bean 的创建才调构造器）。

**② 属性赋值**：`@Autowired`、`@Value` 等注解标注的字段和 setter 方法被 Spring 反射调用，注入依赖。注意字段注入的时机就在此处——对象已经存在了，但属性还是 null，Spring 在此刻把值塞进去。此阶段完成后，所有注入的依赖已经就位。

**③ Aware 回调（感知容器）**：如果 Bean 实现了一系列 Aware 接口，Spring 会依次回调它们。它们的共同目的是**让 Bean 感知到容器本身的存在和它自己的身份**：
- `BeanNameAware.setBeanName(name)`：知道自己叫什么名字（`userService`）
- `BeanFactoryAware.setBeanFactory(factory)`：获得创建自己的 BeanFactory 引用
- `ApplicationContextAware.setApplicationContext(ctx)`：获得更上层的 ApplicationContext
- 还有 `EnvironmentAware`、`ResourceLoaderAware`、`MessageSourceAware` 等

注：Aware 是一种单向侵入——Bean 代码与 Spring 框架耦合了。绝大多数场景不需要，仅在需要容器级能力（获取所有 Bean、发布事件）且不想注入 ApplicationContext 时使用。

**④ BeanPostProcessor#postProcessBeforeInitialization**：这里是最关键的可扩展点。Spring 在调用每一个 Bean 的初始化方法**之前**，先让所有注册的 `BeanPostProcessor`（BPP）过一遍。BPP 可以返回原始 Bean，也可以返回一个包装后的代理对象。AOP 的 `@Async`、`@Transactional` 等增强都是在这一步或下一步通过 BPP 完成的。

**⑤ 初始化**：三个回调按顺序执行——`@PostConstruct` 最早，`InitializingBean.afterPropertiesSet()` 其次，`init-method`（XML 或 `@Bean(initMethod=...)`）最后。这一阶段的作用是让 Bean 在依赖全部就位后执行自己的启动逻辑（如校验配置、预热缓存、初始化连接等）。三个回调的效果等价，区别在于来源不同：注解来自 JDK（javax → Jakarta）、InitializingBean 来自 Spring 接口、init-method 来自 XML/@Bean 声明。

**⑥ BeanPostProcessor#postProcessAfterInitialization**：BPP 再次执行，这次是初始化**之后**。这里是 Spring AOP 真正生成代理对象的地方——`AnnotationAwareAspectJAutoProxyCreator`（一个 BPP 的子类）在此时检查 Bean 是否需要被切面增强，如果需要就生成 JDK 动态代理或 CGLIB 代理对象替代原始 Bean。这也是为什么你从容器拿到的 Bean 有时候不是你定义的类的实例，而是一个代理对象。

**⑦ 就绪**：Bean 完整就绪，放入一级缓存（singletonObjects），等待被使用。

**⑧ 销毁**：容器关闭时依次回调——`@PreDestroy` → `DisposableBean.destroy()` → `destroy-method`。用于释放连接、关闭线程池、写入缓存等清理工作。注意 prototype 作用域的 Bean 销毁回调**不会被 Spring 调用**——Spring 创建完 prototype Bean 后就彻底"忘记"它了，清理由调用方自己负责。

### 生命周期中最重要的扩展点

`BeanPostProcessor` 是 Spring 留给框架层的核心钩子。Spring 内部大量的功能都是用 BPP 实现的：AOP 的代理创建、`@Autowired` 依赖注入、`@Value` 属性解析、`@Async` 异步包装、`@Transactional` 事务切面。本质上是 Spring 自己吃自己的狗粮——BPP 是暴露给框架开发者用的，普通业务代码几乎不需要直接实现它。

---

## 3. 三级缓存解决循环依赖

### 为什么需要三级缓存

循环依赖的场景：A 依赖 B，B 依赖 A。Spring 创建 A 时需要注入 B，于是去创建 B；B 又需要注入 A——如果不做特殊处理，就死锁了。

解决的思路是**"提前暴露一个半成品"**：先把 A 实例化（还没注入依赖），把它的引用暴露到一个缓存中；然后去创建 B，B 需要 A 时从缓存中取出这个半成品 A 先注入；等 B 建完，再回过头把 B 注入到 A 中。这样就打断了死锁。

### 三级缓存架构

```
┌─────────────────────────────────────────────┐
│ singletonObjects（一级缓存）                  │
│   └── 完全初始化好的 Bean                     │
│        ↑                                    │
│ earlySingletonObjects（二级缓存）             │
│   └── 早期暴露的 Bean（未完成属性注入、未执行代理）│
│        ↑                                    │
│ singletonFactories（三级缓存）                │
│   └── ObjectFactory 回调（可返回原始或代理对象） │
└─────────────────────────────────────────────┘
```

**三级缓存各自承担的职责**：

- **singletonObjects（一级）**：保存已经完全初始化好的、可以直接使用的单例 Bean。`getBean()` 最终返回的一定是一级缓存中的 Bean。
- **earlySingletonObjects（二级）**：保存从三级缓存提前暴露出来的、还没注入完属性的 Bean。同名的 Bean 在二级缓存和一级缓存中只存在一个——初始化完成后从二级移入一级。
- **singletonFactories（三级）**：保存的不是 Bean 本身，而是一个 `ObjectFactory` 回调函数。这个回调可以返回 Bean 的原始对象，也可以在必要时生成 AOP 代理对象后再返回。

### 完整流程（A 和 B 循环依赖）

1. A 实例化（构造方法执行完毕），此时只是一个光板对象，属性都还没填
2. A 把自己包装成 ObjectFactory，放入三级缓存。这个 ObjectFactory 的作用是：如果后面有人需要 A 的早期引用，它可以决定是返回原始 A 还是 A 的代理对象
3. A 开始填充属性，发现依赖 B → 触发 `getBean(B)`
4. B 实例化 → 把自己包装成 ObjectFactory 放入三级缓存
5. B 开始填充属性，发现依赖 A → 触发 `getBean(A)`
6. **关键步骤**：在三级缓存中找到了 A 的 ObjectFactory → 调 ObjectFactory 获取 A 的早期引用 → **如果有 AOP 代理需求，此时生成代理对象；否则直接返回原始 A** → 将 A 的早期引用放入二级缓存，同时从三级缓存中删除 A 的 ObjectFactory
7. B 拿到 A 的早期引用完成注入，走完初始化，最终进入一级缓存
8. A 拿到 B 的完整引用完成注入，走完初始化，从二级缓存移入一级缓存
9. 两个 Bean 都创建完毕

### 为什么是三级而不是两级

如果只需要一个"半成品缓存"，两级就够了——做完构造方法扔进去，别人需要时取出来。但有两个问题：

**问题一：代理对象的时机**。Spring 的 AOP 代理是在 Bean 初始化阶段（`BeanPostProcessor#postProcessAfterInitialization`）创建的。如果只有两级缓存——实例化后就扔进去，那么取出来的是原始对象，而最终暴露给容器的应该是代理对象。A 依赖 B 时，B 拿到了原始 A，而容器里最终放的是代理 A，两者不一致，AOP 失效。

**问题二：代理对象应该只创建一次**。如果多个 Bean 都需要 A 的早期引用，每个都应该拿到同一个代理对象，而不是生成多个不同的代理。

三级缓存中的 ObjectFactory 完美解决了这两个问题：它延迟到"有人真的需要 A 的早期引用"时才决定调用什么逻辑（是否代理），且生成的代理对象放入二级缓存后，下次其他 Bean 来拿直接走二级缓存，保证全局唯一。

### 为什么构造器注入循环依赖无法解决

构造器注入时，A 的构造参数是 B，B 的构造参数是 A——两边连对象都创建不了，更不用说提前暴露。三级缓存的依赖前提是实例化和属性填充可以分离——先实例化（放在缓存里），再填充属性（从缓存里拿别人）。构造器注入要求构造时依赖就必须就位，没有"半成品"的阶段。

### 原型 Bean 为什么也不行

原型 Bean 在 Spring 里不缓存——每次 `getBean()` 都创建新实例。如果 A 和 B 都是原型，A 创建时需要 B → B 创建时需要 A → 无限循环。Spring 检测到原型循环依赖直接抛 `BeanCurrentlyInCreationException`。

---

## 4. Spring AOP

### 两种代理方式

| | JDK 动态代理 | CGLIB |
|--|-------------|-------|
| 机制 | InvocationHandler + Proxy.newProxyInstance() | ASM 生成子类字节码 |
| 要求 | 必须实现接口 | 不能代理 final 类/方法 |
| Spring 默认 | 1.x 默认 | 2.0+ 默认（有接口也用 CGLIB） |

**JDK 动态代理的底层**：`Proxy.newProxyInstance(classLoader, interfaces, invocationHandler)` 在运行时动态生成一个实现了所有接口的代理类。代理类实现了接口中的所有方法，每个方法的实现就是调用 `InvocationHandler.invoke()`，在这个 invoke 方法里织入增强逻辑，然后通过反射调用目标对象上的同名方法。调用链是：调用方 → 代理.invoke → 增强逻辑 → 反射调用真实目标方法。

**CGLIB 的底层**：CGLIB 使用 ASM 字节码框架在运行时直接生成目标类的一个子类，这个子类覆盖了目标类所有非 final 的 public 方法。每个覆盖的方法在实现中插入增强逻辑，然后通过 `super.xxxMethod()` 调用父类的原始方法。因为 CGLIB 走的是继承，所以 final 方法和 final 类不能被代理。构造方法调用也会触发两次——一次是生成代理对象自己的构造，一次是父类目标对象的初始化。

**Spring Boot 2.x 默认选择 CGLIB**：`spring.aop.proxy-target-class=true` 是默认值。CGLIB 可以拦截所有非 final 的 public 方法，不受接口限制。唯一的代价是 final 方法不能被代理。

**两者同存时**：如果一个 Bean 同时实现了接口，Spring 可以选 JDK 代理也可以选 CGLIB。容器中拿到代理后，想强转为具体实现类就会失败（JDK 代理根本就不是那个类的子类），强转接口都 OK。所以依赖注入时接受方应该用接口类型而不是具体类类型，这也是为什么 Spring 推荐面向接口编程。

### 五种 Advice 执行顺序

当一个方法被一条切面包含了多个 Advice 时，它们在调用链上的执行顺序是固定的（只讨论同一切面内）：

```
Around（前） → Before → 目标方法执行 → Around（后） → After → AfterReturning/AfterThrowing
```

- **@Around**：最强，完全控制目标方法的调用。必须显式调 `ProceedingJoinPoint.proceed()`，可以改入参、改返回值、捕获异常。适合性能统计（记录执行时间）、缓存（命中就不调 proceed）、分布式锁（拿到锁才 proceed）。
- **@Before**：目标方法执行前触发。不能改入参，不能阻止目标方法执行。适合参数校验、权限检查（通过抛异常阻止）。
- **@AfterReturning**：目标方法正常返回后才触发（不抛异常）。能拿到返回值但不能改。适合日志、收尾工作。
- **@AfterThrowing**：目标方法抛异常才触发。可以拿到异常信息。适合错误日志、告警。
- **@After**：无论正常返回还是异常都触发（类似 finally）。适合释放资源、清理上下文。

### Pointcut 表达式

最常用的三种切入点指示符：

- **`execution`**：最常用。`execution(修饰符 返回值 包.类.方法(参数))`。示例 `execution(* com.example.service.*.*(..))` 表示 service 包下所有类的所有方法。通配符 `*` 匹配一个词，`..` 匹配零到多层包或任意参数。
- **`@annotation`**：按注解匹配。`@annotation(com.example.Log)` 表示标记了 @Log 注解的所有方法。配合自定义注解非常灵活。
- **`within`**：按类匹配。`within(com.example.service.*)` 表示 service 包下所有类的所有方法。与 execution 的区别是 within 只看类层级，不关心返回值和方法名。

可以有 `&&`、`||`、`!` 操作符组合多个表达式：`execution(* com.example..*.*(..)) && !execution(* com.example..*.*Test(..))`。

### 多个切面的执行顺序

当两个不同的 Aspect 同时拦截到同一个方法时，它们以"同心圆"的方式嵌套执行：

```
@Order(1) 的 Around（前） → @Order(2) 的 Around（前） → 目标方法 → @Order(2) 的 Around（后） → @Order(1) 的 Around（后）
```

通过 `@Order(N)` 或实现 `Ordered` 接口控制优先级。N 越小越靠外（先执行前、后执行后），类似同心圆的洋葱模型。`@Transactional` 用 `@Order` 控制事务在最外层，保证异常 → AOP 处理 → 事务回滚的顺序正确。

### Spring AOP vs AspectJ

| | Spring AOP | AspectJ |
|---|-----------|---------|
| 织入时机 | 运行期（通过代理） | 编译期/类加载期（修改字节码） |
| 代理方式 | JDK 动态代理 / CGLIB | 直接修改 class 字节码 |
| JoinPoint 范围 | 仅方法执行 | 方法执行 + 构造方法 + 字段访问 + 异常处理 + ... |
| 性能 | 代理调用有反射/拦截开销 | 编译后与普通调用几乎无差别 |
| 使用成本 | 零——Spring Boot 原生支持 | 需要额外的 aspectj-maven-plugin 或加载时织入的 -javaagent |

Spring AOP 不是要替代 AspectJ，而是覆盖 95% 的 AOP 场景（且 0 额外成本）。需要对方法以外的点织入、或对性能要求极高时，用 AspectJ。

### AOP 应用场景

日志、事务、权限校验、限流、性能统计

---

## 5. @Transactional 失效场景（高频）

**① 方法非 public**：Spring 的声明式事务本质上也是 AOP——通过 CGLIB 或 JDK 动态代理生成代理对象，在代理中开启/提交/回滚事务。Java 的代理机制决定了：JDK 动态代理只代理接口方法（自然是 public）；CGLIB 生成的子类不能覆盖父类的 private/protected/default 方法（只有 public 能被覆盖）。所以 @Transactional 加在 private/protected/default 方法上，代理看不到，注解白加。

**② 同类内部调用 `this.method()`**：这是最高频的踩坑。`this` 指向的是原始对象本身，不是 Spring 托管的代理对象。直接调 `this.method()` 时，这次调用不经过代理，事务切面根本收不到信号。解决方式：把需要事务的方法放在另一个 Bean 里注入进来调、或者通过 `AopContext.currentProxy()` 拿到当前类的代理再调、或把 @Transactional 加在入口方法上让整个方法链在一个事务里。

**③ 异常被 catch 吞掉**：Spring 事务管理器的回滚逻辑是：方法执行过程中如果抛出了异常（并且未被捕获），事务管理器抓到异常后执行回滚。如果代码里 catch(Exception e) { log.error(e); } 然后把异常吞了没再抛出去，上层事务管理器认为一切正常，提交事务。如果需要事务回滚，要么不 catch，要么 catch 之后手动设置回滚：`TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`。

**④ rollbackFor 设置错误**：`@Transactional` 默认只回滚 RuntimeException（运行时异常）和 Error，对于 checked 异常（IOException、SQLException 等）不回滚。当一个检查性异常被抛出，Spring 仍然提交事务。需要回滚 checked 异常时必须指定 `@Transactional(rollbackFor = Exception.class)`。

**⑤ 数据库引擎不支持事务**：MySQL 中 MyISAM 引擎不支持事务。操作 MyISAM 表时，出错了数据直接写在磁盘上了，没有回滚这回事。确认业务表引擎为 InnoDB。

**⑥ 多线程**：Spring 的事务上下文绑定在当前线程的 `ThreadLocal` 中。如果方法内部开了 `new Thread()` 或提交给线程池去处理数据，新线程没有当前事务的连接和上下文，子线程的操作不在本事务中，出问题不回滚。

**⑦ propagation 设置不当**：`propagation = Propagation.NEVER` 会在已有事务时抛异常；`propagation = NOT_SUPPORTED` 会在已有事务时将其挂起，当前方法以非事务执行，出错不回滚，且会污染后续流程的事务状态。

**⑧ 方法被 final 修饰（易漏）**：CGLIB 通过生成子类来创建代理，final 方法子类无法覆盖，代理无法织入事务逻辑。这个和"非 public"是同类问题但更隐蔽。

**⑨ 事务管理器未指定或数据源未配置事务管理器**：Spring Boot 自动配置了一个 DataSourceTransactionManager，但如果手动配了多数据源，必须明确指定哪个数据源走哪个事务管理器（`@Transactional(transactionManager = "xxxTxManager")`），否则可能根本没有事务。

---

## 6. Spring 事务传播行为

| 传播行为 | 说明 |
|----------|------|
| REQUIRED | 有则加入，无则创建（**默认**） |
| REQUIRES_NEW | 总是新建，挂起当前事务 |
| SUPPORTS | 有则加入，无则非事务 |
| NOT_SUPPORTED | 非事务执行，挂起当前事务 |
| MANDATORY | 必须有事务，否则抛异常 |
| NEVER | 必须无事务，否则抛异常 |
| NESTED | 嵌套事务（保存点机制，外层回滚影响内层） |

**REQUIRED（默认）**：99% 场景用它。如果当前方法已经在事务中，就加入；如果没有，就创建一个新事务。典型场景：Service 层方法 A（有事务）调用 Service 层方法 B（REQUIRED），B 加入 A 的事务，A 和 B 一起成功一起回滚。这是"整体只允许有一个事务"的语义。

**REQUIRES_NEW**：无论如何都新建一个独立的子事务，当前事务（如果有）被挂起。新事务的提交和回滚完全不依赖外层事务——外层抛异常，内层新事务照样提交；内层抛异常如果没能传播到外层，外层照样提交。典型场景："记录日志"——即使主业务回滚了，日志也要落库保留。

**REQUIRED vs REQUIRES_NEW 的常见坑**：REQUIRES_NEW 看似简单，但"挂起当前事务"意味着数据库连接被占用着等待——如果内层事务执行很久（调外部接口等），连接池可能被撑爆。REQUIRES_NEW 需要独立的数据库连接（或者说两笔事务不能共用一个连接），连接消耗翻倍。

**NESTED（嵌套事务）**：与 REQUIRES_NEW 不同——它不创建完全独立的事务，而是在当前事务内创建一个**保存点（Savepoint）**。内层回滚只回退到保存点（内层的修改撤销），外层的修改不受影响。外层回滚会把整个事务（内层 + 外层）全部回滚。NESTED 和 REQUIRES_NEW 的核心区别：NESTED 内外事务不是独立的（外层回滚内层也死），REQUIRES_NEW 内外事务是完全独立的两笔。注意：NESTED 只在 JDBC 的 Savepoint 机制可用时才生效（JPA/Hibernate 不支持）。

**MANDATORY / NEVER**：防御性注解。MANDATORY 用在"这个方法必须在别人开启的事务中调用，单独调就是 bug"的场景。NEVER 用在"这个方法绝不能被事务包裹，否则会有问题"的场景（如某些数据库 DDL 操作在事务中行为异常）。

**SUPPORTS / NOT_SUPPORTED**：SUPPORTS 适合"可选的"——在事务中就在事务中，不在也无所谓。NOT_SUPPORTED 是"强制的非事务"——如果外层在事务中，先挂起外层事务，当前方法以非事务方式执行。

---

## 7. BeanFactory vs ApplicationContext

| | BeanFactory | ApplicationContext |
|--|-------------|-------------------|
| 加载方式 | 延迟加载 | 启动时预初始化单例 Bean |
| 功能 | 基础的 DI | 完整：AOP、事件、国际化、环境变量 |
| 资源占用 | 轻量、内存小 | 启动慢，运行时快 |
| 使用 | 资源敏感（移动端） | 企业应用（常规） |

---

## 8. Spring Boot 自动配置原理

### 自动配置的三个问题

自动配置要解决三个问题：**配什么**（哪些类需要自动配置）、**什么时候配**（条件满足才配置，避免不必要的加载）、**怎么配**（如何正确注入 Bean）。

```
@SpringBootApplication
  └── @EnableAutoConfiguration
       └── @Import(AutoConfigurationImportSelector.class)
            └── 读取 spring.factories / META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
                 └── 按 @Conditional 系列注解过滤
                      └── 注入匹配的自动配置类
```

**第一步——找到候选配置**：Spring Boot 2.x 通过 `META-INF/spring.factories` 文件（`org.springframework.boot.autoconfigure.EnableAutoConfiguration` 键值对），Spring Boot 3.x 改用 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 文件。每个自动配置 starter（如 `spring-boot-starter-web`）携带自己的 imports 文件，列出了它的所有自动配置类。

**第二步——条件过滤**：候选类有几十上百个，不能全加载。每个自动配置类上都标有 `@Conditional` 系列注解，按条件筛选。比如 `DataSourceAutoConfiguration` 上标 `@ConditionalOnClass(DataSource.class)`，只有 classpath 存在 `DataSource` 类时才会被加载——而 `DataSource` 类通常由 `spring-boot-starter-jdbc` 引入。

**第三步——注入 Bean**：通过筛选的自动配置类中以 `@Bean` 定义具体组件，并用 `@ConditionalOnMissingBean` 兜底——如果用户自己定义了同类型的 Bean，自动配置就退让。

### 常见 Condition 注解

- **`@ConditionalOnClass`**：Classpath 有指定类时才加载。这是最常用的，决定了"引了哪个 starter 就配哪块"。
- **`@ConditionalOnMissingBean`**：容器中无指定 Bean 时才加载。给了用户覆盖能力——你自己定义的同类型 Bean 优先。
- **`@ConditionalOnProperty(prefix = "xxx", name = "enabled")`**：配置文件有指定属性、且值匹配时才加载。比如 `spring.datasource.enabled=false` 可以关掉数据源自动配置。
- **`@ConditionalOnBean`**：容器中有指定 Bean 时才加载。用于"甲配置依赖乙配置"的场景。
- **`@ConditionalOnMissingClass`**：Classpath 无指定类时加载（回退方案）。

---

## 9. Spring MVC 请求处理流程

```
DispatcherServlet
  → HandlerMapping（找到 Controller）
    → HandlerAdapter（执行）
      → Controller（业务逻辑）
        → ViewResolver（解析视图）
          → 返回响应
```

**逐步解析**：

1. **DispatcherServlet 接收请求**：它是 Spring MVC 的总调度入口，所有 HTTP 请求最先到达这里。本质是一个 Servlet，在 Web 容器启动时就初始化好了。

2. **HandlerMapping 查找处理器**：根据请求的 URL、HTTP Method 等信息，从注册的映射表中找到对应的 Controller 方法。常见的 `@GetMapping("/users/{id}")` 最后就是被 `RequestMappingHandlerMapping` 注册并在此处查找的。

3. **HandlerAdapter 执行**：找到处理方法后，适配器负责调用它。`RequestMappingHandlerAdapter` 处理 `@RequestMapping` 注解的方法，自动完成参数绑定（`@RequestParam`、`@PathVariable`）、参数转换（HttpMessageConverter，如 JSON → Java 对象）、参数校验（`@Valid`）。

4. **Controller 执行业务逻辑**：返回 `ModelAndView` 对象（或直接返回 JSON 数据，此时 `@RestController` = `@Controller` + `@ResponseBody`）。

5. **ViewResolver 解析视图**：如果返回视图名（如 `"welcome"`），ViewResolver 找到对应的模板文件（JSP、Thymeleaf），结合 Model 数据渲染成 HTML。RESTful 接口中这一步被跳过——数据通过 `HttpMessageConverter` 直接序列化为 JSON 写入响应体。

6. **返回响应**：DispatcherServlet 将最终的渲染结果或 JSON 数据返回给客户端。

---

## 10. Spring Bean 作用域

| 作用域 | 说明 |
|--------|------|
| singleton | 单例，**默认** |
| prototype | 每次获取新建 |
| request | 每次 HTTP 请求新建 |
| session | 每个 HTTP Session 一个 |
| application | ServletContext 级别 |

---

## 11. @Autowired vs @Resource

| | @Autowired | @Resource |
|--|------------|-----------|
| 来源 | Spring | JDK（javax.annotation） |
| 注入方式 | 默认 byType | 默认 byName |
| 配合 | @Qualifier 指定名称 | name 属性 |
| required | ✅ 默认 true | 无此属性 |
