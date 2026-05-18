# Spring 框架

---

## 1. IOC 与 DI

- **IOC（控制反转）**：将对象的创建和管理权交给 Spring 容器。以前你手动 `new XxxService()`，现在 Spring 帮你 new 好了装到容器里，你要用的时候去拿就行。"反转"指的是控制权从你手里转到了容器手里。
- **DI（依赖注入）**：IOC 的实现方式。容器不光创建对象，还把对象需要的依赖主动塞给它，而不是对象自己去创建依赖。三种注入方式：
  - **构造器注入**（推荐）：依赖不可变（final 字段），创建完就是完整对象，不存在半成品状态。Spring 官方推荐。
  - **setter 注入**：可选依赖用 setter，创建后仍可通过 setter 覆盖。灵活性高但对象存在"不完整"窗口期。
  - **`@Autowired` 注解注入**：反射到字段上，代码最简短，但难以写单元测试（需要反射注入 mock），且掩盖了构造函数参数过多的设计问题。
- **循环依赖**：A 依赖 B，B 依赖 A。构造器注入的循环依赖无解；setter 注入的单例循环依赖靠三级缓存解决。

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

**选择逻辑**：Spring 1.x 默认 JDK 动态代理（有接口时），但 JDK 代理只能代理接口方法，局限性很大——如果目标类有不在接口中的 public 方法，这些方法不能被代理增强。Spring Boot 2.x 起统一使用 CGLIB（即使有接口——`spring.aop.proxy-target-class=true` 是默认值），因为 CGLIB 可以拦截所有非 final 的 public 方法。唯一的代价是 CGLIB 不能代理 final 方法和 final 类（final 类不可继承）。

**Around Advice 的执行模型**：Around 是功能最强的 Advice，同时包围目标方法的调用。通过 `ProceedingJoinPoint.proceed()` 显式调目标方法——忘记调 `proceed()` 意味着目标方法永远不会执行（也没有结果返回）。Around 的执行顺序：前处理 → proceed() → 目标方法执行 → 后处理。异常在 proceed() 处抛出，可以用 try-catch 包裹。

### 核心概念

- **JoinPoint**：连接点（所有可能被增强的方法）。目标类中每个方法都是一个 JoinPoint。
- **Pointcut**：切入点（实际增强的方法）。通过表达式（`execution(* com.example..*Service.*(..))`）从所有 JoinPoint 中筛选出需要增强的。
- **Advice**：增强逻辑（Before / After / Around / AfterReturning / AfterThrowing）
- **Aspect**：切面 = Pointcut + Advice。把它们绑定在一起——"在这些方法上，执行这段逻辑"
- **Weaving**：织入（编译期 / 类加载期 / 运行期）。Spring 运行期织入（通过代理），AspectJ 可以做编译期和类加载期织入（性能更好但需要额外工具）

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
