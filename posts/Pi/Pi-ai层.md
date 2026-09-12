这一层是比较底层的，关注于与模型的交互。

它有很多的适配器来对不同的模型厂商进行适配，不同的厂商可能使用同一个适配器，也可能使用不同的。这是因为模型接受的消息不一样，比如Anthropic它把工具返回的消息放进了User消息里面，而openai则不一样。Pi它定义了一个toolResult，当要真正发送的时候使用适配器对其进行转换。

toolResult是存在messages里面，而messages是存在context里面的。
```
interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
}
```
systemPrompt和messages大家应该都了解吧。那tools是什么呢？很简单，模型要让agent调用工具，可它是怎么知道有这些工具的呢，就是靠tools。tools里面的Tool描述了这个工具的作用与可以干什么
```
interface Tool {
  name: string;         // 名字，模型用它来"申请"
  description: string;  // 说明书，模型靠它决定要不要用
  parameters: TSchema;  // 参数格式表（typebox）
}
```
每次请求，Pi都会把context发给模型，因为messages是有变化的，所以每次都是当成拼好发给模型

模型接受到消息，就要返回消息，返回的消息不是一大块，而是像流一样。所以对流的处理很关键
不同的模型返回的消息不一样，所以对于pi来说它需要进行模型消息的转换，所以它创建了一个对象AssistantMessage，不同的适配器转换成同一种格式放进这个对象里面。那么怎么读呢。这里又创建了一个对象AssistantMessageEventStream。当模型来了一段消息之后，它会把消息存到AssistantMessage里面，然后也会把消息发送给AssistantMessageEventStream，顺便会把AssistantMessage里的所有内容一起发送

咱们接下来继续看一下message里面有什么，message里面有三种消息：usermessage，
AssistantMessage，ToolResultMessage。
Usermessage代表了用户给模型发的消息，AssistantMessage代表了模型给用户的回复，思考和工具调用信息。ToolResultMessage里面则是工具执行完的结果。当然这些只是Pi里面的格式，要发给模型时，适配器就会把它们转换成正确的格式

pi-ai层的大体流程就是：
```
Pi 定义统一 Context
    ↓
适配器将 Context 转成厂商请求
    ↓
模型返回厂商原始流
    ↓
适配器解析并组装 AssistantMessage
    ↓
统一事件流实时通知调用方
    ↓
stopReason 表示本轮结束原因
    ↓
工具结果进入下一轮 Context
```


