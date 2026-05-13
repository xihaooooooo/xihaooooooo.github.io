# Spring 框架

---

## 1. IOC 与 DI

- **IOC（控制反转）**：将对象的创建和管理权交给 Spring 容器
- **DI（依赖注入）**：三种方式 — 构造器注入（推荐） / setter 注入 / `@Autowired` 注解注入
- **循环依赖**：三级缓存解决

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

流程：A 实例化 → 暴露 ObjectFactory 到三级缓存 → 填充属性发现依赖 B → B 实例化 → B 需要 A → 从三级缓存获取 A 的早期引用 → B 完成 → A 完成

> **只有单例**的 setter 注入循环依赖能被三级缓存解决；构造器注入的循环依赖无法解决。原型（prototype）Bean 的循环依赖直接抛异常。

---

## 4. Spring AOP

### 两种代理方式

| | JDK 动态代理 | CGLIB |
|--|-------------|-------|
| 机制 | InvocationHandler + Proxy.newProxyInstance() | ASM 生成子类字节码 |
| 要求 | 必须实现接口 | 不能代理 final 类/方法 |
| Spring 默认 | 1.x 默认 | 2.0+ 默认（有接口也用 CGLIB） |

### 核心概念

- **JoinPoint**：连接点（所有可能被增强的方法）
- **Pointcut**：切入点（实际增强的方法）
- **Advice**：增强逻辑（Before / After / Around / AfterReturning / AfterThrowing）
- **Aspect**：切面 = Pointcut + Advice
- **Weaving**：织入（编译期 / 类加载期 / 运行期）

### AOP 应用场景

日志、事务、权限校验、限流、性能统计

---

## 5. @Transactional 失效场景（高频）

| 场景 | 原因 |
|------|------|
| 方法非 public | CGLIB/JDK 代理默认只代理 public 方法 |
| 同类内部调用 `this.method()` | this 是原始对象，绕过了代理 |
| 异常被 catch 吞掉 | 事务只回滚抛出的异常 |
| rollbackFor 设置错误 | 默认仅回滚 RuntimeException 和 Error |
| 数据库引擎不支持事务 | MyISAM |
| 多线程 | 子线程不在当前事务中 |
| propagation 设置不当 | 如 NEVER / NOT_SUPPORTED |

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

```
@SpringBootApplication
  └── @EnableAutoConfiguration
       └── @Import(AutoConfigurationImportSelector.class)
            └── 读取 spring.factories / META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
                 └── 按 @Conditional 系列注解过滤
                      └── 注入匹配的自动配置类
```

### 常见 Condition 注解

- `@ConditionalOnClass`：Classpath 有指定类
- `@ConditionalOnMissingBean`：容器中无指定 Bean
- `@ConditionalOnProperty`：配置文件中有指定属性

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
