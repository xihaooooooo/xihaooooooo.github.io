
对于final变量来说，它一直是让值不发生变化，对于一个引用变量来说，它被final修饰，可以修改里面的内容，但是不可以给它赋新的对像
```java
final int num = 10;
// num = 20; // 编译报错

final List<String> list = new ArrayList<>();
list.add("Java"); // 允许！改变的是 List 内部的状态
// list = new ArrayList<>(); // 编译报错！无法修改引用地址
```

对于final域来说它可以防止指令重排序（指令重排序感觉都在防止它为什么不取消呢）